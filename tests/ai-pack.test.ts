import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadControls } from "@/core/parse";
import { ReviewRunSchema } from "@/core/schema";
import { TestScriptRunSchema } from "@/core/testscript";

/** Only references verified on the web on 2026-11-15 (docs/research/ai-governance-references.md) may appear. */
const VERIFIED = {
  euAiAct: new Set(["Art. 3(49)", "Art. 4", "Art. 5(1)", "Art. 6(2) + Annex III", "Art. 10(2)(f)", "Art. 10(3)", "Art. 12(1)", "Art. 14(4)(d)", "Art. 14(4)(e)", "Art. 15(1)", "Art. 25(1)(b)", "Art. 26(2)", "Art. 26(4)", "Art. 26(5)", "Art. 26(6)", "Art. 26(11)", "Art. 27(1)", "Art. 50(1)", "Art. 73(2)"]),
  iso42001: new Set(["A.2.2", "A.2.4", "A.3.2", "A.3.3", "A.4.2", "A.4.6", "A.5.2", "A.5.3", "A.5.4", "A.6.2.4", "A.6.2.5", "A.6.2.6", "A.6.2.7", "A.6.2.8", "A.7.2", "A.7.3", "A.7.4", "A.7.5", "A.8.2", "A.8.4", "A.9.2", "A.10.2", "A.10.3"]),
  nistAiRmf: new Set(["GOVERN 1.5", "GOVERN 1.6", "GOVERN 2.1", "GOVERN 2.2", "GOVERN 3.2", "GOVERN 4.3", "GOVERN 5.1", "GOVERN 6.1", "GOVERN 6.2", "MAP 1.1", "MAP 1.5", "MAP 3.4", "MAP 3.5", "MAP 4.1", "MAP 5.1", "MEASURE 2.1", "MEASURE 2.3", "MEASURE 2.4", "MEASURE 2.8", "MEASURE 2.9", "MEASURE 2.10", "MEASURE 2.11", "MEASURE 3.1", "MANAGE 2.4", "MANAGE 3.1", "MANAGE 4.1", "MANAGE 4.3"]),
  finma: new Set(["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7"]),
};

describe("AI systems controls pack", () => {
  const controls = loadControls(readFileSync("data/ai-pack-rcm.xlsx"), "ai-pack-rcm.xlsx");
  const mappings: Record<string, Record<keyof typeof VERIFIED, string>> = JSON.parse(readFileSync("data/ai-pack.mappings.json", "utf8"));

  it("has ~25 controls covering the six areas, each mapped to at least one framework", () => {
    expect(controls.length).toBeGreaterThanOrEqual(24);
    expect(new Set(controls.map((c) => c.process))).toEqual(
      new Set(["AI governance", "AI data", "AI human oversight", "AI monitoring", "AI third parties", "AI logging and incidents"]),
    );
    for (const c of controls) expect(Object.values(mappings[c.control_id]).some(Boolean)).toBe(true);
  });

  it("uses only verified references (empty is allowed, invented is not)", () => {
    for (const [id, m] of Object.entries(mappings))
      for (const k of Object.keys(VERIFIED) as (keyof typeof VERIFIED)[])
        for (const ref of m[k].split(";").map((s) => s.trim()).filter(Boolean)) expect(VERIFIED[k].has(ref), `${id} ${k} ${ref}`).toBe(true);
  });

  it("went through the same pipeline: review and test script for every control", () => {
    const run = ReviewRunSchema.parse(JSON.parse(readFileSync("data/ai-pack-results.json", "utf8")));
    const scripts = TestScriptRunSchema.parse(JSON.parse(readFileSync("data/ai-pack-testscripts.json", "utf8"))).scripts;
    expect(run.reviews.map((r) => r.control_id)).toEqual(controls.map((c) => c.control_id));
    expect(scripts.map((s) => s.control_id)).toEqual(controls.map((c) => c.control_id));
    for (const r of run.reviews) expect(r.automation_score).toBeGreaterThanOrEqual(0);
  });
});
