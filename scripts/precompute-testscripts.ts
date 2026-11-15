/**
 * Week 2: generates test scripts for the demo RCM → data/demo-testscripts.json (keyless demo mode).
 *   OPENROUTER_API_KEY=... npm run precompute:testscripts [-- --model anthropic/claude-sonnet-5.5]
 * Uses the committed review results (data/demo-results.json) as context.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { testScriptBatchWithLlm } from "../src/core/llm";
import { loadControls } from "../src/core/parse";
import { ReviewRunSchema } from "../src/core/schema";
import { generateTestScripts, TESTSCRIPT_PROMPT_VERSION, traceability, type TestScriptRun } from "../src/core/testscript";

const key = process.env.OPENROUTER_API_KEY;
if (!key) throw new Error("OPENROUTER_API_KEY is not set.");
const arg = (n: string) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : undefined);
const model = arg("--model") ?? "anthropic/claude-sonnet-5.5";
const input = arg("--input") ?? "data/demo-rcm.xlsx";
const reviewsPath = arg("--reviews") ?? "data/demo-results.json";
const out = arg("--out") ?? "data/demo-testscripts.json";

const controls = loadControls(readFileSync(input), input);
const reviews = ReviewRunSchema.parse(JSON.parse(readFileSync(reviewsPath, "utf8"))).reviews;
const t0 = Date.now();
const scripts = await generateTestScripts(controls, reviews, {
  llm: (items) => testScriptBatchWithLlm(items, { apiKey: key, model }),
  model,
  batchSize: 5,
  concurrency: Number(process.env.LLM_CONCURRENCY ?? 4),
  onProgress: (d, t) => process.stdout.write(`\r${d}/${t} scripts`),
});
const secs = Number(((Date.now() - t0) / 1000).toFixed(1));
const errors = scripts.filter((s) => s.llm_error);
const tr = traceability(scripts);
console.log(`\nDone in ${secs}s. LLM errors: ${errors.length}. ToE-ready: ${scripts.filter((s) => s.toe_ready).length}/${scripts.length}.`);
console.log(`Traceability: ${tr.cited}/${tr.attributes} test attributes cite a verified span (${(tr.rate * 100).toFixed(0)}%).`);
for (const e of errors) console.log(`  ${e.control_id}: ${e.llm_error}`);
if (errors.length) process.exit(1);

const run: TestScriptRun = { generated_at: new Date().toISOString(), model, prompt_version: TESTSCRIPT_PROMPT_VERSION, source: input, duration_seconds: secs, scripts };
writeFileSync(out, JSON.stringify(run, null, 2) + "\n");
console.log(`Wrote ${out}`);
