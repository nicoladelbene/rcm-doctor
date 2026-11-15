/**
 * Orchestrates deterministic rules + (optional) LLM attribute review per control.
 * Client-safe: the LLM is injected, so this module has no Node or network imports.
 */
import { hash } from "./hash";
import { PROMPT_VERSION } from "./models";
import { runRules } from "./rules";
import {
  ATTRIBUTE_CHECKS,
  DEFAULT_SEVERITY,
  statusFromFindings,
  type AttributeResult,
  type Control,
  type Finding,
  type Review,
  type Severity,
} from "./schema";
import { locateSpan } from "./spans";

/** Shape returned by the LLM layer (see llm.ts); duplicated as a type to stay import-light. */
export interface LlmAttribute {
  status: "ok" | "weak" | "missing" | "n/a";
  quote: string | null;
  comment: string;
}
export interface LlmResult {
  control_id: string;
  attributes: Record<(typeof ATTRIBUTE_CHECKS)[number], LlmAttribute>;
  /** review.v2 */
  sod_conflict?: { present: boolean; quote: string | null; comment: string };
  automation_score: number;
  automation_rationale: string;
  suggested_rewrite: string;
}

export type LlmBatchFn = (controls: Control[]) => Promise<LlmResult[]>;

const downgrade = (s: Severity): Severity => (s === "high" ? "med" : "low");

/** Merge rule findings and LLM attribute assessments into one Review. */
export function buildReview(control: Control, llm: LlmResult | null, model: string, llmError?: string): Review {
  const findings: Finding[] = runRules(control);
  const attributes: AttributeResult[] = [];

  if (llm) {
    for (const check of ATTRIBUTE_CHECKS) {
      const a = llm.attributes[check];
      if (!a) continue;
      // Offsets are computed here; a quote that is not in the source is dropped, never shown.
      const span = locateSpan(control, "control_description", a.quote);
      const ok = a.status === "ok" || a.status === "n/a";
      attributes.push({ check, ok, span: ok ? span : null });
      if (!ok) {
        findings.push({
          check,
          severity: a.status === "missing" ? DEFAULT_SEVERITY[check] : downgrade(DEFAULT_SEVERITY[check]),
          message: a.comment || `${check}: ${a.status}`,
          evidence_span: a.status === "missing" ? null : span,
          source: "llm",
        });
      }
    }
  }

  // review.v2: the reviewer also assesses SoD. The rule finding wins when both fire (one finding per check).
  if (llm?.sod_conflict?.present && !findings.some((f) => f.check === "sod_conflict")) {
    findings.push({
      check: "sod_conflict",
      severity: DEFAULT_SEVERITY.sod_conflict,
      message: llm.sod_conflict.comment || "The same role performs and approves the activity.",
      evidence_span: locateSpan(control, "control_description", llm.sod_conflict.quote),
      source: "llm",
    });
  }

  const order = { high: 0, med: 1, low: 2 } as const;
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    control_id: control.control_id,
    status: statusFromFindings(findings),
    findings,
    attributes,
    automation_score: llm ? clampScore(llm.automation_score) : heuristicAutomationScore(control),
    automation_rationale: llm?.automation_rationale ?? "Heuristic estimate from the nature column (no LLM run).",
    suggested_rewrite: llm?.suggested_rewrite ?? "",
    model: llm ? model : "rules-only",
    prompt_version: llm ? PROMPT_VERSION : "rules",
    ...(llmError ? { llm_error: llmError } : {}),
  };
}

function clampScore(n: number) {
  return Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
}

/** Fallback when no LLM is available: rough score from the nature column. */
export function heuristicAutomationScore(c: Control): number {
  const n = c.nature.toLowerCase();
  if (/automat/.test(n) && !/dependent|semi/.test(n)) return 5;
  if (/dependent|semi/.test(n)) return 3;
  return 2;
}

export function cacheKey(c: Control, model: string): string {
  return hash(JSON.stringify([c, model, PROMPT_VERSION]));
}

export interface ReviewOptions {
  llm?: LlmBatchFn;
  model?: string;
  batchSize?: number;
  concurrency?: number;
  cache?: Map<string, LlmResult>;
  onProgress?: (done: Review[], total: number) => void;
}

/** Review all controls: batch LLM calls with a concurrency limit; rules always run. */
export async function reviewControls(controls: Control[], opts: ReviewOptions = {}): Promise<Review[]> {
  const model = opts.model ?? "rules-only";
  const out = new Map<string, Review>();
  const emit = () => opts.onProgress?.(controls.map((c) => out.get(c.control_id)).filter(Boolean) as Review[], controls.length);

  if (!opts.llm) {
    for (const c of controls) out.set(c.control_id, buildReview(c, null, model));
    emit();
    return controls.map((c) => out.get(c.control_id)!);
  }

  const cache = opts.cache;
  const todo: Control[] = [];
  for (const c of controls) {
    const hit = cache?.get(cacheKey(c, model));
    if (hit) out.set(c.control_id, buildReview(c, hit, model));
    else todo.push(c);
  }
  emit();

  const size = opts.batchSize ?? 6;
  const batches: Control[][] = [];
  for (let i = 0; i < todo.length; i += size) batches.push(todo.slice(i, i + size));

  let next = 0;
  const worker = async () => {
    while (next < batches.length) {
      const batch = batches[next++];
      try {
        const results = await opts.llm!(batch);
        for (const c of batch) {
          const r = results.find((x) => x.control_id === c.control_id) ?? null;
          if (r) cache?.set(cacheKey(c, model), r);
          out.set(c.control_id, buildReview(c, r, model, r ? undefined : "No LLM result for this control"));
        }
      } catch (e) {
        const msg = (e as Error).message;
        for (const c of batch) out.set(c.control_id, buildReview(c, null, model, msg));
      }
      emit();
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 3, batches.length) }, worker));
  return controls.map((c) => out.get(c.control_id)!);
}
