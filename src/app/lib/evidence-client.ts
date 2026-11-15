"use client";
import { buildEvidenceTest, csvToFile, type EvidenceFile, type EvidencePack, type EvidenceTest, type LlmEvidenceResult, type Token } from "@/core/evidence";
import type { Control } from "@/core/schema";
import type { TestScript } from "@/core/testscript";

export const EVIDENCE_LIMITS = { maxFiles: 3, maxPdfPages: 6, maxFileBytes: 8_000_000 } as const;

/**
 * Turn uploaded files into evidence files, entirely in the browser (nothing is uploaded at this step):
 * CSV → cells · PDF → page images + the PDF's own text layer (pdf.js) · image → downscaled image, text layer
 * filled later by the vision model (approximate boxes). A PDF without a text layer is treated as page images.
 */
export async function ingestFiles(files: File[]): Promise<EvidenceFile[]> {
  const out: EvidenceFile[] = [];
  for (const [i, f] of files.slice(0, EVIDENCE_LIMITS.maxFiles).entries()) {
    if (f.size > EVIDENCE_LIMITS.maxFileBytes) throw new Error(`${f.name} is larger than 8 MB.`);
    const file_id = `F${i + 1}`;
    const name = f.name;
    if (/\.csv$/i.test(name) || f.type === "text/csv") out.push(csvToFile(file_id, name, await f.text()));
    else if (/\.pdf$/i.test(name) || f.type === "application/pdf") out.push(await pdfToFile(file_id, name, await f.arrayBuffer()));
    else if (f.type.startsWith("image/")) {
      const { url, aspect } = await downscale(await blobToDataUrl(f), 1600);
      out.push({ file_id, name, kind: "image", pages: [{ image: url, aspect }], tokens: [], layer: "model-ocr" });
    } else throw new Error(`${name}: use PDF, PNG/JPG or CSV.`);
  }
  return out;
}

async function pdfToFile(file_id: string, name: string, data: ArrayBuffer): Promise<EvidenceFile> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const pages: EvidenceFile["pages"] = [];
  const tokens: Token[] = [];
  for (let p = 1; p <= Math.min(doc.numPages, EVIDENCE_LIMITS.maxPdfPages); p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    await page.render({ canvas, viewport: vp }).promise;
    pages.push({ image: canvas.toDataURL("image/jpeg", 0.85), aspect: vp.height / vp.width });
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      if (!("str" in it) || !it.str.trim()) continue;
      const tx = pdfjs.Util.transform(vp.transform, it.transform);
      const h = Math.hypot(tx[2], tx[3]);
      const w = it.width * vp.scale;
      tokens.push({ id: `${file_id}-t${tokens.length + 1}`, text: it.str.trim(), page: p - 1, box: [tx[4] / vp.width, (tx[5] - h) / vp.height, w / vp.width, (h * 1.15) / vp.height], cell: null });
    }
  }
  // Scanned PDF (no text layer): let the vision model transcribe the first page.
  if (!tokens.length) return { file_id, name, kind: "image", pages: pages.slice(0, 1), tokens: [], layer: "model-ocr" };
  return { file_id, name, kind: "pdf", pages, tokens, layer: "pdf-text" };
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });
}

async function downscale(url: string, maxW: number): Promise<{ url: string; aspect: number }> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const scale = Math.min(1, maxW / img.naturalWidth);
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return { url: c.toDataURL("image/jpeg", 0.85), aspect: img.naturalHeight / img.naturalWidth };
}

/** Sends the text layer (and screenshots) to /api/evidence with the caller's key; verifies citations locally. */
export async function runEvidenceTest(
  control: Control,
  script: TestScript,
  pack: EvidencePack,
  opts: { apiKey: string; model: string; signal?: AbortSignal },
): Promise<{ pack: EvidencePack; test: EvidenceTest }> {
  // PDF page images stay in the browser; only screenshots are sent (the model needs the pixels).
  const slim = { ...pack, files: pack.files.map((f) => (f.kind === "image" ? f : { ...f, pages: f.pages.map((p) => ({ aspect: p.aspect })) })) };
  const res = await fetch("/api/evidence", {
    method: "POST",
    signal: opts.signal,
    headers: { "Content-Type": "application/json", "x-openrouter-key": opts.apiKey },
    body: JSON.stringify({ model: opts.model, control, script, pack: slim }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Evidence test failed (${res.status})`);
  const { result, tokens } = json as { result: LlmEvidenceResult; tokens: Record<string, Token[]> };
  // Screenshot text layers come back from the model; keep the local page images.
  const merged: EvidencePack = { ...pack, files: pack.files.map((f) => (tokens[f.file_id] ? { ...f, tokens: tokens[f.file_id] } : f)) };
  return { pack: merged, test: buildEvidenceTest(merged, script, result, opts.model) };
}

/** Without a key: show the evidence and its text layer, no tick & tie. */
export function offlineEvidenceTest(script: TestScript, pack: EvidencePack): EvidenceTest {
  return buildEvidenceTest(pack, script, null, "none");
}
