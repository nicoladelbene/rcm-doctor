import * as XLSX from "xlsx";
import { CHECK_LABELS, CONTROL_FIELDS, type Control, type Review } from "./schema";
import { summarize } from "./summary";
import type { TestScript } from "./testscript";
import { APPROACH_LABELS, assumptionRows, FREQ_LABELS, VERDICT_LABELS, type Assumptions, type Heatmap } from "./automation";

const HEADER_LABELS: Record<(typeof CONTROL_FIELDS)[number], string> = {
  control_id: "Control ID",
  process: "Process",
  sub_process: "Sub-process",
  risk_id: "Risk ID",
  risk_description: "Risk Description",
  control_objective: "Control Objective",
  control_description: "Control Description",
  control_owner: "Control Owner",
  frequency: "Frequency",
  control_type: "Control Type",
  nature: "Nature",
  key_control: "Key Control (Y/N)",
  evidence: "Evidence",
  systems: "System(s)",
  assertions: "Assertions",
};

export const REVIEW_COLUMNS = [
  "Review Status",
  "# Findings",
  "Findings",
  "Automation Score (0-5)",
  "Automation Rationale",
  "Suggested Rewrite",
  "Reviewed By (model)",
  "Prompt Version",
] as const;

function findingsText(r: Review): string {
  return r.findings
    .map((f) => `[${f.severity.toUpperCase()}] ${CHECK_LABELS[f.check]}: ${f.message}${f.evidence_span ? ` — cited: "${f.evidence_span.text}"` : ""}`)
    .join("\n");
}

