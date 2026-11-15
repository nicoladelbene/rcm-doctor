/**
 * Week 2 — test-script generator.
 * Deterministic: sample size from frequency, readiness for operating-effectiveness testing.
 * LLM (injected, prompt testscript.v1): walkthrough steps and test attributes, each tied to a verified span.
 * Client-safe: no Node or network imports.
 */
import { z } from "zod";
import { normalizeFrequency, type Freq } from "./rules";
import { SpanSchema, type Control, type Review } from "./schema";
import { locateSpan } from "./spans";

export const TESTSCRIPT_PROMPT_VERSION = "testscript.v1";

/* ------------------------------------------------------------------ */
/* Sample sizes                                                        */
/* ------------------------------------------------------------------ */

export type SampleFreq = Freq | "unknown";

/**
 * Illustrative minimum sample sizes by control frequency, in line with commonly published practice
 * for testing operating effectiveness over a 12-month period. Configurable — replace with your own methodology.
 */
export const SAMPLE_TABLE: Record<Exclude<SampleFreq, "unknown">, { size: number; label: string; basis: string }> = {
  continuous: { size: 1, label: "Automated / continuous", basis: "Automated control: test one instance (test of one), relying on effective ITGCs (change and access) over the period." },
  annual: { size: 1, label: "Annual", basis: "Annual control: test the one occurrence in the period." },
  semiannual: { size: 2, label: "Semi-annual", basis: "Semi-annual control: test both occurrences." },
  quarterly: { size: 2, label: "Quarterly", basis: "Quarterly control: test 2 of 4 quarters (include the year-end quarter if relied on)." },
  monthly: { size: 2, label: "Monthly", basis: "Monthly control: test 2 of 12 months (include a period-end month if relied on)." },
  weekly: { size: 5, label: "Weekly", basis: "Weekly control: test 5 of ~52 weeks, spread across the period." },
  daily: { size: 20, label: "Daily", basis: "Daily control: test 20 of ~250 days, selected randomly across the period." },
  event: { size: 25, label: "Per transaction / event", basis: "Recurring, event-driven control: test 25 occurrences selected randomly (test all if the population is smaller)." },
};

const DE_FREQ: [RegExp, Freq][] = [
  [/(laufend|kontinuierlich|systemseitig|automatisch)/i, "continuous"],
  [/(pro |je |bei jede|bei bedarf|ereignis|transaktion|fallweise|anlassbezogen)/i, "event"],
  [/täglich|taeglich/i, "daily"],
  [/wöchentlich|woechentlich/i, "weekly"],
  [/halbjährlich|halbjaehrlich/i, "semiannual"],
  [/quartal|vierteljährlich/i, "quarterly"],
  [/monatlich|monat/i, "monthly"],
  [/jährlich|jaehrlich|jahr/i, "annual"],
];

/** Frequency used for sampling: automated nature wins; then the frequency column (English or German). */
export function samplingFrequency(c: Control): SampleFreq {
  const nature = c.nature.toLowerCase();
  if (/automat/.test(nature) && !/(dependent|gestützt|gestuetzt|semi|manual|manuell)/.test(nature)) return "continuous";
  const en = normalizeFrequency(c.frequency);
  if (en) return en;
  for (const [re, f] of DE_FREQ) if (re.test(c.frequency)) return f;
  return "unknown";
}

export function sampleFor(c: Control): { frequency: SampleFreq; size: number | null; label: string; basis: string } {
  const f = samplingFrequency(c);
  if (f === "unknown") return { frequency: f, size: null, label: "Unknown", basis: "Frequency is not stated: define it before a sample can be selected." };
  return { frequency: f, ...SAMPLE_TABLE[f] };
}

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

export const TestAttributeSchema = z.object({
  id: z.string(),
  attribute: z.string(),
  procedure: z.string(),
  evidence: z.string(),
  span: SpanSchema.nullable(),
});
export type TestAttribute = z.infer<typeof TestAttributeSchema>;

export const TestScriptSchema = z.object({
  control_id: z.string(),
  toe_ready: z.boolean(),
  blockers: z.array(z.string()),
  sample: z.object({
    frequency: z.string(),
    size: z.number().int().nullable(),
    label: z.string(),
    basis: z.string(),
  }),
  population: z.string(),
  tod_steps: z.array(z.string()),
  attributes: z.array(TestAttributeSchema),
  exception_definition: z.string(),
  model: z.string(),
  prompt_version: z.string(),
  llm_error: z.string().optional(),
});
export type TestScript = z.infer<typeof TestScriptSchema>;

export const TestScriptRunSchema = z.object({
  generated_at: z.string(),
  model: z.string(),
  prompt_version: z.string(),
  source: z.string(),
  duration_seconds: z.number().optional(),
  scripts: z.array(TestScriptSchema),
});
export type TestScriptRun = z.infer<typeof TestScriptRunSchema>;

