/**
 * Week 3 — evidence tester ("tick & tie").
 * Evidence is normalised into a text layer: tokens with an id, text and a location (a box on a page image for
 * PDFs and screenshots, a cell for CSVs). The LLM (injected, prompt evidence.v1) assigns a result to every
 * sample item × test attribute and cites token ids plus a verbatim quote. Code keeps a citation only when the
 * quote is really in the cited tokens (or elsewhere in the same evidence, which then becomes the citation) —
 * an unverifiable box is never drawn. Client-safe: no Node or network imports.
 */
import { z } from "zod";
import type { Control } from "./schema";
import type { TestScript } from "./testscript";

export const EVIDENCE_PROMPT_VERSION = "evidence.v1";

/* ------------------------------------------------------------------ */
/* Evidence documents                                                  */
/* ------------------------------------------------------------------ */

/** Normalised box on a page: x, y, width, height as fractions of the page (0..1). */
export const BoxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);
export type Box = z.infer<typeof BoxSchema>;

export const TokenSchema = z.object({
  id: z.string(),
  text: z.string(),
  page: z.number().int().default(0),
  box: BoxSchema.nullable().default(null),
  /** CSV only: [row, col], row 0 = header. */
  cell: z.tuple([z.number().int(), z.number().int()]).nullable().default(null),
});
export type Token = z.infer<typeof TokenSchema>;

export const EvidenceKind = z.enum(["pdf", "image", "csv"]);
export type EvidenceKind = z.infer<typeof EvidenceKind>;

/**
 * Where the text layer came from — shown to the user, because it decides how much a box can be trusted.
 * generator = exact (synthetic demo); pdf-text = the PDF's own text layer (exact); csv = cells (exact);
 * model-ocr = transcribed by the vision model from a screenshot (boxes approximate).
 */
export const LayerSource = z.enum(["generator", "pdf-text", "csv", "model-ocr"]);

export const EvidenceFileSchema = z.object({
  file_id: z.string(),
  name: z.string(),
  kind: EvidenceKind,
  /** Original file (download link) when available. */
  src: z.string().optional(),
  /** Page images for pdf/image (URLs or data URLs) with their aspect ratio (height / width). */
  pages: z.array(z.object({ image: z.string().optional(), aspect: z.number() })).default([]),
  tokens: z.array(TokenSchema),
  layer: LayerSource,
});
export type EvidenceFile = z.infer<typeof EvidenceFileSchema>;

export const EvidencePackSchema = z.object({
  control_id: z.string(),
  /** The auditor's sample selection (ids as they appear on the evidence). Empty = let the agent identify items. */
  samples: z.array(z.string()),
  files: z.array(EvidenceFileSchema),
});
export type EvidencePack = z.infer<typeof EvidencePackSchema>;

/** CSV text → table + tokens (one token per cell; header is row 0). */
export function csvToFile(file_id: string, name: string, csv: string, src?: string): EvidenceFile {
  const table = parseCsv(csv);
  const tokens: Token[] = [];
  table.forEach((row, r) =>
    row.forEach((text, c) => {
      if (text.trim()) tokens.push({ id: `${file_id}-r${r}c${c}`, text, page: 0, box: null, cell: [r, c] });
    }),
  );
  return { file_id, name, kind: "csv", src, pages: [], tokens, layer: "csv" };
}

