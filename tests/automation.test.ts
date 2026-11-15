import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assumptionRows, buildHeatmap, sanitizeAssumptions, businessCase, chooseApproach, DEFAULT_ASSUMPTIONS, runFrequency, type Assumptions,
} from "@/core/automation";
import { loadControls } from "@/core/parse";
import { ControlSchema, ReviewRunSchema, type Control, type Finding, type Review } from "@/core/schema";

const ctl = (o: Partial<Control>): Control =>
  ControlSchema.parse({
    control_id: "A-1", process: "P2P", control_type: "Detective", nature: "Manual", frequency: "Monthly", systems: "SAP S/4HANA", control_owner: "AP Team Lead",
    control_description: "By business day 5, the AP Team Lead reconciles the AP sub-ledger to the GL and investigates differences above CHF 5,000.", ...o,
  });
const rev = (score: number, findings: Partial<Finding>[] = [], id = "A-1"): Review => ({
  control_id: id, status: "pass", attributes: [], automation_score: score, automation_rationale: "", suggested_rewrite: "", model: "m", prompt_version: "v",
  findings: findings.map((f) => ({ check: "precision", severity: "high", message: "m", evidence_span: null, source: "llm", ...f }) as Finding),
});

describe("business case arithmetic", () => {
  it("monthly reconciliation, score 4: 12 × 180 min × 60% = 21.6 h, CHF and payback from assumptions", () => {
    const b = businessCase(ctl({}), rev(4));
    expect(b.status).toBe("candidate");
    expect(b.approach).toBe("rpa");
    expect(b.hours_today).toBe(36);
    expect(b.hours_saved).toBe(21.6);
    expect(b.chf_saved).toBe(Math.round(21.6 * 110));
    expect(b.payback_months).toBe(44.4); // 80 h build / 21.6 h a year
    expect(b.verdict).toBe("weak");
  });

  it("every assumption changes the result", () => {
    const a: Assumptions = { ...DEFAULT_ASSUMPTIONS, minutesPerRun: { ...DEFAULT_ASSUMPTIONS.minutesPerRun, monthly: 600 }, shareRemoved: { 4: 0.5, 5: 1 }, hourlyRate: 100, buildHours: { itac: 10, rpa: 20 } };
    const b = businessCase(ctl({}), rev(4), a);
    expect(b.hours_saved).toBe(60); // 12 × 10 h × 50%
    expect(b.chf_saved).toBe(6000);
    expect(b.payback_months).toBe(4);
    expect(b.verdict).toBe("strong");
  });

  it("per-control overrides win over the frequency defaults", () => {
    const c = ctl({ frequency: "Per invoice", control_type: "Preventive", control_description: "The AP clerk approves each invoice above CHF 10,000 in the SAP workflow." });
    expect(runFrequency(c)).toBe("event");
    const b = businessCase(c, rev(5), DEFAULT_ASSUMPTIONS, { "A-1": { runsPerYear: 3000, minutesPerRun: 4 } });
    expect(b.overridden).toBe(true);
    expect(b.hours_saved).toBe(180); // 3000 × 4 min × 90%
  });

  it("raising the threshold drops score-4 controls from the business case", () => {
    const b = businessCase(ctl({}), rev(4), { ...DEFAULT_ASSUMPTIONS, threshold: 5 });
    expect(b.status).toBe("below");
    expect(b.hours_saved).toBe(0);
    expect(b.prerequisites).toEqual([]);
  });

  it("an automated control saves nothing more; a mislabelled one (nature mismatch) is a candidate", () => {
    const auto = ctl({ nature: "Automated", frequency: "Continuous", control_type: "Preventive" });
    expect(businessCase(auto, rev(5)).status).toBe("automated");
    expect(businessCase(auto, rev(5)).hours_saved).toBe(0);
    const fake = ctl({ nature: "Automated", frequency: "Daily" });
    const b = businessCase(fake, rev(4, [{ check: "nature_mismatch" }]));
    expect(b.status).toBe("candidate");
    expect(b.frequency).toBe("daily");
  });
});

