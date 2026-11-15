import { z } from "zod";

/** Canonical RCM columns (BOOTSTRAP §4.1). */
export const CONTROL_FIELDS = [
  "control_id",
  "process",
  "sub_process",
  "risk_id",
  "risk_description",
  "control_objective",
  "control_description",
  "control_owner",
  "frequency",
  "control_type",
  "nature",
  "key_control",
  "evidence",
  "systems",
  "assertions",
] as const;
export type ControlField = (typeof CONTROL_FIELDS)[number];

export const ControlSchema = z.object({
  control_id: z.string(),
  process: z.string().default(""),
  sub_process: z.string().default(""),
  risk_id: z.string().default(""),
  risk_description: z.string().default(""),
  control_objective: z.string().default(""),
  control_description: z.string().default(""),
  control_owner: z.string().default(""),
  frequency: z.string().default(""),
  control_type: z.string().default(""),
  nature: z.string().default(""),
  key_control: z.boolean().default(false),
  evidence: z.string().default(""),
  systems: z.string().default(""),
  assertions: z.string().default(""),
});
export type Control = z.infer<typeof ControlSchema>;

/** LLM attribute checks (§4.2 A). */
export const ATTRIBUTE_CHECKS = ["who", "what", "when", "frequency", "evidence", "precision"] as const;
/** Deterministic consistency checks (§4.2 B). */
export const RULE_CHECKS = [
  "freq_mismatch",
  "nature_mismatch",
  "owner_invalid",
  "sod_conflict",
  "missing_risk_link",
  "key_no_evidence",
] as const;
export const CHECK_IDS = [...ATTRIBUTE_CHECKS, ...RULE_CHECKS] as const;
export type AttributeCheckId = (typeof ATTRIBUTE_CHECKS)[number];
export type RuleCheckId = (typeof RULE_CHECKS)[number];
export type CheckId = (typeof CHECK_IDS)[number];

export const CHECK_LABELS: Record<CheckId, string> = {
  who: "Who — performer role",
  what: "What — concrete action",
  when: "When — timing / trigger",
  frequency: "Frequency",
  evidence: "Evidence retained",
  precision: "Precision / threshold",
  freq_mismatch: "Frequency mismatch",
  nature_mismatch: "Nature mismatch",
  owner_invalid: "Owner not a role",
  sod_conflict: "Segregation of duties",
  missing_risk_link: "Risk / objective link",
  key_no_evidence: "Key control without evidence",
};

export const SHORT_LABELS: Record<CheckId, string> = {
  who: "Who",
  what: "What",
  when: "When",
  frequency: "Frequency",
  evidence: "Evidence",
  precision: "Precision",
  freq_mismatch: "Freq. mismatch",
  nature_mismatch: "Nature mismatch",
  owner_invalid: "Owner",
  sod_conflict: "SoD",
  missing_risk_link: "Risk link",
  key_no_evidence: "Key w/o evidence",
};

export const Severity = z.enum(["high", "med", "low"]);
export type Severity = z.infer<typeof Severity>;

export const DEFAULT_SEVERITY: Record<CheckId, Severity> = {
  who: "high",
  what: "high",
  when: "med",
  frequency: "med",
  evidence: "high",
  precision: "high",
  freq_mismatch: "med",
  nature_mismatch: "high",
  owner_invalid: "med",
  sod_conflict: "high",
  missing_risk_link: "med",
  key_no_evidence: "high",
};

/** A verified pointer into the source text. Offsets are computed by code, never trusted from the LLM. */
export const SpanSchema = z.object({
  field: z.enum(CONTROL_FIELDS),
  text: z.string(),
  start: z.number().int(),
  end: z.number().int(),
});
export type Span = z.infer<typeof SpanSchema>;

export const FindingSchema = z.object({
  check: z.enum(CHECK_IDS),
  severity: Severity,
  message: z.string(),
  /** null = the attribute is missing from the text (nothing to cite). */
  evidence_span: SpanSchema.nullable(),
  source: z.enum(["rule", "llm"]),
});
export type Finding = z.infer<typeof FindingSchema>;

export const Status = z.enum(["pass", "weak", "fail"]);
export type Status = z.infer<typeof Status>;

/** Per-attribute result: where in the text the attribute was found (for highlighting passes too). */
export const AttributeResultSchema = z.object({
  check: z.enum(ATTRIBUTE_CHECKS),
  ok: z.boolean(),
  span: SpanSchema.nullable(),
});
export type AttributeResult = z.infer<typeof AttributeResultSchema>;

export const ReviewSchema = z.object({
  control_id: z.string(),
  status: Status,
  findings: z.array(FindingSchema),
  attributes: z.array(AttributeResultSchema),
  automation_score: z.number().int().min(0).max(5),
  automation_rationale: z.string(),
  suggested_rewrite: z.string(),
  model: z.string(),
  prompt_version: z.string(),
  /** Set when the LLM step failed and only deterministic rules ran. */
  llm_error: z.string().optional(),
});
export type Review = z.infer<typeof ReviewSchema>;

export const ReviewRunSchema = z.object({
  generated_at: z.string(),
  model: z.string(),
  prompt_version: z.string(),
  source: z.string(),
  reviews: z.array(ReviewSchema),
});
export type ReviewRun = z.infer<typeof ReviewRunSchema>;

export function statusFromFindings(findings: Finding[]): Status {
  if (findings.some((f) => f.severity === "high")) return "fail";
  if (findings.length > 0) return "weak";
  return "pass";
}
