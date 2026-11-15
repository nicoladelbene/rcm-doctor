/**
 * Week 3: tick & tie for the 5 demo evidence packs → data/demo-evidence-results.json (keyless demo mode + eval).
 *   OPENROUTER_API_KEY=... npm run precompute:evidence [-- --model anthropic/claude-sonnet-5.5]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildEvidenceTest, EVIDENCE_PROMPT_VERSION, EvidencePackSchema, evidenceTraceability, type EvidenceRun, type EvidenceTest } from "../src/core/evidence";
import { evidenceWithLlm } from "../src/core/llm";
import { loadControls } from "../src/core/parse";
import { TestScriptRunSchema } from "../src/core/testscript";

const key = process.env.OPENROUTER_API_KEY;
if (!key) throw new Error("OPENROUTER_API_KEY is not set.");
const arg = (n: string) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : undefined);
const model = arg("--model") ?? "anthropic/claude-sonnet-5.5";
const out = arg("--out") ?? "data/demo-evidence-results.json";

const controls = loadControls(readFileSync("data/demo-rcm.xlsx"), "demo-rcm.xlsx");
const scripts = TestScriptRunSchema.parse(JSON.parse(readFileSync("data/demo-testscripts.json", "utf8"))).scripts;
const packs = EvidencePackSchema.array().parse(JSON.parse(readFileSync("data/evidence/packs.json", "utf8")));

const t0 = Date.now();
const tests: EvidenceTest[] = await Promise.all(
  packs.map(async (pack) => {
    const control = controls.find((c) => c.control_id === pack.control_id)!;
    const script = scripts.find((s) => s.control_id === pack.control_id)!;
    // Attach screenshots as images (the model sees the pixels too, the text layer stays authoritative for ids).
    const withImages = {
      ...pack,
      files: pack.files.map((f) =>
        f.kind === "image" ? { ...f, pages: f.pages.map((p) => ({ ...p, image: `data:image/png;base64,${readFileSync(join("public", p.image!)).toString("base64")}` })) } : f,
      ),
    };
    const s0 = Date.now();
    try {
      const r = await evidenceWithLlm({ control, script, pack: withImages }, { apiKey: key, model });
      console.log(`${pack.control_id}: ${((Date.now() - s0) / 1000).toFixed(1)}s`);
      return buildEvidenceTest(pack, script, r, model);
    } catch (e) {
      console.log(`${pack.control_id}: FAILED ${(e as Error).message}`);
      return buildEvidenceTest(pack, script, null, model, (e as Error).message);
    }
  }),
);
const secs = Number(((Date.now() - t0) / 1000).toFixed(1));
const errors = tests.filter((t) => t.llm_error);
const tr = evidenceTraceability(tests);
console.log(`Done in ${secs}s. ${tests.reduce((n, t) => n + t.ticks.length, 0)} ticks. Errors: ${errors.length}. Traceability ${tr.cited}/${tr.results}.`);
for (const t of tests) console.log(`  ${t.control_id}: ${t.conclusion} — ${t.summary}`);
if (errors.length) process.exit(1);

const run: EvidenceRun = { generated_at: new Date().toISOString(), model, prompt_version: EVIDENCE_PROMPT_VERSION, source: "data/evidence/packs.json", duration_seconds: secs, tests };
writeFileSync(out, JSON.stringify(run, null, 1) + "\n");
console.log(`Wrote ${out}`);
