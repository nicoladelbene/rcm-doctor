/**
 * Week 3: evaluates the evidence tester against planted exceptions → docs/eval-evidence.md/.json.
 *   npm run eval:evidence            # committed results (data/demo-evidence-results.json), no key
 * Live: npm run precompute:evidence first. Gate: every planted exception found, ≤ 5% false exceptions,
 * ≥ 90% of tick/exception results tied to a verified box/cell.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { EvidenceRunSchema, evaluateEvidence, type EvidenceGroundTruth } from "../src/core/evidence";
import { TestScriptRunSchema } from "../src/core/testscript";

const truth: EvidenceGroundTruth = JSON.parse(readFileSync("data/evidence/ground-truth.json", "utf8"));
const run = EvidenceRunSchema.parse(JSON.parse(readFileSync("data/demo-evidence-results.json", "utf8")));
const scripts = TestScriptRunSchema.parse(JSON.parse(readFileSync("data/demo-testscripts.json", "utf8"))).scripts;
const attrs = Object.fromEntries(scripts.map((s) => [s.control_id, s.attributes.map((a) => a.id)]));
const r = evaluateEvidence(run.tests, truth, attrs);
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

const md = [
  "# Eval — evidence tester (tick & tie)",
  "",
  `Model \`${run.model}\` · prompt \`${run.prompt_version}\` · results \`data/demo-evidence-results.json\` (${run.generated_at.slice(0, 10)}, ${run.duration_seconds ?? "?"} s) · ground truth \`data/evidence/ground-truth.json\` · \`npm run eval:evidence\``,
  "",
  "| Metric | Value |",
  "|---|---:|",
  `| Controls / sample items × attributes | ${r.controls} / ${r.cells} |`,
  `| Planted exceptions found | ${pct(r.recall)} (${r.detected}/${r.planted}) |`,
  `| …with the box on the proving text | ${r.detectedWithBox}/${r.detected} |`,
  `| False exceptions on clean items | ${pct(r.falseExceptionRate)} (${r.falseExceptions}/${r.cleanCells}) |`,
  `| Clean items left "not evidenced" (for a human) | ${r.unresolved} |`,
  `| Control conclusions correct | ${r.conclusionsCorrect}/${r.controls} |`,
  `| Results tied to a verified box / cell | ${pct(r.traceability.rate)} (${r.traceability.cited}/${r.traceability.results}) |`,
  "",
  "| Control | Expected | Got | Planted | Found | False exc. | Not evidenced |",
  "|---|---|---|---:|---:|---:|---:|",
  ...r.perControl.map((c) => `| ${c.control_id} | ${c.expected} | ${c.got} | ${c.planted} | ${c.detected} | ${c.falseExceptions} | ${c.unresolved} |`),
  "",
  ...(r.misses.length ? ["## Missed", "", ...r.misses.map((m) => `- ${m}`), ""] : []),
  ...(r.extras.length ? ["## False exceptions", "", ...r.extras.map((m) => `- ${m}`), ""] : []),
  "## Honest caveats",
  "",
  "- 5 synthetic controls, 3 planted exceptions, 160+ clean item × attribute cells including deliberate near-misses",
  "  (an amount exactly at a threshold, a weekend inside a 2-business-day deadline, an unticketed session that was escalated in time).",
  "- The evidence and the prompt were written by the same author: this is a regression test, not a benchmark.",
  "- Demo text layers are exact (generated with the documents). Uploaded screenshots are transcribed by the vision model, so their boxes are approximate.",
  "",
].join("\n");
writeFileSync("docs/eval-evidence.md", md);
writeFileSync("docs/eval-evidence.json", JSON.stringify({ model: run.model, prompt_version: run.prompt_version, ...r }, null, 2) + "\n");

console.log(`[evidence] model ${run.model} · ${run.generated_at.slice(0, 10)}`);
console.log(`planted exceptions found ${pct(r.recall)} (${r.detected}/${r.planted}, ${r.detectedWithBox} with box on proof) · false exceptions ${pct(r.falseExceptionRate)} (${r.falseExceptions}/${r.cleanCells}) · not evidenced ${r.unresolved} · conclusions ${r.conclusionsCorrect}/${r.controls} · traced ${pct(r.traceability.rate)}`);
for (const m of [...r.misses, ...r.extras]) console.log(`  ${m}`);
console.log("wrote docs/eval-evidence.md");

if (r.recall < 1 || r.falseExceptionRate > 0.05 || r.traceability.rate < 0.9) {
  console.error("Evidence eval gate failed: all planted exceptions must be found, false exceptions ≤ 5%, traced ≥ 90%.");
  process.exit(1);
}