describe("approach and traceability", () => {
  it("preventive check in a system of record → ITAC, citing the cue word", () => {
    const c = ctl({ control_type: "Preventive", control_description: "SAP blocks invoices with a price variance above 2% for payment." });
    const a = chooseApproach(c);
    expect(a.approach).toBe("itac");
    expect(a.span?.text).toBe("blocks");
    expect(c.control_description.slice(a.span!.start, a.span!.end)).toBe("blocks");
  });
  it("preventive but only in SharePoint → script, not ITAC", () => {
    expect(chooseApproach(ctl({ control_type: "Preventive", systems: "SharePoint", control_description: "The Treasurer approves the request form." })).approach).toBe("rpa");
  });
  it("detective comparison → RPA/script citing the comparison", () => {
    const a = chooseApproach(ctl({}));
    expect(a.approach).toBe("rpa");
    expect(a.span?.text).toBe("reconciles");
  });
  it("keeps system names with slashes and does not read a job title as a cue", () => {
    const c = ctl({ systems: "SAP S/4HANA, SharePoint", control_description: "Daily, the IT Operations Analyst checks whether the batch jobs completed." });
    const a = chooseApproach(c);
    expect(a.span?.text).toBe("checks whether");
    expect(a.why).toContain("SAP S/4HANA");
  });
  it("prerequisites include design fixes from the review, and high findings become blockers", () => {
    const b = businessCase(ctl({}), rev(4, [{ check: "precision" }, { check: "sod_conflict" }]));
    expect(b.prerequisites[0]).toMatch(/segregation/i);
    expect(b.prerequisites.join(" ")).toMatch(/threshold/);
    expect(b.blockers).toHaveLength(2);
  });
});

describe("heatmap on the demo RCM", () => {
  const controls = loadControls(readFileSync("data/demo-rcm.xlsx"), "demo-rcm.xlsx");
  const run = ReviewRunSchema.parse(JSON.parse(readFileSync("data/demo-results.json", "utf8")));
  const h = buildHeatmap(controls, run.reviews);

  it("has process × control type cells that add up to all controls", () => {
    expect(h.types).toEqual(["Preventive", "Detective"]);
    expect(h.processes).toContain("Treasury");
    expect(h.cells.reduce((n, c) => n + c.controls, 0)).toBe(40);
  });
  it("gives a business case to every non-automated control with score ≥ 4", () => {
    const expected = run.reviews.filter((r) => r.automation_score >= 4).map((r) => r.control_id);
    const covered = h.cases.filter((c) => c.status !== "below").map((c) => c.control_id);
    for (const id of expected) expect(covered).toContain(id);
    expect(h.totals.candidates).toBe(h.cases.filter((c) => c.status === "candidate").length);
    expect(h.totals.hours_saved).toBeGreaterThan(0);
  });
  it("every cited approach span is verbatim source text", () => {
    for (const c of h.cases) {
      if (!c.approach_span) continue;
      const src = controls.find((x) => x.control_id === c.control_id)!.control_description;
      expect(src.slice(c.approach_span.start, c.approach_span.end)).toBe(c.approach_span.text);
    }
  });
  it("lists every assumption for the export", () => {
    expect(assumptionRows(DEFAULT_ASSUMPTIONS)).toHaveLength(1 + 7 + 7 + 2 + 2 + 2);
  });
});

describe("export", () => {
  it("adds an Automation sheet with the cases and every assumption", async () => {
    const XLSX = await import("xlsx");
    const { buildReportWorkbook } = await import("@/core/export");
    const controls = loadControls(readFileSync("data/demo-rcm.xlsx"), "demo-rcm.xlsx");
    const run = ReviewRunSchema.parse(JSON.parse(readFileSync("data/demo-results.json", "utf8")));
    const a = { ...DEFAULT_ASSUMPTIONS, hourlyRate: 95 };
    const wb = buildReportWorkbook(controls, run.reviews, {}, undefined, { heatmap: buildHeatmap(controls, run.reviews, a), assumptions: a });
    expect(wb.SheetNames).toEqual(["Review", "Findings", "Automation", "Summary"]);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.Automation, { header: 1 });
    expect(rows.some((r) => r[0] === "Hourly rate (CHF, fully loaded)" && r[1] === 95)).toBe(true);
    expect(rows.filter((r) => typeof r[0] === "string" && /^[A-Z0-9]+-\d\d$/.test(r[0] as string)).length).toBe(buildHeatmap(controls, run.reviews, a).totals.candidates);
  });
});

describe("stored assumptions", () => {
  it("round-trips valid values and falls back field by field on garbage", () => {
    const a = { ...DEFAULT_ASSUMPTIONS, hourlyRate: 95, threshold: 5 };
    expect(sanitizeAssumptions(JSON.parse(JSON.stringify(a)))).toEqual(a);
    const bad = sanitizeAssumptions({ hourlyRate: -3, threshold: 9, shareRemoved: { 4: 7 }, runsPerYear: { daily: "x", weekly: 50 } });
    expect(bad.hourlyRate).toBe(DEFAULT_ASSUMPTIONS.hourlyRate);
    expect(bad.threshold).toBe(4);
    expect(bad.shareRemoved[4]).toBe(1);
    expect(bad.runsPerYear.daily).toBe(250);
    expect(bad.runsPerYear.weekly).toBe(50);
    expect(sanitizeAssumptions(null)).toEqual(DEFAULT_ASSUMPTIONS);
  });
});