/** What the LLM returns per control (see llm.ts). */
export interface LlmTestScript {
  control_id: string;
  population: string;
  tod_steps: string[];
  toe_attributes: { attribute: string; procedure: string; evidence: string; quote: string | null }[];
  exception_definition: string;
}

/* ------------------------------------------------------------------ */
/* Merge                                                               */
/* ------------------------------------------------------------------ */

/** Design findings that make operating-effectiveness testing pointless until remediated. */
const BLOCKING = new Set(["who", "what", "evidence", "precision", "sod_conflict", "nature_mismatch"]);

export function blockersFrom(review: Review | null | undefined): string[] {
  if (!review) return [];
  return review.findings
    .filter((f) => f.severity === "high" && BLOCKING.has(f.check))
    .map((f) => `${f.check}: ${f.message}`);
}

const FALLBACK_TOD = [
  "Inquire with the control owner how the control is performed, and with what inputs and outputs.",
  "Obtain the evidence for one recent occurrence and trace it through the control as described.",
  "Confirm the performer, timing, threshold and retained evidence match the control description.",
  "Conclude whether the control, as designed, addresses the stated risk.",
];

const LETTERS = "ABCDEFGHIJ";

export function buildTestScript(control: Control, review: Review | null | undefined, llm: LlmTestScript | null, model: string, llmError?: string): TestScript {
  const blockers = blockersFrom(review);
  const sample = sampleFor(control);
  const attributes: TestAttribute[] = (llm?.toe_attributes ?? []).slice(0, LETTERS.length).map((a, i) => ({
    id: LETTERS[i],
    attribute: a.attribute,
    procedure: a.procedure,
    evidence: a.evidence,
    // Offsets computed here; a quote that is not in the description is dropped, never shown.
    span: locateSpan(control, "control_description", a.quote),
  }));
  return {
    control_id: control.control_id,
    toe_ready: blockers.length === 0 && sample.size !== null,
    blockers: sample.size === null ? [...blockers, `frequency: ${sample.basis}`] : blockers,
    sample,
    population: llm?.population ?? "[Obtain a complete listing of control occurrences for the period from the system of record.]",
    tod_steps: llm?.tod_steps?.length ? llm.tod_steps : FALLBACK_TOD,
    attributes,
    exception_definition: llm?.exception_definition ?? "Any sampled occurrence where the control was not performed as described.",
    model: llm ? model : "rules-only",
    prompt_version: llm ? TESTSCRIPT_PROMPT_VERSION : "deterministic",
    ...(llmError ? { llm_error: llmError } : {}),
  };
}

export type TestScriptBatchFn = (items: { control: Control; review: Review | null }[]) => Promise<LlmTestScript[]>;

/** Generate test scripts for all controls: batches with a concurrency limit; deterministic parts always run. */
export async function generateTestScripts(
  controls: Control[],
  reviews: Review[],
  opts: { llm?: TestScriptBatchFn; model?: string; batchSize?: number; concurrency?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<TestScript[]> {
  const byId = new Map(reviews.map((r) => [r.control_id, r]));
  const model = opts.model ?? "rules-only";
  const out = new Map<string, TestScript>();
  if (!opts.llm) {
    for (const c of controls) out.set(c.control_id, buildTestScript(c, byId.get(c.control_id), null, model));
    opts.onProgress?.(controls.length, controls.length);
    return controls.map((c) => out.get(c.control_id)!);
  }
  const size = opts.batchSize ?? 5;
  const batches: Control[][] = [];
  for (let i = 0; i < controls.length; i += size) batches.push(controls.slice(i, i + size));
  let next = 0;
  const worker = async () => {
    while (next < batches.length) {
      const batch = batches[next++];
      try {
        const results = await opts.llm!(batch.map((control) => ({ control, review: byId.get(control.control_id) ?? null })));
        for (const c of batch) {
          const r = results.find((x) => x.control_id === c.control_id) ?? null;
          out.set(c.control_id, buildTestScript(c, byId.get(c.control_id), r, model, r ? undefined : "No LLM result for this control"));
        }
      } catch (e) {
        for (const c of batch) out.set(c.control_id, buildTestScript(c, byId.get(c.control_id), null, model, (e as Error).message));
      }
      opts.onProgress?.(out.size, controls.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 3, batches.length) }, worker));
  return controls.map((c) => out.get(c.control_id)!);
}

/** Share of test attributes whose quote was located in the source (traceability metric). */
export function traceability(scripts: TestScript[]): { attributes: number; cited: number; rate: number } {
  const all = scripts.flatMap((s) => s.attributes);
  const cited = all.filter((a) => a.span).length;
  return { attributes: all.length, cited, rate: all.length ? cited / all.length : 0 };
}
