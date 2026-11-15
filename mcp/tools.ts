/**
 * Week 5 — MCP tool handlers. Thin adapters over src/core: load an RCM, run the same review / test-script logic as
 * the web app, and format results for an AI assistant (Markdown text + structured JSON). No transport code here,
 * so the handlers are unit-testable.
 *
 * AI step: only when OPENROUTER_API_KEY is set in the server's environment (BYOK, never logged or returned).
 * Without it: deterministic rules + deterministic test-script parts, or the precomputed demo when source = "demo".
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, isAbsolute, join, resolve } from "node:path";
import { openRouterBatchFn, testScriptBatchWithLlm } from "@/core/llm";
import { DEFAULT_MODEL } from "@/core/models";
import { loadControls } from "@/core/parse";
import { reviewControls } from "@/core/review";
import { CHECK_LABELS, ReviewRunSchema, type Control, type Review } from "@/core/schema";
import { summarize } from "@/core/summary";
import { generateTestScripts, TestScriptRunSchema, traceability, type TestScript } from "@/core/testscript";

export const MAX_CONTROLS = 200;
const MAX_BYTES = 5 * 1024 * 1024;

export interface Env {
  root: string;
  apiKey?: string;
  model?: string;
  /** Directory relative paths are resolved against (the client's working directory). */
  cwd?: string;
}

export interface SourceArgs {
  source?: "demo" | "file" | "csv";
  path?: string;
  csv?: string;
  control_ids?: string[];
  rules_only?: boolean;
}

interface Loaded {
  controls: Control[];
  label: string;
  demo: boolean;
}

export class ToolInputError extends Error {}

export function loadSource(args: SourceArgs, env: Env): Loaded {
  const source = args.source ?? (args.path ? "file" : args.csv ? "csv" : "demo");
  let loaded: Loaded;
  if (source === "demo") {
    loaded = { controls: loadControls(readFileSync(join(env.root, "data/demo-rcm.xlsx")), "demo-rcm.xlsx"), label: "Demo RCM · Alpenfirn Industries AG (fictional)", demo: true };
  } else if (source === "csv") {
    if (!args.csv?.trim()) throw new ToolInputError("source=csv needs the CSV text in `csv` (header row + one row per control).");
    loaded = { controls: loadControls(args.csv, "pasted.csv"), label: "Pasted CSV", demo: false };
  } else {
    if (!args.path) throw new ToolInputError("source=file needs `path` to an .xlsx, .xls or .csv RCM.");
    const p = isAbsolute(args.path) ? args.path : resolve(env.cwd ?? process.cwd(), args.path);
    const ext = extname(p).toLowerCase();
    if (![".xlsx", ".xls", ".csv"].includes(ext)) throw new ToolInputError(`Unsupported file type "${ext}": use .xlsx, .xls or .csv.`);
    if (!existsSync(p)) throw new ToolInputError(`File not found: ${p}`);
    if (statSync(p).size > MAX_BYTES) throw new ToolInputError("File larger than 5 MB.");
    const data = readFileSync(p);
    loaded = { controls: loadControls(ext === ".csv" ? data.toString("utf8") : data, p), label: p.split(/[\\/]/).pop()!, demo: false };
  }
  if (args.control_ids?.length) {
    const want = new Set(args.control_ids.map((s) => s.trim().toUpperCase()));
    loaded.controls = loaded.controls.filter((c) => want.has(c.control_id.toUpperCase()));
    if (!loaded.controls.length) throw new ToolInputError(`None of ${args.control_ids.join(", ")} found in the RCM.`);
  }
  if (!loaded.controls.length) throw new ToolInputError("No controls found: the RCM needs at least Control ID and Control Description columns.");
  if (loaded.controls.length > MAX_CONTROLS) throw new ToolInputError(`${loaded.controls.length} controls: the limit is ${MAX_CONTROLS} per call. Use control_ids to select a subset.`);
  return loaded;
}

function demoReviews(env: Env, controls: Control[]): { reviews: Review[]; model: string } {
  const run = ReviewRunSchema.parse(JSON.parse(readFileSync(join(env.root, "data/demo-results.json"), "utf8")));
  const ids = new Set(controls.map((c) => c.control_id));
  return { reviews: run.reviews.filter((r) => ids.has(r.control_id)), model: `${run.model} (precomputed demo run)` };
}

async function reviewsFor(loaded: Loaded, args: SourceArgs, env: Env): Promise<{ reviews: Review[]; mode: string; model: string }> {
  if (loaded.demo) return { ...demoReviews(env, loaded.controls), mode: "demo" };
  if (env.apiKey && !args.rules_only) {
    const model = env.model ?? DEFAULT_MODEL;
    const reviews = await reviewControls(loaded.controls, { llm: openRouterBatchFn({ apiKey: env.apiKey, model }), model, batchSize: 5, concurrency: 3 });
    return { reviews, mode: "ai", model };
  }
  return { reviews: await reviewControls(loaded.controls), mode: "rules-only", model: "rules-only" };
}

/* ------------------------------------------------------------------ */
/* review_rcm                                                          */
/* ------------------------------------------------------------------ */

