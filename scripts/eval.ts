/**
 * Evaluates the reviewer against the demo RCM ground truth and writes docs/eval-latest.md.
 * Live run if OPENROUTER_API_KEY is set (model via --model), otherwise uses data/demo-results.json.
 *   npm run eval            # offline, committed results
 *   npm run eval -- --live  # force live (needs key)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { evalMarkdown, evaluate, type GroundTruth } from "../src/core/evaluate";
import { DEFAULT_MODEL, PROMPT_VERSION } from "../src/core/models";
import { loadControls } from "../src/core/parse";
import { reviewControls } from "../src/core/review";
import { ReviewRunSchema, type Review } from "../src/core/schema";

const truth: GroundTruth = JSON.parse(readFileSync("data/demo-rcm.ground-truth.json", "utf8"));
const controls = loadControls(readFileSync("data/demo-rcm.xlsx"), "demo-rcm.xlsx");
const key = process.env.OPENROUTER_API_KEY;
const live = !!key && (process.argv.includes("--live") || !existsSync("data/demo-results.json"));
const mi = process.argv.indexOf("--model");
const model = mi > 0 ? process.argv[mi + 1] : DEFAULT_MODEL;

let reviews: Review[];
let meta: { model: string; promptVersion: string; source: string };
if (live) {
  const { openRouterBatchFn } = await import("../src/core/llm");
  reviews = await reviewControls(controls, { llm: openRouterBatchFn({ apiKey: key!, model }), model, batchSize: 5, concurrency: 4 });
  meta = { model, promptVersion: PROMPT_VERSION, source: "live run on data/demo-rcm.xlsx" };
} else if (existsSync("data/demo-results.json")) {
  const run = ReviewRunSchema.parse(JSON.parse(readFileSync("data/demo-results.json", "utf8")));
  // Re-apply current rules to the stored LLM output is not possible without raw output, so evaluate as stored.
  reviews = run.reviews;
  meta = { model: run.model, promptVersion: run.prompt_version, source: `data/demo-results.json (${run.generated_at.slice(0, 10)})` };
} else {
  reviews = await reviewControls(controls);
  meta = { model: "rules-only", promptVersion: "rules", source: "rules only (no demo-results.json, no key)" };
}

const report = evaluate(reviews, truth);
const md = evalMarkdown(report, { ...meta, date: new Date().toISOString().slice(0, 10) });
writeFileSync("docs/eval-latest.md", md);
writeFileSync("docs/eval-latest.json", JSON.stringify({ ...meta, ...report }, null, 2) + "\n");

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
console.log(`model ${meta.model} · ${meta.source}`);
console.log(`recall ${pct(report.recall)} (${report.detected}/${report.plantedDefects}) · FP on clean ${pct(report.cleanFpRate)} · precision ${pct(report.precision)}`);
for (const m of report.perCheck) console.log(`  ${m.check.padEnd(18)} ${m.tp}/${m.expected}  extra ${m.fp}`);
console.log("wrote docs/eval-latest.md");

// Regression gate (only meaningful once LLM results exist).
const MIN_RECALL = 0.8;
const MAX_FP = 0.2;
if (meta.model !== "rules-only" && (report.recall < MIN_RECALL || report.cleanFpRate > MAX_FP)) {
  console.error(`Eval gate failed: recall must be ≥ ${pct(MIN_RECALL)} and clean FP ≤ ${pct(MAX_FP)}.`);
  process.exit(1);
}
