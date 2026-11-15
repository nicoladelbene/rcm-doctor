/**
 * Regenerates data/demo-results.json (keyless demo mode) with a live LLM run.
 *   OPENROUTER_API_KEY=... npm run precompute [-- --model anthropic/claude-sonnet-5.5]
 * Also used for the holdout: npm run review:holdout (--input/--out).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { loadControls } from "../src/core/parse";
import { openRouterBatchFn, PROMPT_VERSION } from "../src/core/llm";
import { reviewControls } from "../src/core/review";
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
// OpenRouter returns 402 while in-flight requests still reserve credit, 429 on the per-minute cap: wait and retry (offline script only).
function withCreditRetry<A extends unknown[], R>(fn: (...a: A) => Promise<R>) {
  return async (...a: A): Promise<R> => {
    for (let i = 0; ; i++) {
      try {
        return await fn(...a);
      } catch (e) {
        const m = (e as Error).message;
        if (i >= 8 || !/OpenRouter (402|429)/.test(m)) throw e;
        await new Promise((r) => setTimeout(r, /429/.test(m) ? 60000 : 15000));
      }
    }
  };
}
const t0 = Date.now();
const reviews = await reviewControls(controls, {
  llm: withCreditRetry(openRouterBatchFn({ apiKey: key, model })),
  model,
  batchSize: 5,
  concurrency: process.argv.includes("--concurrency") ? Number(process.argv[process.argv.indexOf("--concurrency") + 1]) : 4,
  onProgress: (done, total) => process.stdout.write(`\r${done.length}/${total} reviewed`),
});
const secs = ((Date.now() - t0) / 1000).toFixed(1);
const errors = reviews.filter((r) => r.llm_error);
console.log(`\nDone in ${secs}s with ${model}. LLM errors: ${errors.length}`);
for (const e of errors) console.log(`  ${e.control_id}: ${e.llm_error}`);
if (errors.length) process.exit(1);

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