/** Minimal RFC 4180 parser (quotes, escaped quotes, CRLF); comma or semicolon separated. */
export function parseCsv(csv: string): string[][] {
  const text = csv.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** Rebuild the table of a CSV evidence file from its tokens. */
export function tableOf(file: EvidenceFile): string[][] {
  const rows: string[][] = [];
  for (const t of file.tokens) {
    if (!t.cell) continue;
    const [r, c] = t.cell;
    (rows[r] ??= [])[c] = t.text;
  }
  return Array.from(rows, (r) => Array.from(r ?? [], (c) => c ?? ""));
}

/** Text layer as the model sees it: one line per token (CSV: one line per row, cells tagged). */
export function layerForPrompt(file: EvidenceFile): string {
  if (file.kind === "csv") {
    const byRow = new Map<number, Token[]>();
    for (const t of file.tokens) byRow.set(t.cell![0], [...(byRow.get(t.cell![0]) ?? []), t]);
    return [...byRow.entries()].map(([r, ts]) => `row ${r}: ${ts.map((t) => `[${t.id}] ${t.text}`).join(" | ")}`).join("\n");
  }
  return file.tokens.map((t) => `[${t.id}] ${t.text}`).join("\n");
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

/** tick = attribute evidenced and met · exception = evidence shows it was not met · not_evidenced = cannot conclude · n_a = not applicable to this item. */
export const TickResult = z.enum(["tick", "exception", "not_evidenced", "n_a"]);
export type TickResult = z.infer<typeof TickResult>;

export const CitationSchema = z.object({
  file_id: z.string(),
  token_ids: z.array(z.string()),
  /** The verified quote, as it appears in the evidence. */
  text: z.string(),
});
export type Citation = z.infer<typeof CitationSchema>;

export const TickSchema = z.object({
  sample_id: z.string(),
  attribute_id: z.string(),
  result: TickResult,
  note: z.string(),
  /** null = nothing verifiable to point at (the quote was missing or not found in the evidence). */
  citation: CitationSchema.nullable(),
  /** The model gave a quote that is not in the evidence — shown as a warning, never as a box. */
  unverified_quote: z.string().optional(),
});
export type Tick = z.infer<typeof TickSchema>;

export const Conclusion = z.enum(["no_exceptions", "exceptions", "incomplete"]);
export type Conclusion = z.infer<typeof Conclusion>;

export const EvidenceTestSchema = z.object({
  control_id: z.string(),
  samples: z.array(z.string()),
  ticks: z.array(TickSchema),
  conclusion: Conclusion,
  summary: z.string(),
  model: z.string(),
  prompt_version: z.string(),
  llm_error: z.string().optional(),
});
export type EvidenceTest = z.infer<typeof EvidenceTestSchema>;

export const EvidenceRunSchema = z.object({
  generated_at: z.string(),
  model: z.string(),
  prompt_version: z.string(),
  source: z.string(),
  duration_seconds: z.number().optional(),
  tests: z.array(EvidenceTestSchema),
});
export type EvidenceRun = z.infer<typeof EvidenceRunSchema>;

/** What the LLM returns per control (see llm.ts). sample_id "ALL" = a once-per-control attribute. */
export interface LlmEvidenceResult {
  control_id: string;
  samples: string[];
  items: { sample_id: string; attribute_id: string; result: TickResult; refs: string[]; quote: string | null; note: string }[];
  summary: string;
}

/* ------------------------------------------------------------------ */
/* Verification                                                        */
/* ------------------------------------------------------------------ */

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[“”„"]/g, '"')
    .replace(/[‘’`]/g, "'")
    .replace(/[\s ]+/g, " ")
    .trim();
const stripQuote = (q: string) => q.trim().replace(/^["'“”‘’]+|["'“”‘’.]+$/g, "");

/**
 * Turn the model's refs + quote into a verified citation, or null.
 * 1) the quote is inside the cited tokens (in order) → keep those tokens;
 * 2) otherwise the quote is found elsewhere in the pack (one token, or a run of consecutive tokens) → cite that;
 * 3) otherwise → null (the quote is reported as unverified).
 */
export function verifyCitation(pack: EvidencePack, refs: string[], quote: string | null): Citation | null {
  if (!quote || !stripQuote(quote)) return null;
  const q = norm(stripQuote(quote));
  const byId = new Map(pack.files.flatMap((f) => f.tokens.map((t) => [t.id, { t, f }] as const)));

  const cited = refs.map((r) => byId.get(r)).filter(Boolean) as { t: Token; f: EvidenceFile }[];
  if (cited.length) {
    const sameFile = cited.filter((c) => c.f.file_id === cited[0].f.file_id);
    const joined = norm(sameFile.map((c) => c.t.text).join(" "));
    if (joined.includes(q)) {
      // Narrow to the tokens that actually carry part of the quote.
      const carrying = sameFile.filter((c) => q.includes(norm(c.t.text)) || norm(c.t.text).includes(q));
      const use = carrying.length ? carrying : sameFile;
      return { file_id: use[0].f.file_id, token_ids: use.map((c) => c.t.id), text: stripQuote(quote) };
    }
  }

  for (const f of pack.files) {
    const ts = f.tokens;
    for (let i = 0; i < ts.length; i++) {
      if (norm(ts[i].text).includes(q)) return { file_id: f.file_id, token_ids: [ts[i].id], text: stripQuote(quote) };
      // Runs of up to 6 consecutive tokens (a sentence split over spans, or adjacent CSV cells).
      // The match must start inside token i, so the run is minimal on the left.
      const first = norm(ts[i].text);
      let acc = first;
      for (let j = i + 1; j < Math.min(ts.length, i + 6); j++) {
        acc += " " + norm(ts[j].text);
        const at = acc.indexOf(q);
        if (at >= 0 && at < first.length) return { file_id: f.file_id, token_ids: ts.slice(i, j + 1).map((t) => t.id), text: stripQuote(quote) };
      }
    }
  }
  return null;
}

/** Conclusion computed by code: any exception → exceptions; any not-evidenced → incomplete. */
export function concludeTicks(ticks: Tick[]): Conclusion {
  if (ticks.some((t) => t.result === "exception")) return "exceptions";
  if (ticks.some((t) => t.result === "not_evidenced")) return "incomplete";
  return "no_exceptions";
}

export const CONCLUSION_LABELS: Record<Conclusion, string> = {
  no_exceptions: "No exceptions noted",
  exceptions: "Exceptions noted",
  incomplete: "Incomplete — evidence missing",
};

/**
 * Merge the model's answer with the pack and the test script: expand "ALL" to every sample, keep only
 * known sample/attribute ids, fill gaps as not_evidenced, verify every citation.
 */
export function buildEvidenceTest(pack: EvidencePack, script: TestScript, llm: LlmEvidenceResult | null, model: string, llmError?: string): EvidenceTest {
  const attrIds = script.attributes.map((a) => a.id);
  const samples = pack.samples.length ? pack.samples : (llm?.samples ?? []).slice(0, 50);
  const ticks: Tick[] = [];
  const seen = new Set<string>();
  for (const it of llm?.items ?? []) {
    if (!attrIds.includes(it.attribute_id)) continue;
    const targets = it.sample_id === "ALL" ? samples : samples.includes(it.sample_id) ? [it.sample_id] : [];
    for (const s of targets) {
      const key = `${s}|${it.attribute_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const citation = it.result === "n_a" ? null : verifyCitation(pack, it.refs, it.quote);
      ticks.push({
        sample_id: s,
        attribute_id: it.attribute_id,
        result: it.result,
        note: it.note,
        citation,
        ...(it.quote && !citation && it.result !== "n_a" ? { unverified_quote: it.quote } : {}),
      });
    }
  }
  if (llm) {
    for (const s of samples)
      for (const a of attrIds)
        if (!seen.has(`${s}|${a}`)) ticks.push({ sample_id: s, attribute_id: a, result: "not_evidenced", note: "No result returned for this item.", citation: null });
  }
  const order = (t: Tick) => samples.indexOf(t.sample_id) * 100 + attrIds.indexOf(t.attribute_id);
  ticks.sort((a, b) => order(a) - order(b));
  return {
    control_id: pack.control_id,
    samples,
    ticks,
    conclusion: llm ? concludeTicks(ticks) : "incomplete",
    summary: llm?.summary ?? "Tick & tie needs an AI run (add an OpenRouter key). The evidence text layer is shown below.",
    model: llm ? model : "none",
    prompt_version: llm ? EVIDENCE_PROMPT_VERSION : "none",
    ...(llmError ? { llm_error: llmError } : {}),
  };
}

/** Boxes to draw for a citation, grouped by page (pdf/image only). */
export function citationBoxes(pack: EvidencePack, c: Citation | null): { page: number; box: Box }[] {
  if (!c) return [];
  const f = pack.files.find((x) => x.file_id === c.file_id);
  if (!f) return [];
  const ts = f.tokens.filter((t) => c.token_ids.includes(t.id) && t.box);
  const byPage = new Map<number, Box[]>();
  for (const t of ts) byPage.set(t.page, [...(byPage.get(t.page) ?? []), t.box!]);
  // One box per line: merge boxes on the same page whose vertical centres are close.
  const out: { page: number; box: Box }[] = [];
  for (const [page, boxes] of byPage) {
    const lines: Box[] = [];
    for (const b of [...boxes].sort((a, z) => a[1] - z[1] || a[0] - z[0])) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last[1] + last[3] / 2 - (b[1] + b[3] / 2)) < Math.max(last[3], b[3]) * 0.6) {
        const x0 = Math.min(last[0], b[0]);
        const y0 = Math.min(last[1], b[1]);
        const x1 = Math.max(last[0] + last[2], b[0] + b[2]);
        const y1 = Math.max(last[1] + last[3], b[1] + b[3]);
        lines[lines.length - 1] = [x0, y0, x1 - x0, y1 - y0];
      } else lines.push(b);
    }
    for (const box of lines) out.push({ page, box });
  }
  return out;
}

