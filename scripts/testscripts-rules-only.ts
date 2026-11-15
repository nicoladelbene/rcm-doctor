/** Deterministic test scripts (sample size, blockers) without an LLM: npx tsx scripts/testscripts-rules-only.ts <rcm.xlsx> <reviews.json> <out.json> */
import { readFileSync, writeFileSync } from "node:fs";
import { loadControls } from "../src/core/parse";
import { ReviewRunSchema } from "../src/core/schema";
import { generateTestScripts, type TestScriptRun } from "../src/core/testscript";

const [input, reviewsPath, out] = process.argv.slice(2);
const controls = loadControls(readFileSync(input), input);
const reviews = ReviewRunSchema.parse(JSON.parse(readFileSync(reviewsPath, "utf8"))).reviews;
const scripts = await generateTestScripts(controls, reviews);
const run: TestScriptRun = { generated_at: new Date().toISOString(), model: "rules-only", prompt_version: "deterministic", source: input, scripts };
writeFileSync(out, JSON.stringify(run, null, 2) + "\n");
console.log(`${scripts.length} scripts · ToE-ready ${scripts.filter((s) => s.toe_ready).length}`);
