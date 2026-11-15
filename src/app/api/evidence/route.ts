import { z } from "zod";
import { EvidencePackSchema, type Token } from "@/core/evidence";
import { evidenceWithLlm, transcribeImage } from "@/core/llm";
import { DEFAULT_MODEL } from "@/core/models";
import { TestScriptSchema } from "@/core/testscript";
import { BodyControlSchema, err, llmErrorResponse, ModelSchema } from "../_shared/limits";

/** Screenshots take two model calls (transcription, then tick & tie): allow up to 2 minutes. */
export const maxDuration = 120;

/**
 * Evidence requests may carry screenshots, so this route allows more than the 200 KB of the others. The browser
 * compresses screenshots to ≤ 2.4 MB of binary in total (≈ 3.2 MB as base64); 3.5 MB stays well under Vercel's 4.5 MB.
 */
const MAX_BYTES = 3_500_000;
const BodySchema = z.object({
  model: ModelSchema,
  control: BodyControlSchema,
  script: TestScriptSchema,
  pack: EvidencePackSchema.refine((p) => p.files.length >= 1 && p.files.length <= 3, "1–3 files")
    .refine((p) => p.files.reduce((n, f) => n + f.tokens.length, 0) <= 4000, "text layer too large")
    .refine((p) => p.samples.length <= 50, "max 50 samples"),
});

/** Week 3: tick & tie one control's evidence with the caller's own OpenRouter key (never logged or stored). */
export async function POST(req: Request) {
  const apiKey = req.headers.get("x-openrouter-key")?.trim();
  if (!apiKey) return err(401, "Missing OpenRouter API key.");
  if (!/^[\w-]{20,200}$/.test(apiKey)) return err(400, "That does not look like an OpenRouter API key.");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) return err(413, "Evidence too large (max ~3.5 MB per request; use fewer or smaller screenshots).");
  const text = await req.text();
  if (Buffer.byteLength(text) > MAX_BYTES) return err(413, "Evidence too large (max ~3.5 MB per request; use fewer or smaller screenshots).");
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(JSON.parse(text));
  } catch (e) {
    return err(400, `Invalid request: ${(e as Error).message.slice(0, 200)}`);
  }
  const opts = { apiKey, model: body.model || DEFAULT_MODEL, signal: req.signal, referer: new URL(req.url).origin };
  try {
    // Screenshots without a text layer: transcribe first (approximate boxes, flagged model-ocr).
    const tokens: Record<string, Token[]> = {};
    const files = await Promise.all(
      body.pack.files.map(async (f) => {
        if (f.kind !== "image" || f.tokens.length || !f.pages[0]?.image?.startsWith("data:image/")) return f;
        const lines = await transcribeImage(f.pages[0].image, opts);
        tokens[f.file_id] = lines.map((l, i) => ({ id: `${f.file_id}-t${i + 1}`, text: l.text, page: 0, box: l.box, cell: null }));
        return { ...f, tokens: tokens[f.file_id] };
      }),
    );
    const result = await evidenceWithLlm({ control: body.control, script: body.script, pack: { ...body.pack, files } }, opts);
    return Response.json({ result, tokens }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return llmErrorResponse(e);
  }
}
