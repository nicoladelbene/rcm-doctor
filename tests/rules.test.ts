import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ControlSchema, RULE_CHECKS, type Control } from "@/core/schema";
import {
  checkFrequencyMismatch, checkKeyEvidence, checkNatureMismatch, checkOwner, checkRiskLink, checkSod,
  frequenciesInText, normalizeFrequency, runRules,
} from "@/core/rules";
import { loadControls } from "@/core/parse";

const base = (o: Partial<Control>): Control =>
  ControlSchema.parse({
    control_id: "T-1", risk_id: "R-1", control_objective: "Obj", control_owner: "AP Team Lead",
    control_description: "The AP Team Lead reviews the report.", frequency: "Monthly", nature: "Manual",
    evidence: "Signed report", key_control: true, ...o,
  });

describe("frequency", () => {
  it("normalizes column values", () => {
    expect(normalizeFrequency("Monthly")).toBe("monthly");
    expect(normalizeFrequency("Per transaction")).toBe("event");
    expect(normalizeFrequency("Semi-annually")).toBe("semiannual");
    expect(normalizeFrequency("Continuous")).toBe("continuous");
    expect(normalizeFrequency("")).toBeNull();
  });
  it("does not treat month-end / year-end as a frequency", () => {
    expect(frequenciesInText("within 3 business days after month-end and year-end")).toEqual([]);
  });
  it("flags a description frequency that differs from the column, citing the span", () => {
    const c = base({ control_description: "Quarterly, the AP Team Lead reviews the report.", frequency: "Monthly" });
    const [f] = checkFrequencyMismatch(c);
    expect(f.check).toBe("freq_mismatch");
    expect(f.evidence_span).toEqual({ field: "control_description", text: "Quarterly", start: 0, end: 9 });
  });
  it("passes when they agree, and for event-driven controls", () => {
    expect(checkFrequencyMismatch(base({ control_description: "Each month the lead reviews." }))).toEqual([]);
    expect(checkFrequencyMismatch(base({ control_description: "Daily ...", frequency: "Per transaction" }))).toEqual([]);
  });
  it("does not double-count semi-annually as annually", () => {
    expect(frequenciesInText("reviewed semi-annually").map((h) => h.freq)).toEqual(["semiannual"]);
  });
});

describe("nature", () => {
  it("flags manual steps in an automated control", () => {
    const [f] = checkNatureMismatch(base({ nature: "Automated", control_description: "The clerk manually compares lists." }));
    expect(f.evidence_span?.text).toBe("manually");
  });
  it("ignores IT-dependent manual and clean automated controls", () => {
    expect(checkNatureMismatch(base({ nature: "IT-dependent manual", control_description: "The lead reviews." }))).toEqual([]);
    expect(checkNatureMismatch(base({ nature: "Automated", control_description: "SAP blocks posting of duplicates." }))).toEqual([]);
  });
});

describe("owner", () => {
  it("flags empty owners, departments and person names", () => {
    expect(checkOwner(base({ control_owner: "" }))[0].message).toMatch(/empty/);
    expect(checkOwner(base({ control_owner: "Finance" }))[0].message).toMatch(/department/);
    expect(checkOwner(base({ control_owner: "Martin Keller" }))[0].evidence_span?.text).toBe("Martin Keller");
    expect(checkOwner(base({ control_owner: "Anna von Allmen" }))).toHaveLength(1);
  });
  it("accepts roles", () => {
    for (const o of ["AP Team Lead", "Group Treasurer", "Head of AP Operations", "IT Security Officer", "Cost Centre Manager"])
      expect(checkOwner(base({ control_owner: o })), o).toEqual([]);
  });
});

describe("segregation of duties", () => {
  it("flags the same role preparing and approving", () => {
    const [f] = checkSod(base({ control_description: "The Treasury Manager prepares and approves manual payments." }));
    expect(f.evidence_span?.text).toBe("prepares and approves");
    expect(checkSod(base({ control_description: "The clerk enters the invoice and approves it." }))).toHaveLength(1);
    expect(checkSod(base({ control_description: "The manager approves their own expenses." }))).toHaveLength(1);
  });
  it("does not flag separated duties or nouns", () => {
    expect(checkSod(base({ control_description: "The analyst prepares the file and the Treasurer approves it." }))).toEqual([]);
    expect(checkSod(base({ control_description: "Preparer and reviewer sign-offs are recorded." }))).toEqual([]);
    expect(checkSod(base({ control_description: "The lead reviews and signs the pack." }))).toEqual([]);
  });
});