/** Share of tick/exception results with a verified citation (traceability metric). */
export function evidenceTraceability(tests: EvidenceTest[]) {
  const relevant = tests.flatMap((t) => t.ticks).filter((t) => t.result === "tick" || t.result === "exception");
  const cited = relevant.filter((t) => t.citation).length;
  return { results: relevant.length, cited, rate: relevant.length ? cited / relevant.length : 0 };
}

/* ------------------------------------------------------------------ */
/* Eval                                                                */
/* ------------------------------------------------------------------ */

/** Ground truth per control: every planted exception (with the tokens that prove it). Everything else is not an exception. */
export type EvidenceGroundTruth = Record<
  string,
  { samples: string[]; exceptions: { sample_id: string; attribute_id: string; tokens: string[]; why: string }[]; not_evidenced?: { sample_id: string; attribute_id: string }[] }
>;

export interface EvidenceEvalReport {
  controls: number;
  cells: number;
  planted: number;
  detected: number;
  /** Detected with a box on (one of) the proving tokens. */
  detectedWithBox: number;
  recall: number;
  cleanCells: number;
  falseExceptions: number;
  falseExceptionRate: number;
  /** Clean cells the agent could not conclude on (not_evidenced): work for a human, not an error. */
  unresolved: number;
  conclusionsCorrect: number;
  traceability: { results: number; cited: number; rate: number };
  perControl: { control_id: string; expected: Conclusion; got: Conclusion; planted: number; detected: number; falseExceptions: number; unresolved: number }[];
  misses: string[];
  extras: string[];
}

