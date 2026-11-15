/**
 * Generates a HOLDOUT RCM with an independent model family (not Claude), including ground-truth labels
 * produced by the generator itself, BEFORE and SEPARATELY from any review.
 *
 *   OPENROUTER_API_KEY=... npm run gen:holdout [-- --model openai/gpt-5.6-sol]
 *
 * Writes data/holdout/{generation.json, holdout-rcm.xlsx, holdout-rcm.csv, holdout.ground-truth.json, holdout.meta.json}.
 * Run ONCE. Regenerating replaces the holdout set; never edit labels after seeing review results.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { z } from "zod";
import { CHECK_IDS } from "../src/core/schema";
import { extractJson } from "../src/core/llm";

const key = process.env.OPENROUTER_API_KEY;
if (!key) throw new Error("OPENROUTER_API_KEY is not set");
const mi = process.argv.indexOf("--model");
const model = mi > 0 ? process.argv[mi + 1] : "openai/gpt-5.6-sol";
if (/anthropic|claude/i.test(model)) throw new Error("The holdout generator must not be a Claude model.");
const OUT = join(process.cwd(), "data/holdout");
if (existsSync(join(OUT, "generation.json")) && !process.argv.includes("--force"))
  throw new Error("Holdout already exists. Pass --force only if you really mean to replace it.");
mkdirSync(OUT, { recursive: true });

/* Labeling guide: written independently of src/core/prompts/review.v1.md. */
const PROMPT = `You are an experienced internal-controls practitioner building a TEST SET for evaluating an automated
Risk & Control Matrix (RCM) reviewer. You write realistic controls AND label their design defects.

Company: invent ONE fictional Swiss company (not a real one, not "Alpenfirn"), in an industry other than
industrial manufacturing (e.g. medtech, food, logistics, private hospital, retail). Currency CHF. Give it a name ending in AG.

Write exactly 30 controls:
- Processes: Procure-to-Pay, Order-to-Cash, Treasury, Record-to-Report, ITGC, and HR/Payroll (spread them).
- Exactly 10 controls written in GERMAN (Swiss Standard German: "ss" instead of "ß"), using Swiss IKS terminology
  (e.g. IKS, Kontrollverantwortliche/r, Visum, Vier-Augen-Prinzip, Kollektivunterschrift zu zweien,
  Monatsabschluss, Kreditoren/Debitoren, Zahlungsfreigabe, Schlüsselkontrolle). In German controls, ALL text fields
  (process names may stay English) are in German, including owner, frequency, type, nature and evidence values.
  The other 20 controls are in English. Mix the languages across processes.
- At least 10 controls must be CLEAN: a well-designed control with no defect at all.
- The rest have realistic defects, 1–4 each. Across the set, every defect type below must appear at least twice.
- Write the way real RCMs are written: some precise, some sloppy, some passive voice. Vary length.
- Use IDs like P2P-H01, O2C-H02, TRE-H03, R2R-H04, ITG-H05, HRP-H06 (unique).

Defect types (label EVERY one that applies to a control, not only the one you intended; labels must be exhaustive):
- who: the description does not name the performer as an accountable role (passive voice with no actor, a department
  like "Finance", a team, or a person's name). A system performing an automated control is fine.
- what: the action is vague or not testable ("ensures", "monitors", "looks at", "oversees") instead of a concrete
  action (review, reconcile, compare, approve, block, match).
- when: no timing or trigger is stated (e.g. "within 3 business days after month-end", "before release", "at posting").
- frequency: how often it runs is missing from both description and frequency column, or is implausible for the risk.
- evidence: the description does not say what evidence is retained and where.
- precision: a review / detective / approval control has no threshold or investigation criterion ("significant",
  "unusual" or nothing). Not applicable to purely automated preventive controls.
- freq_mismatch: a frequency word in the description contradicts the frequency column.
- nature_mismatch: nature column says automated, but the description describes manual steps.
- owner_invalid: the control_owner column is empty, a department/placeholder, or a person's name instead of a role.
- sod_conflict: the same role both performs and approves/reviews the same activity.
- missing_risk_link: risk_id is empty or control_objective is empty.
- key_no_evidence: key_control is true but the evidence column is empty.

Return JSON only:
{"company": {"name": string, "industry": string, "description": string},
 "controls": [{"control_id": string, "language": "en"|"de", "process": string, "sub_process": string,
   "risk_id": string, "risk_description": string, "control_objective": string, "control_description": string,
   "control_owner": string, "frequency": string, "control_type": string, "nature": string, "key_control": boolean,
   "evidence": string, "systems": string, "assertions": string,
   "defects": [one or more of ${CHECK_IDS.map((c) => `"${c}"`).join(", ")}] or [],
   "defect_notes": string}]}`;