export async function reviewRcm(args: SourceArgs, env: Env) {
  const loaded = loadSource(args, env);
  const { reviews, mode, model } = await reviewsFor(loaded, args, env);
  const s = summarize(reviews);
  const byId = new Map(loaded.controls.map((c) => [c.control_id, c]));
  const order = { fail: 0, weak: 1, pass: 2 } as const;
  const sorted = [...reviews].sort((a, b) => order[a.status] - order[b.status]);

  const lines: string[] = [
    `# rcm-doctor review · ${loaded.label}`,
    `${s.total} controls · **${s.fail} fail · ${s.weak} weak · ${s.pass} pass** · ${s.findings} findings · avg automation ${s.avgAutomation}/5`,
    `Mode: ${modeNote(mode, model)}`,
    s.topChecks.length ? `Top issues: ${s.topChecks.map((t) => `${CHECK_LABELS[t.check]} (${t.count})`).join(", ")}` : "",
    "",
    "Every finding quotes the exact source text it is based on (offsets verified by code); “missing” means there is nothing to quote.",
    "",
  ];
  for (const r of sorted) {
    const c = byId.get(r.control_id)!;
    if (r.status === "pass") continue;
    lines.push(`## ${r.control_id} — ${r.status.toUpperCase()} · ${c.process}${c.sub_process ? ` / ${c.sub_process}` : ""}`);
    lines.push(`> ${c.control_description}`);
    for (const f of r.findings) {
      const cite = f.evidence_span ? `“${f.evidence_span.text}” (${f.evidence_span.field} ${f.evidence_span.start}–${f.evidence_span.end})` : "missing — nothing to cite";
      lines.push(`- **${f.severity.toUpperCase()} · ${CHECK_LABELS[f.check]}** (${f.source}): ${f.message} — cited: ${cite}`);
    }
    if (r.suggested_rewrite) lines.push(`- Suggested rewrite: ${r.suggested_rewrite}`);
    if (r.llm_error) lines.push(`- AI step failed for this control (rules still ran): ${r.llm_error}`);
    lines.push("");
  }
  const passed = sorted.filter((r) => r.status === "pass").map((r) => r.control_id);
  if (passed.length) lines.push(`Pass (no findings): ${passed.join(", ")}`);

  return {
    text: lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n"),
    structured: {
      source: loaded.label,
      mode,
      model,
      summary: s,
      reviews: reviews.map((r) => ({
        control_id: r.control_id,
        status: r.status,
        automation_score: r.automation_score,
        findings: r.findings.map((f) => ({ check: f.check, severity: f.severity, source: f.source, message: f.message, cited_text: f.evidence_span?.text ?? null, span: f.evidence_span })),
        suggested_rewrite: r.suggested_rewrite,
        ...(r.llm_error ? { llm_error: r.llm_error } : {}),
      })),
    },
  };
}

/* ------------------------------------------------------------------ */
/* generate_test_scripts                                               */
/* ------------------------------------------------------------------ */

export async function generateTestScriptsTool(args: SourceArgs, env: Env) {
  const loaded = loadSource(args, env);
  let scripts: TestScript[];
  let mode: string;
  let model: string;
  if (loaded.demo) {
    const run = TestScriptRunSchema.parse(JSON.parse(readFileSync(join(env.root, "data/demo-testscripts.json"), "utf8")));
    const ids = new Set(loaded.controls.map((c) => c.control_id));
    scripts = run.scripts.filter((t) => ids.has(t.control_id));
    mode = "demo";
    model = `${run.model} (precomputed demo run)`;
  } else {
    const r = await reviewsFor(loaded, args, env);
    const useAi = r.mode === "ai";
    model = r.model;
    mode = r.mode;
    scripts = await generateTestScripts(loaded.controls, r.reviews, useAi ? {
      llm: (items) => testScriptBatchWithLlm(items.map((i) => ({ control: i.control, review: i.review })), { apiKey: env.apiKey!, model }),
      model,
      batchSize: 5,
      concurrency: 3,
    } : {});
  }
  const byId = new Map(loaded.controls.map((c) => [c.control_id, c]));
  const ready = scripts.filter((t) => t.toe_ready).length;
  const tr = traceability(scripts);
  const lines: string[] = [
    `# rcm-doctor test scripts · ${loaded.label}`,
    `${scripts.length} controls · **${ready} ready for operating-effectiveness testing · ${scripts.length - ready} blocked by design**` +
      (tr.attributes ? ` · ${tr.cited}/${tr.attributes} test attributes cite the exact text they test` : ""),
    `Mode: ${modeNote(mode, model)}${mode === "rules-only" ? " Walkthrough steps and test attributes need the AI step; sample sizes and blockers are deterministic." : ""}`,
    "Sample sizes are illustrative minimums by frequency (configurable in src/core/testscript.ts) — adjust to your methodology.",
    "",
  ];
  for (const t of scripts) {
    const c = byId.get(t.control_id);
    lines.push(`## ${t.control_id} — ${t.toe_ready ? "ready" : "BLOCKED: remediate the design first"} · sample ${t.sample.size ?? "n/a"} (${t.sample.label})`);
    if (c) lines.push(`> ${c.control_description}`);
    if (!t.toe_ready) for (const b of t.blockers) lines.push(`- Blocker: ${b}`);
    lines.push(`- Sample basis: ${t.sample.basis}`);
    lines.push(`- Population: ${t.population}`);
    lines.push(`- Walkthrough (test of design): ${t.tod_steps.map((s, i) => `${i + 1}) ${s}`).join(" ")}`);
    for (const a of t.attributes) lines.push(`- Attribute ${a.id}: ${a.attribute} — ${a.procedure} Evidence: ${a.evidence}. Tests: ${a.span ? `“${a.span.text}”` : "(not stated in the description)"}`);
    lines.push(`- Exception: ${t.exception_definition}`, "");
  }
  return { text: lines.join("\n"), structured: { source: loaded.label, mode, model, ready, blocked: scripts.length - ready, traceability: tr, scripts } };
}

function modeNote(mode: string, model: string) {
  if (mode === "demo") return `precomputed demo results (${model}); no API key needed.`;
  if (mode === "ai") return `live AI review with ${model} via OpenRouter (key from the server environment) + deterministic rules.`;
  return "rules-only (no OPENROUTER_API_KEY in the server environment): the six deterministic consistency checks; design attributes, automation score and rewrite need the AI step.";
}