/** Build the report workbook: original columns + review columns, a findings sheet and a summary. */
export function buildReportWorkbook(
  controls: Control[],
  reviews: Review[],
  meta: { source?: string; generatedAt?: string } = {},
  scripts?: TestScript[],
  automation?: { heatmap: Heatmap; assumptions: Assumptions },
): XLSX.WorkBook {
  const byId = new Map(reviews.map((r) => [r.control_id, r]));
  const wb = XLSX.utils.book_new();

  const header = [...CONTROL_FIELDS.map((f) => HEADER_LABELS[f]), ...REVIEW_COLUMNS];
  const rows = controls.map((c) => {
    const r = byId.get(c.control_id);
    return [
      ...CONTROL_FIELDS.map((f) => (f === "key_control" ? (c.key_control ? "Y" : "N") : c[f])),
      r?.status ?? "not reviewed",
      r?.findings.length ?? 0,
      r ? findingsText(r) : "",
      r?.automation_score ?? "",
      r?.automation_rationale ?? "",
      r?.suggested_rewrite ?? "",
      r?.model ?? "",
      r?.prompt_version ?? "",
    ];
  });
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws["!cols"] = header.map((h) => ({ wch: /Description|Findings$|Rewrite/.test(h) ? 70 : /Rationale|Risk Desc|Objective/.test(h) ? 40 : Math.max(10, h.length + 2) }));
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: header.length - 1 } }) };
  XLSX.utils.book_append_sheet(wb, ws, "Review");

  const fRows = reviews.flatMap((r) =>
    r.findings.map((f) => [r.control_id, CHECK_LABELS[f.check], f.check, f.severity, f.source, f.message, f.evidence_span?.text ?? "(missing — nothing to cite)", f.evidence_span?.field ?? "", f.evidence_span?.start ?? "", f.evidence_span?.end ?? ""]),
  );
  const fws = XLSX.utils.aoa_to_sheet([
    ["Control ID", "Check", "Check ID", "Severity", "Source", "Message", "Cited text", "Field", "Start", "End"],
    ...fRows,
  ]);
  fws["!cols"] = [10, 26, 16, 9, 7, 70, 50, 20, 6, 6].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, fws, "Findings");

  if (scripts?.length) {
    const tRows = scripts.flatMap((t) => {
      const head = [t.control_id, t.toe_ready ? "Ready" : "Blocked — remediate design first", t.blockers.join("\n"), t.sample.label, t.sample.size ?? "n/a", t.sample.basis, t.population, t.tod_steps.map((x, i) => `${i + 1}. ${x}`).join("\n"), t.exception_definition];
      if (!t.attributes.length) return [[...head, "", "", "", "", ""]];
      return t.attributes.map((a, i) => [...(i === 0 ? head : head.map((_, k) => (k === 0 ? t.control_id : ""))), a.id, a.attribute, a.procedure, a.evidence, a.span?.text ?? "(not stated in the description)"]);
    });
    const tws = XLSX.utils.aoa_to_sheet([
      ["Control ID", "ToE status", "Blockers", "Frequency", "Sample size", "Sample basis", "Population", "Test of design (walkthrough)", "Exception definition", "Attr.", "Attribute", "Procedure", "Evidence to inspect", "Tests this text"],
      ...tRows,
    ]);
    tws["!cols"] = [10, 16, 40, 14, 8, 40, 45, 60, 45, 5, 35, 50, 30, 50].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, tws, "Test scripts");
  }

  if (automation) {
    const { heatmap: h, assumptions: a } = automation;
    const cases = h.cases.filter((x) => x.status === "candidate").sort((x, y) => y.hours_saved - x.hours_saved);
    const aws = XLSX.utils.aoa_to_sheet([
      ["Automation business cases (score ≥ " + a.threshold + "). Arithmetic on the assumptions below; adjust them to your organisation."],
      [],
      ["Control ID", "Process", "Control type", "Score", "Approach", "Why (cited text)", "Frequency", "Occurrences / yr", "Minutes / occurrence", "Hours today / yr", "Share removed", "Hours saved / yr", "CHF saved / yr", "Build hours", "Payback (months)", "Verdict", "Prerequisites", "Remediate first"],
      ...cases.map((x) => [
        x.control_id, x.process, x.control_type, x.score, x.approach ? APPROACH_LABELS[x.approach] : "",
        `${x.approach_why}${x.approach_span ? ` — cited: "${x.approach_span.text}"` : ""}`,
        x.frequency in FREQ_LABELS ? FREQ_LABELS[x.frequency as keyof typeof FREQ_LABELS] : x.frequency,
        x.runs_per_year, x.minutes_per_run, x.hours_today, x.share_removed, x.hours_saved, x.chf_saved, x.build_hours, x.payback_months ?? "n/a",
        x.verdict ? VERDICT_LABELS[x.verdict] : "", x.prerequisites.map((p, i) => `${i + 1}. ${p}`).join("\n"), x.blockers.join("\n"),
      ]),
      [],
      ["Total", "", "", "", "", "", "", "", "", "", "", h.totals.hours_saved, h.totals.chf_saved, h.totals.build_hours],
      [],
      ["Assumptions"],
      ...assumptionRows(a),
    ]);
    aws["!cols"] = [10, 16, 12, 6, 24, 60, 18, 10, 10, 10, 8, 10, 10, 8, 10, 14, 70, 50].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, aws, "Automation");
  }

  const s = summarize(reviews);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["rcm-doctor review report"],
      ["Source", meta.source ?? ""],
      ["Generated", meta.generatedAt ?? new Date().toISOString()],
      ["Controls reviewed", s.total],
      ["Pass", s.pass],
      ["Weak", s.weak],
      ["Fail", s.fail],
      ["Total findings", s.findings],
      ["Average automation score", s.avgAutomation],
      [],
      ["Top issue types"],
      ...s.topChecks.map((t) => [CHECK_LABELS[t.check], t.count]),
      [],
      ["Generated by rcm-doctor (Apache-2.0). Findings are design-review suggestions, not audit advice."],
    ]),
    "Summary",
  );
  return wb;
}

export function buildReportXlsx(
  controls: Control[],
  reviews: Review[],
  meta?: { source?: string; generatedAt?: string },
  scripts?: TestScript[],
  automation?: { heatmap: Heatmap; assumptions: Assumptions },
): Uint8Array {
  const wb = buildReportWorkbook(controls, reviews, meta, scripts, automation);
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx", compression: true }));
}
