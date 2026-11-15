import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildEvidenceTest,
  citationBoxes,
  concludeTicks,
  csvToFile,
  EvidencePackSchema,
  EvidenceRunSchema,
  evaluateEvidence,
  layerForPrompt,
  parseCsv,
  tableOf,
  verifyCitation,
  type EvidenceFile,
  type EvidenceGroundTruth,
  type EvidencePack,
  type LlmEvidenceResult,
} from "@/core/evidence";
import { buildEvidenceMessages } from "@/core/llm";
import { loadControls } from "@/core/parse";
import { TestScriptRunSchema, type TestScript } from "@/core/testscript";

const pdf: EvidenceFile = {
  file_id: "F1",
  name: "form.pdf",
  kind: "pdf",
  pages: [{ aspect: 1.414 }],
  layer: "generator",
  tokens: [
    { id: "F1-t1", text: "Bank confirmation received", page: 0, box: [0.1, 0.5, 0.3, 0.02], cell: null },
    { id: "F1-t2", text: "10.06.2026", page: 0, box: [0.5, 0.5, 0.1, 0.02], cell: null },
    { id: "F1-t3", text: "Bank account register updated", page: 0, box: [0.1, 0.53, 0.3, 0.02], cell: null },
    { id: "F1-t4", text: "18.06.2026", page: 0, box: [0.5, 0.53, 0.1, 0.02], cell: null },
  ],
};
const csv = csvToFile("F2", "log.csv", 'je,amount,approver\n100033,"1,412,500.00",AM_FREI\n100037,"33,750.00",AM_GASSER\n');
const pack: EvidencePack = { control_id: "TRE-01", samples: ["S1", "S2"], files: [pdf, csv] };
const script = { attributes: [{ id: "A" }, { id: "B" }] } as unknown as TestScript;

describe("csv", () => {
  it("parses quotes, escaped quotes, semicolons and CRLF", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([["a", "b"], ["x, y", 'say "hi"']]);
    expect(parseCsv("a;b;c\n1;2,5;3\n")).toEqual([["a", "b", "c"], ["1", "2,5", "3"]]);
  });
  it("turns cells into tokens and back", () => {
    expect(csv.tokens.find((t) => t.text === "1,412,500.00")).toMatchObject({ id: "F2-r1c1", cell: [1, 1] });
    expect(tableOf(csv)[1]).toEqual(["100033", "1,412,500.00", "AM_FREI"]);
    expect(layerForPrompt(csv)).toContain("row 1: [F2-r1c0] 100033 | [F2-r1c1] 1,412,500.00");
  });
});

describe("verifyCitation — a box is drawn only where the quote really is", () => {
  it("keeps the cited tokens that carry the quote", () => {
    expect(verifyCitation(pack, ["F1-t3", "F1-t4"], "18.06.2026")).toEqual({ file_id: "F1", token_ids: ["F1-t4"], text: "18.06.2026" });
  });
  it("relocates a quote cited with the wrong id", () => {
    expect(verifyCitation(pack, ["F1-t2"], "1,412,500.00")).toEqual({ file_id: "F2", token_ids: ["F2-r1c1"], text: "1,412,500.00" });
  });
  it("finds a quote spanning consecutive tokens", () => {
    expect(verifyCitation(pack, [], "Bank account register updated 18.06.2026")?.token_ids).toEqual(["F1-t3", "F1-t4"]);
  });
  it("is case/whitespace tolerant and strips quote marks", () => {
    expect(verifyCitation(pack, ["F1-t1"], "“bank  confirmation received”")?.token_ids).toEqual(["F1-t1"]);
  });
  it("returns null for an invented quote or none", () => {
    expect(verifyCitation(pack, ["F1-t4"], "19.06.2026")).toBeNull();
    expect(verifyCitation(pack, ["F1-t4"], null)).toBeNull();
  });
});

