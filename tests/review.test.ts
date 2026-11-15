import { describe, expect, it, vi } from "vitest";
import { buildReview, reviewControls, type LlmResult } from "@/core/review";
import { extractJson, reviewBatchWithLlm } from "@/core/llm";
import { ControlSchema, type Control } from "@/core/schema";
import { locateSpan } from "@/core/spans";

const ctl = (id: string, desc: string, o: Partial<Control> = {}): Control =>
  ControlSchema.parse({ control_id: id, risk_id: "R", control_objective: "O", control_owner: "AP Team Lead", evidence: "x", frequency: "Monthly", control_description: desc, ...o });

const ok = (quote: string | null = null) => ({ status: "ok" as const, quote, comment: "fine" });
const llmResult = (id: string, over: Partial<LlmResult["attributes"]> = {}): LlmResult => ({
  control_id: id,
  attributes: { who: ok("The AP Team Lead"), what: ok("reviews"), when: ok(), frequency: ok(), evidence: ok(), precision: ok(), ...over },
  automation_score: 3,
  automation_rationale: "r",
  suggested_rewrite: "rewritten",
});

describe("locateSpan", () => {
  const c = ctl("A", "The AP Team Lead reviews the  GR/IR report “monthly”.");
  it("finds exact, case-insensitive and whitespace-tolerant quotes", () => {
    expect(locateSpan(c, "control_description", "reviews")?.start).toBe(17);
    expect(locateSpan(c, "control_description", "the ap team lead")?.text).toBe("The AP Team Lead");
    expect(locateSpan(c, "control_description", "the GR/IR report")?.text).toBe("the  GR/IR report");
  });
  it("returns null for quotes that are not in the source (no hallucinated citations)", () => {
    expect(locateSpan(c, "control_description", "investigates variances above CHF 10k")).toBeNull();
    expect(locateSpan(c, "control_description", null)).toBeNull();
  });
});

describe("buildReview", () => {
  it("turns missing/weak attributes into findings with verified spans", () => {
    const c = ctl("A", "The AP Team Lead looks at the report.");
    const r = buildReview(c, llmResult("A", {
      what: { status: "weak", quote: "looks at", comment: "Vague verb." },
      evidence: { status: "missing", quote: null, comment: "No evidence." },
      precision: { status: "weak", quote: "made-up text", comment: "No threshold." },
    }), "m");
    const byCheck = Object.fromEntries(r.findings.map((f) => [f.check, f]));
    expect(byCheck.what.severity).toBe("med");
    expect(byCheck.what.evidence_span?.text).toBe("looks at");
    expect(byCheck.evidence.severity).toBe("high");
    expect(byCheck.evidence.evidence_span).toBeNull();
    expect(byCheck.precision.evidence_span).toBeNull();
    expect(r.status).toBe("fail");
    expect(r.attributes.find((a) => a.check === "who")?.span?.text).toBe("The AP Team Lead");
  });
  it("passes a clean control and keeps rule findings without an LLM", () => {
    expect(buildReview(ctl("A", "The AP Team Lead reviews."), llmResult("A"), "m").status).toBe("pass");
    const r = buildReview(ctl("B", "x", { control_owner: "" }), null, "m");
    expect(r.findings.map((f) => f.check)).toEqual(["owner_invalid"]);
    expect(r.model).toBe("rules-only");
  });
});

describe("reviewControls", () => {
  it("batches, caches and survives a failing batch", async () => {
    const controls = ["A", "B", "C", "D", "E"].map((id) => ctl(id, "The AP Team Lead reviews."));
    const llm = vi.fn(async (batch: Control[]) => {
      if (batch.some((c) => c.control_id === "E")) throw new Error("boom");
      return batch.map((c) => llmResult(c.control_id));
    });
    const cache = new Map();
    const r1 = await reviewControls(controls, { llm, model: "m", batchSize: 2, concurrency: 2, cache });
    expect(llm).toHaveBeenCalledTimes(3);
    expect(r1.map((r) => r.status)).toEqual(["pass", "pass", "pass", "pass", "pass"]);
    expect(r1[4].llm_error).toBe("boom");
    expect(r1[4].model).toBe("rules-only");
    await reviewControls(controls.slice(0, 4), { llm, model: "m", cache });
    expect(llm).toHaveBeenCalledTimes(3); // all cached
  });
});

describe("reviewBatchWithLlm", () => {
  const controls = [ctl("A", "The AP Team Lead reviews.")];
  const respond = (content: string, status = 200) =>
    new Response(status === 200 ? JSON.stringify({ choices: [{ message: { content } }] }) : JSON.stringify({ error: { message: content } }), { status });

  it("sends temperature 0 + json_schema and parses fenced JSON", async () => {
    const fetchImpl = vi.fn(async () => respond("```json\n" + JSON.stringify({ results: [llmResult("A")] }) + "\n```"));
    const out = await reviewBatchWithLlm(controls, { apiKey: "k", model: "m", fetchImpl });
    expect(out[0].control_id).toBe("A");
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.temperature).toBe(0);
    expect(body.response_format.type).toBe("json_schema");
  });
  it("retries once with the validation error, then fails", async () => {
    const fetchImpl = vi.fn(async () => respond('{"results": []}'));
    await expect(reviewBatchWithLlm(controls, { apiKey: "k", fetchImpl })).rejects.toThrow(/validation twice/);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it("downgrades to json_object when the model rejects json_schema", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(respond("response_format json_schema not supported", 400))
      .mockResolvedValueOnce(respond(JSON.stringify({ results: [llmResult("A")] })));
    await reviewBatchWithLlm(controls, { apiKey: "k", fetchImpl });
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).response_format.type).toBe("json_object");
  });
  it("surfaces auth errors", async () => {
    const fetchImpl = vi.fn(async () => respond("No auth credentials found", 401));
    await expect(reviewBatchWithLlm(controls, { apiKey: "bad", fetchImpl })).rejects.toThrow(/401/);
  });
  it("extractJson tolerates prose around JSON", () => {
    expect(extractJson('Sure! {"a":1} hope that helps')).toEqual({ a: 1 });
  });
});

describe("review.v2 SoD from the reviewer", () => {
  it("adds an AI SoD finding when rules miss it, and does not duplicate rule findings", () => {
    const c = ctl("S", "The Payroll Lead runs payroll, and is the only person who signs it off for bank release.");
    const r = buildReview(c, { ...llmResult("S"), sod_conflict: { present: true, quote: "is the only person who signs it off", comment: "Same role runs and signs off." } }, "m");
    const sod = r.findings.filter((f) => f.check === "sod_conflict");
    expect(sod).toHaveLength(1);
    expect(sod[0].source).toBe("llm");
    expect(sod[0].evidence_span?.text).toBe("is the only person who signs it off");
    const c2 = ctl("T", "The Treasury Manager prepares and approves payments.");
    const r2 = buildReview(c2, { ...llmResult("T"), sod_conflict: { present: true, quote: "prepares and approves", comment: "x" } }, "m");
    expect(r2.findings.filter((f) => f.check === "sod_conflict").map((f) => f.source)).toEqual(["rule"]);
  });
});
