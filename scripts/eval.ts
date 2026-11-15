/**
 * Evaluates the reviewer against ground truth and writes a markdown report.
 *   npm run eval                 # demo set, committed results → docs/eval-latest.md
 *   npm run eval:holdout         # holdout set, committed results → docs/eval-holdout.md
 *   npm run eval -- --live [--model id]   # live run (needs OPENROUTER_API_KEY)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { evalMarkdown, evaluate, type EvalReport, type GroundTruth } from "../src/core/evaluate";
import { DEFAULT_MODEL, PROMPT_VERSION } from "../src/core/models";
import { loadControls } from "../src/core/parse";
import { reviewControls } from "../src/core/review";
import { ReviewRunSchema, type Review } from "../src/core/schema";

const arg = (name: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const set = arg("--set") ?? "demo";
const H1 = "data/holdout";
const H2 = "data/holdout-v2";
const SETS = {
  demo: { rcm: "data/demo-rcm.xlsx", truth: "data/demo-rcm.ground-truth.json", results: "data/demo-results.json", out: "docs/eval-latest", gate: true, dir: "", title: "Eval — latest" },
  // Holdout v1 as first measured (review.v1, Week 1 rules). Historical record: do not regenerate.
  holdout: { rcm: `${H1}/holdout-rcm.xlsx`, truth: `${H1}/holdout.ground-truth.json`, results: `${H1}/holdout-results.json`, out: "docs/eval-holdout", gate: false, dir: H1, title: "Eval — holdout v1 (first measurement, unseen)" },
  // Holdout v1 re-run with Week 1.1 (review.v2 + new rules). NOT a holdout any more: these fixes were made after seeing it.
  "holdout-v1-rerun": { rcm: `${H1}/holdout-rcm.xlsx`, truth: `${H1}/holdout.ground-truth.json`, results: `${H1}/holdout-results.review-v2.json`, out: "docs/eval-holdout-v1-rerun", gate: false, dir: H1, title: "Eval — holdout v1 re-run with Week 1.1 (SEEN set, not a holdout)" },
  // Holdout v2: generated after Week 1.1 was frozen; never seen before this measurement.
  holdout2: { rcm: `${H2}/holdout-rcm.xlsx`, truth: `${H2}/holdout.ground-truth.json`, results: `${H2}/holdout-results.json`, out: "docs/eval-holdout-v2", gate: false, dir: H2, title: "Eval — holdout v2 (unseen, Week 1.1 system)" },
  // Same holdout v2, reviewed by the Week 1 system (review.v1 + Week 1 rules) as a baseline.
  "holdout2-baseline": { rcm: `${H2}/holdout-rcm.xlsx`, truth: `${H2}/holdout.ground-truth.json`, results: `${H2}/holdout-results.baseline-week1.json`, out: "docs/eval-holdout-v2-baseline", gate: false, dir: H2, title: "Eval — holdout v2 with the Week 1 system (baseline)" },
} as const;
const cfg = SETS[set as keyof typeof SETS];
if (!cfg) throw new Error(`Unknown --set ${set}`);
if (!existsSync(cfg.truth)) {
  console.log(`No ground truth for set "${set}" yet — skipping.`);
  process.exit(0);
}

const truth: GroundTruth = JSON.parse(readFileSync(cfg.truth, "utf8"));
const controls = loadControls(readFileSync(cfg.rcm), cfg.rcm);
const key = process.env.OPENROUTER_API_KEY;
const live = !!key && (process.argv.includes("--live") || !existsSync(cfg.results));
const model = arg("--model") ?? DEFAULT_MODEL;

let reviews: Review[];
let meta: { model: string; promptVersion: string; source: string };
if (live) {
  const { openRouterBatchFn } = await import("../src/core/llm");
  reviews = await reviewControls(controls, { llm: openRouterBatchFn({ apiKey: key!, model }), model, batchSize: 5, concurrency: 4 });
  meta = { model, promptVersion: PROMPT_VERSION, source: `live run on ${cfg.rcm}` };
} else if (existsSync(cfg.results)) {
  const run = ReviewRunSchema.parse(JSON.parse(readFileSync(cfg.results, "utf8")));
  reviews = run.reviews;
  meta = { model: run.model, promptVersion: run.prompt_version, source: `${cfg.results} (${run.generated_at.slice(0, 10)})` };
} else {
  reviews = await reviewControls(controls);
  meta = { model: "rules-only", promptVersion: "rules", source: `rules only (no ${cfg.results}, no key)` };
}

const report = evaluate(reviews, truth);
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
let md = evalMarkdown(report, { ...meta, date: new Date().toISOString().slice(0, 10), truthPath: cfg.truth, command: set === "demo" ? "npm run eval" : `npm run eval -- --set ${set}` });

// Per-language breakdown (holdout has a language map).
const metaPath = `${cfg.dir}/holdout.meta.json`;
let byLanguage: Record<string, EvalReport> | undefined;
if (cfg.dir && existsSync(metaPath)) {
  const hm = JSON.parse(readFileSync(metaPath, "utf8"));
  const langs: Record<string, string> = hm.languages;
  byLanguage = {};
  for (const lang of [...new Set(Object.values(langs))].sort()) {
    const sub = Object.fromEntries(Object.entries(truth).filter(([id]) => langs[id] === lang));
    byLanguage[lang] = evaluate(reviews, sub as GroundTruth);
  }
  const rows = Object.entries(byLanguage).map(
    ([l, r]) => `| ${l === "de" ? "German" : "English"} | ${r.controls} | ${r.plantedDefects} | ${pct(r.recall)} (${r.detected}/${r.plantedDefects}) | ${pct(r.cleanFpRate)} (clean: ${r.cleanControls}) | ${pct(r.precision)} |`,
  );
  md = md.replace("# Eval — latest", `# ${cfg.title}`) +
    [
      "## By language",
      "",
      "| Language | Controls | Labelled defects | Recall | FP on clean | Precision |",
      "|---|---:|---:|---:|---:|---:|",
      ...rows,
      "",
      "## Methodology",
      "",
      `Company: ${hm.company.name} (${hm.company.industry}), fictional. Controls and ground-truth labels were generated by \`${hm.generator_model}\``,
      "in one call, with a labeling guide written independently of the review prompt, and committed before any review ran.",
      `The reviewer configuration (prompt and rules; SHA-256 in \`${cfg.dir}/\`) was frozen before the holdout was generated, unless the title says the set was seen.`,
      "Labels were not edited after seeing results, so disagreements include label noise from the generator as well as reviewer errors.",
      "",
    ].join("\n");
}

writeFileSync(`${cfg.out}.md`, md);
writeFileSync(`${cfg.out}.json`, JSON.stringify({ ...meta, ...report, ...(byLanguage ? { byLanguage } : {}) }, null, 2) + "\n");

console.log(`[${set}] model ${meta.model} · ${meta.source}`);
console.log(`recall ${pct(report.recall)} (${report.detected}/${report.plantedDefects}) · FP on clean ${pct(report.cleanFpRate)} · precision ${pct(report.precision)}`);
for (const m of report.perCheck) console.log(`  ${m.check.padEnd(18)} ${m.tp}/${m.expected}  extra ${m.fp}`);
if (byLanguage) for (const [l, r] of Object.entries(byLanguage)) console.log(`  [${l}] recall ${pct(r.recall)} · FP on clean ${pct(r.cleanFpRate)} · precision ${pct(r.precision)}`);
console.log(`wrote ${cfg.out}.md`);

// Regression gate on the demo set only; the holdout is a measurement, not a gate.
const MIN_RECALL = 0.8;
const MAX_FP = 0.2;
if (cfg.gate && meta.model !== "rules-only" && (report.recall < MIN_RECALL || report.cleanFpRate > MAX_FP)) {
  console.error(`Eval gate failed: recall must be ≥ ${pct(MIN_RECALL)} and clean FP ≤ ${pct(MAX_FP)}.`);
  process.exit(1);
}