const Gen = z.object({
  company: z.object({ name: z.string(), industry: z.string(), description: z.string() }),
  controls: z
    .array(
      z.object({
        control_id: z.string().min(1),
        language: z.enum(["en", "de"]),
        process: z.string(),
        sub_process: z.string(),
        risk_id: z.string(),
        risk_description: z.string(),
        control_objective: z.string(),
        control_description: z.string().min(10),
        control_owner: z.string(),
        frequency: z.string(),
        control_type: z.string(),
        nature: z.string(),
        key_control: z.boolean(),
        evidence: z.string(),
        systems: z.string(),
        assertions: z.string(),
        defects: z.array(z.enum(CHECK_IDS)),
        defect_notes: z.string(),
      }),
    )
    .length(30),
});

const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "rcm-doctor holdout generator" },
  body: JSON.stringify({
    model,
    temperature: 0.7,
    max_tokens: 40000,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: PROMPT }],
  }),
});
const json = await res.json();
if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
const content: string = json.choices[0].message.content;
const gen = Gen.parse(extractJson(content));

// Structural checks only (no look at review output, no label edits).
const ids = new Set(gen.controls.map((c) => c.control_id));
if (ids.size !== 30) throw new Error("duplicate control ids");
const de = gen.controls.filter((c) => c.language === "de").length;
const clean = gen.controls.filter((c) => c.defects.length === 0).length;
const counts = Object.fromEntries(CHECK_IDS.map((c) => [c, gen.controls.filter((x) => x.defects.includes(c)).length]));
console.log(`${gen.company.name} (${gen.company.industry}) · German: ${de} · clean: ${clean}`);
console.log(counts);

writeFileSync(
  join(OUT, "generation.json"),
  JSON.stringify({ generated_at: new Date().toISOString(), model, prompt: PROMPT, usage: json.usage ?? null, raw: content, parsed: gen }, null, 2) + "\n",
);

const HEADERS = ["Control ID", "Process", "Sub-process", "Risk ID", "Risk Description", "Control Objective", "Control Description", "Control Owner", "Frequency", "Control Type", "Nature", "Key Control (Y/N)", "Evidence", "System(s)", "Assertions"];
const rows = gen.controls.map((c) => [
  c.control_id, c.process, c.sub_process, c.risk_id, c.risk_description, c.control_objective, c.control_description,
  c.control_owner, c.frequency, c.control_type, c.nature, c.key_control ? "Y" : "N", c.evidence, c.systems, c.assertions,
]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[`${gen.company.name} — RCM (SYNTHETIC HOLDOUT, generated by ${model})`], [], HEADERS, ...rows]), "RCM");
writeFileSync(join(OUT, "holdout-rcm.xlsx"), XLSX.write(wb, { type: "buffer", bookType: "xlsx", compression: true }));
writeFileSync(join(OUT, "holdout-rcm.csv"), XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet([HEADERS, ...rows])) + "\n");
writeFileSync(join(OUT, "holdout.ground-truth.json"), JSON.stringify(Object.fromEntries(gen.controls.map((c) => [c.control_id, c.defects])), null, 2) + "\n");
writeFileSync(
  join(OUT, "holdout.meta.json"),
  JSON.stringify({ company: gen.company, generator_model: model, languages: Object.fromEntries(gen.controls.map((c) => [c.control_id, c.language])) }, null, 2) + "\n",
);
console.log("Wrote data/holdout/");
