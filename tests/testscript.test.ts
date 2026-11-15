import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { buildTestScriptMessages, testScriptBatchWithLlm } from "@/core/llm";
import { loadControls } from "@/core/parse";
import { buildReview } from "@/core/review";
import { ControlSchema, ReviewRunSchema, type Control } from "@/core/schema";
import {
  buildTestScript, generateTestScripts, sampleFor, samplingFrequency, TestScriptRunSchema, traceability, type LlmTestScript,
} from "@/core/testscript";

const ctl = (o: Partial<Control>): Control =>
  ControlSchema.parse({ control_id: "T-1", risk_id: "R", control_objective: "O", control_owner: "AP Team Lead", evidence: "x", frequency: "Monthly", nature: "Manual",
    control_description: "By business day 5, the AP Team Lead reviews the ageing report and investigates items above CHF 25,000. The signed report is filed on SharePoint.", ...o });

describe("sampling", () => {
  it.each([
    ["Monthly", "Manual", "monthly", 2], ["Quarterly", "Manual", "quarterly", 2], ["Annually", "Manual", "annual", 1],
    ["Weekly", "Manual", "weekly", 5], ["Daily", "IT-dependent manual", "daily", 20], ["Per transaction", "Manual", "event", 25],
    ["Daily", "Automated", "continuous", 1],
    ["Monatlich", "Manuell", "monthly", 2], ["Quartalsweise", "Manuell", "quarterly", 2], ["Täglich", "IT-gestützt manuell", "daily", 20],
    ["Pro Zahlungslauf", "Manuell", "event", 25], ["Laufend", "Automatisiert", "continuous", 1],
  ])("%s / %s → %s (%i)", (frequency, nature, freq, size) => {
    const c = ctl({ frequency, nature });
    expect(samplingFrequency(c)).toBe(freq);
    expect(sampleFor(c).size).toBe(size);
  });
  it("returns no sample size when frequency is unknown", () => {
    expect(sampleFor(ctl({ frequency: "" })).size).toBeNull();
  });
});

const llm = (id: string, quotes: (string | null)[]): LlmTestScript => ({
  control_id: id,
  population: "SAP list of month-ends",
  tod_steps: ["Inquire", "Inspect one"],
  toe_attributes: quotes.map((q, i) => ({ attribute: `attr ${i}`, procedure: "p", evidence: "e", quote: q })),
  exception_definition: "late or unsigned",
});

describe("buildTestScript", () => {
  it("letters attributes and keeps only verifiable spans", () => {
    const c = ctl({});
    const s = buildTestScript(c, buildReview(c, null, "m"), llm("T-1", ["reviews the ageing report", "a phrase not in the text", null]), "m");
    expect(s.attributes.map((a) => a.id)).toEqual(["A", "B", "C"]);
    expect(s.attributes[0].span?.text).toBe("reviews the ageing report");
    expect(s.attributes[1].span).toBeNull();
    expect(s.attributes[2].span).toBeNull();
    expect(s.toe_ready).toBe(true);
    expect(traceability([s])).toEqual({ attributes: 3, cited: 1, rate: 1 / 3 });
  });
  it("blocks ToE on high-severity design findings and on unknown frequency", () => {
    const c = ctl({ control_description: "The clerk prepares and approves the payments.", frequency: "" });
    const s = buildTestScript(c, buildReview(c, null, "m"), null, "m");
    expect(s.toe_ready).toBe(false);
    expect(s.blockers.join(" ")).toMatch(/sod_conflict/);
    expect(s.blockers.join(" ")).toMatch(/frequency/);
    expect(s.model).toBe("rules-only");
    expect(s.tod_steps.length).toBeGreaterThan(2);
  });
});

describe("generateTestScripts", () => {
  it("batches and degrades to deterministic scripts on a failed batch", async () => {
    const cs = ["A", "B", "C"].map((id) => ctl({ control_id: id }));
    const fn = vi.fn(async (items: { control: Control }[]) => {
      if (items.some((i) => i.control.control_id === "C")) throw new Error("boom");
      return items.map((i) => llm(i.control.control_id, ["reviews the ageing report"]));
    });
    const out = await generateTestScripts(cs, [], { llm: fn, model: "m", batchSize: 2 });
    expect(out.map((s) => s.model)).toEqual(["m", "m", "rules-only"]);
    expect(out[2].llm_error).toBe("boom");
  });
});

describe("testScriptBatchWithLlm", () => {
  it("sends review findings as context and uses the testscript prompt", async () => {
    const c = ctl({});
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ results: [llm("T-1", [null])] }) } }] })));
    await testScriptBatchWithLlm([{ control: c, review: { findings: [{ check: "when", severity: "med", message: "No trigger" }] } }], { apiKey: "k", fetchImpl });
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.messages[0].content).toMatch(/test of operating effectiveness/);
    expect(body.messages[1].content).toMatch(/med · when: No trigger/);
    expect(buildTestScriptMessages([{ control: c, review: null }])[1].content).toMatch(/T-1/);
  });
});

describe("committed demo test scripts", () => {
  const run = TestScriptRunSchema.parse(JSON.parse(readFileSync("data/demo-testscripts.json", "utf8")));
  const controls = loadControls(readFileSync("data/demo-rcm.xlsx"), "demo-rcm.xlsx");
  const reviews = ReviewRunSchema.parse(JSON.parse(readFileSync("data/demo-results.json", "utf8"))).reviews;
  it("covers every control, and every cited span matches the source text", () => {
    expect(run.scripts.map((s) => s.control_id)).toEqual(controls.map((c) => c.control_id));
    for (const s of run.scripts) {
      const c = controls.find((x) => x.control_id === s.control_id)!;
      for (const a of s.attributes) if (a.span) expect(c.control_description.slice(a.span.start, a.span.end)).toBe(a.span.text);
      expect(s.sample).toEqual(sampleFor(c)); // deterministic part is reproducible
    }
  });
  it("blocks ToE exactly where the review has blocking design findings", () => {
    for (const s of run.scripts) {
      const c = controls.find((x) => x.control_id === s.control_id)!;
      const r = reviews.find((x) => x.control_id === s.control_id)!;
      expect(s.toe_ready, s.control_id).toBe(buildTestScript(c, r, null, "x").toe_ready);
    }
  });
});