export function evaluateEvidence(tests: EvidenceTest[], truth: EvidenceGroundTruth, attributesByControl: Record<string, string[]>): EvidenceEvalReport {
  let cells = 0, planted = 0, detected = 0, detectedWithBox = 0, cleanCells = 0, falseExceptions = 0, unresolved = 0, conclusionsCorrect = 0;
  const perControl: EvidenceEvalReport["perControl"] = [];
  const misses: string[] = [];
  const extras: string[] = [];
  for (const [cid, gt] of Object.entries(truth)) {
    const test = tests.find((t) => t.control_id === cid);
    const attrs = attributesByControl[cid] ?? [];
    let pc = 0, dc = 0, fc = 0, uc = 0;
    for (const s of gt.samples)
      for (const a of attrs) {
        cells++;
        const tick = test?.ticks.find((t) => t.sample_id === s && t.attribute_id === a);
        const exp = gt.exceptions.find((e) => e.sample_id === s && e.attribute_id === a);
        const expectedNe = gt.not_evidenced?.some((e) => e.sample_id === s && e.attribute_id === a);
        if (exp) {
          planted++;
          pc++;
          if (tick?.result === "exception") {
            detected++;
            dc++;
            if (tick.citation?.token_ids.some((id) => exp.tokens.includes(id))) detectedWithBox++;
          } else misses.push(`${cid} ${s} ${a}: expected exception (${exp.why}), got ${tick?.result ?? "nothing"}`);
        } else {
          cleanCells++;
          if (tick?.result === "exception") {
            falseExceptions++;
            fc++;
            extras.push(`${cid} ${s} ${a}: false exception — ${tick.note}`);
          } else if (tick?.result === "not_evidenced" && !expectedNe) {
            unresolved++;
            uc++;
          }
        }
      }
    const expected: Conclusion = gt.exceptions.length ? "exceptions" : gt.not_evidenced?.length ? "incomplete" : "no_exceptions";
    const got = test?.conclusion ?? "incomplete";
    if (expected === got) conclusionsCorrect++;
    perControl.push({ control_id: cid, expected, got, planted: pc, detected: dc, falseExceptions: fc, unresolved: uc });
  }
  return {
    controls: Object.keys(truth).length,
    cells,
    planted,
    detected,
    detectedWithBox,
    recall: planted ? detected / planted : 1,
    cleanCells,
    falseExceptions,
    falseExceptionRate: cleanCells ? falseExceptions / cleanCells : 0,
    unresolved,
    conclusionsCorrect,
    traceability: evidenceTraceability(tests.filter((t) => t.control_id in truth)),
    perControl,
    misses,
    extras,
  };
}

/** Controls as the evidence prompt sees them. */
export function controlForEvidencePrompt(c: Control, script: TestScript) {
  return {
    control_id: c.control_id,
    control_description: c.control_description,
    frequency: c.frequency,
    test_attributes: script.attributes.map((a) => ({ id: a.id, verify_that: a.attribute, procedure: a.procedure, expected_evidence: a.evidence })),
    exception_definition: script.exception_definition,
  };
}
