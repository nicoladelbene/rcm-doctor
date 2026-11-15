/**
 * Regenerates data/demo-results.json (keyless demo mode) with a live LLM run.
 *   OPENROUTER_API_KEY=... npm run precompute [-- --model anthropic/claude-sonnet-5.5]
 * Also used for the holdout: npm run review:holdout (--input/--out).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadControls } from "../src/core/parse";
import { openRouterBatchFn, PROMPT_VERSION } from "../src/core/llm";
import { reviewControls, type LlmResult } from "../src/core/review";
import type { ReviewRun } from "../src/core/schema";

const key = process.env.OPENROUTER_API_KEY;
if (!key) {
  console.error("OPENROUTER_API_KEY is not set.");
  process.exit(1);
}
const mi = process.argv.indexOf("--model");
const model = mi > 0 ? process.argv[mi + 1] : "anthropic/claude-sonnet-5.5";
const out = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : "data/demo-results.json";

const input = process.argv.includes("--input") ? process.argv[process.argv.indexOf("--input") + 1] : "data/demo-rcm.xlsx";
const controls = loadControls(readFileSync(input), input);
// File-backed LLM cache (scratch, git-ignored): a rerun only pays for controls that failed before.
const cachePath = process.env.LLM_CACHE;
const cache = new Map<string, LlmResult>(cachePath && existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : []);
const t0 = Date.now();
const reviews = await reviewControls(controls, {
  cache,
  batchSize: Number(process.env.LLM_BATCH ?? 5),
  llm: openRouterBatchFn({ apiKey: key, model }),
  model,
  concurrency: Number(process.env.LLM_CONCURRENCY ?? 4),
  onProgress: (done, total) => process.stdout.write(`\r${done.length}/${total} reviewed`),
});
const secs = ((Date.now() - t0) / 1000).toFixed(1);
if (cachePath) writeFileSync(cachePath, JSON.stringify([...cache.entries()]));
const errors = reviews.filter((r) => r.llm_error);
console.log(`\nDone in ${secs}s with ${model}. LLM errors: ${errors.length}`);
for (const e of errors) console.log(`  ${e.control_id}: ${e.llm_error}`);
// --allow-partial: keep a run where some controls fell back to rules only (each carries llm_error; the UI shows it).
if (errors.length && !process.argv.includes("--allow-partial")) process.exit(1);

const run: ReviewRun & { duration_seconds: number } = {
  generated_at: new Date().toISOString(),
  model,
  prompt_version: PROMPT_VERSION,
  source: input,
  duration_seconds: Number(secs),
  reviews,
};
writeFileSync(out, JSON.stringify(run, null, 2) + "\n");
console.log(`Wrote ${out}`);
