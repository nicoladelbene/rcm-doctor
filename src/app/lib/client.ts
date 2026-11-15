"use client";
import { cacheKey, reviewControls, type LlmResult } from "@/core/review";
import type { Control, Review } from "@/core/schema";
import { generateTestScripts, type LlmTestScript, type TestScript } from "@/core/testscript";

const LS_PREFIX = "rcm-doctor:llm:";

/** Small localStorage-backed cache of LLM results (results only — never the API key). */
class LocalCache extends Map<string, LlmResult> {
  get(k: string) {
    const hit = super.get(k);
    if (hit) return hit;
    try {
      const raw = localStorage.getItem(LS_PREFIX + k);
      if (raw) {
        const v = JSON.parse(raw) as LlmResult;
        super.set(k, v);
        return v;
      }
    } catch {}
    return undefined;
  }
  set(k: string, v: LlmResult) {
    super.set(k, v);
    try {
      localStorage.setItem(LS_PREFIX + k, JSON.stringify(v));
    } catch {}
    return this;
  }
}
const cache = new LocalCache();

export async function runReview(
  controls: Control[],
  opts: { apiKey?: string; model: string; onProgress?: (done: Review[], total: number) => void; signal?: AbortSignal },
): Promise<Review[]> {
  if (!opts.apiKey) return reviewControls(controls, { onProgress: opts.onProgress });
  const llm = async (batch: Control[]) => {
    const res = await fetch("/api/review", {
      method: "POST",
      signal: opts.signal,
      headers: { "Content-Type": "application/json", "x-openrouter-key": opts.apiKey! },
      body: JSON.stringify({ model: opts.model, controls: batch }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? `Review failed (${res.status})`);
    return json.results as LlmResult[];
  };
  return reviewControls(controls, { llm, model: opts.model, batchSize: 5, concurrency: 3, cache, onProgress: opts.onProgress });
}

export { cacheKey };

/** Week 2: test scripts. Without a key only the deterministic part (sample size, blockers) is produced. */
export async function runTestScripts(
  controls: Control[],
  reviews: Review[],
  opts: { apiKey?: string; model: string; onProgress?: (done: number, total: number) => void; signal?: AbortSignal },
): Promise<TestScript[]> {
  if (!opts.apiKey) return generateTestScripts(controls, reviews, { onProgress: opts.onProgress });
  const llm = async (items: { control: Control; review: Review | null }[]) => {
    const res = await fetch("/api/testscript", {
      method: "POST",
      signal: opts.signal,
      headers: { "Content-Type": "application/json", "x-openrouter-key": opts.apiKey! },
      body: JSON.stringify({
        model: opts.model,
        items: items.map((i) => ({ control: i.control, review: i.review ? { findings: i.review.findings.map((f) => ({ check: f.check, severity: f.severity, message: f.message })) } : null })),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? `Test-script generation failed (${res.status})`);
    return json.results as LlmTestScript[];
  };
  return generateTestScripts(controls, reviews, { llm, model: opts.model, batchSize: 5, concurrency: 3, onProgress: opts.onProgress });
}

export async function downloadReport(controls: Control[], reviews: Review[], source: string, scripts?: TestScript[]) {
  const { buildReportXlsx } = await import("@/core/export");
  const bytes = buildReportXlsx(controls, reviews, { source }, scripts);
  const blob = new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const name = `rcm-review-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}