describe("buildEvidenceTest", () => {
  const llm: LlmEvidenceResult = {
    control_id: "TRE-01",
    samples: [],
    summary: "One exception.",
    items: [
      { sample_id: "S1", attribute_id: "A", result: "exception", refs: ["F1-t4"], quote: "18.06.2026", note: "6 business days" },
      { sample_id: "ALL", attribute_id: "B", result: "tick", refs: ["F2-r1c2"], quote: "AM_FREI", note: "config" },
      { sample_id: "S2", attribute_id: "A", result: "tick", refs: ["F1-t2"], quote: "invented text", note: "x" },
      { sample_id: "S9", attribute_id: "A", result: "exception", refs: [], quote: null, note: "unknown sample is dropped" },
      { sample_id: "S1", attribute_id: "Z", result: "exception", refs: [], quote: null, note: "unknown attribute is dropped" },
    ],
  };
  const t = buildEvidenceTest(pack, script, llm, "m");
  it("expands ALL, drops unknown ids, verifies citations", () => {
    expect(t.ticks.map((x) => `${x.sample_id}${x.attribute_id}:${x.result}`)).toEqual(["S1A:exception", "S1B:tick", "S2A:tick", "S2B:tick"]);
    expect(t.ticks[0].citation?.token_ids).toEqual(["F1-t4"]);
    expect(t.ticks[2].citation).toBeNull();
    expect(t.ticks[2].unverified_quote).toBe("invented text");
    expect(t.conclusion).toBe("exceptions");
  });
  it("fills missing results as not evidenced; no LLM = incomplete", () => {
    const partial = buildEvidenceTest(pack, script, { ...llm, items: [llm.items[1]] }, "m");
    expect(partial.ticks.filter((x) => x.result === "not_evidenced")).toHaveLength(2);
    expect(partial.conclusion).toBe("incomplete");
    expect(buildEvidenceTest(pack, script, null, "none")).toMatchObject({ ticks: [], conclusion: "incomplete" });
  });
  it("conclusion is computed by code", () => {
    expect(concludeTicks([])).toBe("no_exceptions");
  });
  it("merges boxes on one line", () => {
    const boxes = citationBoxes(pack, { file_id: "F1", token_ids: ["F1-t3", "F1-t4"], text: "" });
    expect(boxes).toHaveLength(1);
    expect(boxes[0].box[0]).toBeCloseTo(0.1);
    expect(boxes[0].box[2]).toBeCloseTo(0.5);
  });
});

describe("evidence prompt", () => {
  it("sends the text layer with ids and attaches screenshots as images", () => {
    const controls = loadControls(readFileSync("data/demo-rcm.xlsx"), "demo-rcm.xlsx");
    const scripts = TestScriptRunSchema.parse(JSON.parse(readFileSync("data/demo-testscripts.json", "utf8"))).scripts;
    const control = controls.find((c) => c.control_id === "TRE-01")!;
    const s = scripts.find((x) => x.control_id === "TRE-01")!;
    const img: EvidenceFile = { file_id: "F3", name: "s.png", kind: "image", pages: [{ image: "data:image/png;base64,AAAA", aspect: 0.5 }], tokens: [], layer: "model-ocr" };
    const msgs = buildEvidenceMessages({ control, script: s, pack: { ...pack, files: [pdf, img] } });
    const content = msgs[1].content as { type: string; text?: string }[];
    expect(content[0].text).toContain("[F1-t4] 18.06.2026");
    expect(content[0].text).toContain('"verify_that"');
    expect(content[1].type).toBe("image_url");
  });
});

describe("committed demo evidence", () => {
  const packs = EvidencePackSchema.array().parse(JSON.parse(readFileSync("data/evidence/packs.json", "utf8")));
  const truth: EvidenceGroundTruth = JSON.parse(readFileSync("data/evidence/ground-truth.json", "utf8"));
  const run = EvidenceRunSchema.parse(JSON.parse(readFileSync("data/demo-evidence-results.json", "utf8")));
  const scripts = TestScriptRunSchema.parse(JSON.parse(readFileSync("data/demo-testscripts.json", "utf8"))).scripts;

  it("has 5 controls, 2 with planted exceptions whose proof tokens exist", () => {
    expect(packs).toHaveLength(5);
    expect(Object.values(truth).filter((t) => t.exceptions.length)).toHaveLength(2);
    for (const [cid, gt] of Object.entries(truth))
      for (const e of gt.exceptions) {
        const ids = new Set(packs.find((p) => p.control_id === cid)!.files.flatMap((f) => f.tokens.map((t) => t.id)));
        expect(e.tokens.every((id) => ids.has(id))).toBe(true);
      }
  });
  it("every citation in the committed run points at existing tokens whose text contains the quote", () => {
    for (const t of run.tests) {
      const pack = packs.find((p) => p.control_id === t.control_id)!;
      for (const tick of t.ticks)
        if (tick.citation) {
          const text = pack.files.flatMap((f) => f.tokens).filter((x) => tick.citation!.token_ids.includes(x.id)).map((x) => x.text).join(" ");
          expect(text.toLowerCase().replace(/\s+/g, " ")).toContain(tick.citation.text.toLowerCase().replace(/\s+/g, " "));
        }
    }
  });
  it("passes the eval gate", () => {
    const r = evaluateEvidence(run.tests, truth, Object.fromEntries(scripts.map((s) => [s.control_id, s.attributes.map((a) => a.id)])));
    expect(r.recall).toBe(1);
    expect(r.falseExceptionRate).toBeLessThanOrEqual(0.05);
    expect(r.traceability.rate).toBeGreaterThanOrEqual(0.9);
  });
});