describe("risk link and key evidence", () => {
  it("flags missing risk id or objective once", () => {
    expect(checkRiskLink(base({ risk_id: "" }))).toHaveLength(1);
    expect(checkRiskLink(base({ control_objective: "n/a" }))).toHaveLength(1);
    expect(checkRiskLink(base({ risk_id: "", control_objective: "" }))[0].message).toMatch(/No risk ID and no control objective/);
    expect(checkRiskLink(base({}))).toEqual([]);
  });
  it("flags key controls without evidence only", () => {
    expect(checkKeyEvidence(base({ evidence: "" }))).toHaveLength(1);
    expect(checkKeyEvidence(base({ evidence: "TBD" }))).toHaveLength(1);
    expect(checkKeyEvidence(base({ evidence: "", key_control: false }))).toEqual([]);
  });
});

describe("demo RCM ground truth", () => {
  const controls = loadControls(readFileSync("data/demo-rcm.xlsx"), "demo-rcm.xlsx");
  const truth: Record<string, string[]> = JSON.parse(readFileSync("data/demo-rcm.ground-truth.json", "utf8"));
  it.each(controls.map((c) => [c.control_id, c] as const))("rules match ground truth for %s", (_id, c) => {
    const expected = truth[c.control_id].filter((x) => (RULE_CHECKS as readonly string[]).includes(x)).sort();
    const got = [...new Set(runRules(c).map((f) => f.check))].sort();
    expect(got).toEqual(expected);
  });
  it("every finding with a span points at the exact source text", () => {
    for (const c of controls)
      for (const f of runRules(c))
        if (f.evidence_span) expect(String(c[f.evidence_span.field]).slice(f.evidence_span.start, f.evidence_span.end)).toBe(f.evidence_span.text);
  });
});

describe("Week 1.1: German and extended SoD", () => {
  it("normalizes German frequency values and finds German frequency words", () => {
    expect(normalizeFrequency("Monatlich")).toBe("monthly");
    expect(normalizeFrequency("Quartalsweise")).toBe("quarterly");
    expect(normalizeFrequency("Pro Zahlungslauf")).toBe("event");
    expect(normalizeFrequency("Halbjährlich")).toBe("semiannual");
    expect(frequenciesInText("Die Abstimmung erfolgt vierteljährlich.").map((h) => h.freq)).toEqual(["quarterly"]);
    expect(frequenciesInText("Nach dem Monatsabschluss")).toEqual([]);
    const [f] = checkFrequencyMismatch(base({ control_description: "Der Leiter prüft quartalsweise die Liste.", frequency: "Monatlich" }));
    expect(f.evidence_span?.text).toBe("quartalsweise");
  });
  it("treats German roles as roles and German departments as departments", () => {
    for (const o of ["Leiter Kreditorenbuchhaltung", "Leiterin Lohnbuchhaltung", "Teamleiter Debitoren", "Treasury Manager"])
      expect(checkOwner(base({ control_owner: o })), o).toEqual([]);
    for (const o of ["Finanzen", "Personalabteilung", "Buchhaltung"]) expect(checkOwner(base({ control_owner: o }))[0].message).toMatch(/department/);
    expect(checkOwner(base({ control_owner: "Sarah Keller" }))).toHaveLength(1);
  });
  it("detects manual steps in German automated controls, but not system checks", () => {
    expect(checkNatureMismatch(base({ nature: "Automatisiert", control_description: "Der Treasury Manager vergleicht die Summe manuell." }))[0].evidence_span?.text).toBe("manuell");
    expect(checkNatureMismatch(base({ nature: "Automatisiert", control_description: "Das System prüft jede Rechnung auf Duplikate." }))).toEqual([]);
    expect(checkNatureMismatch(base({ nature: "IT-gestützt manuell", control_description: "manuell" }))).toEqual([]);
  });
  it("flags 'and then approves the same' and 'sole approval', not split duties", () => {
    expect(checkSod(base({ control_description: "The Payroll Manager prepares the reconciliation, investigates all differences above CHF 10 and then approves the same reconciliation." }))).toHaveLength(1);
    expect(checkSod(base({ control_description: "The Treasury Analyst prepares the bank file, compares totals, and then provides the sole final approval in e-banking." }))).toHaveLength(1);
    expect(checkSod(base({ control_description: "The analyst prepares the file, and the Treasurer then approves it." }))).toEqual([]);
    expect(checkSod(base({ control_description: "The clerk prepares the list and the Head of AP reviews and approves it." }))).toEqual([]);
  });
  it("flags German SoD, not split German duties", () => {
    expect(checkSod(base({ control_description: "Die Leiterin Treasury erfasst die Zahlung und gibt sie anschliessend selbst frei." }))).toHaveLength(1);
    expect(checkSod(base({ control_description: "Der Sachbearbeiter erstellt die Abstimmung und der Leiter Finanzen genehmigt sie." }))).toEqual([]);
  });
});
