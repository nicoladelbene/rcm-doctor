import { z } from "zod";
import { reviewBatchWithLlm } from "@/core/llm";
import { DEFAULT_MODEL } from "@/core/models";
import { BodyControlSchema, err, LIMITS, llmErrorResponse, ModelSchema, readGuarded } from "../_shared/limits";

export const maxDuration = 60;

const BodySchema = z.object({ model: ModelSchema, controls: z.array(BodyControlSchema).min(1).max(LIMITS.maxControls) });

/**
 * Forwards one batch to OpenRouter with the caller's own key.
 * The key arrives in the x-openrouter-key header and is never logged or stored.
 */
export async function POST(req: Request) {
  const g = await readGuarded(req);
  if (g instanceof Response) return g;
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(JSON.parse(g.text));
  } catch {
    return err(400, `Invalid request: send 1–${LIMITS.maxControls} controls, each field ≤ ${LIMITS.maxFieldChars} characters.`);
  }
  try {
    const results = await reviewBatchWithLlm(body.controls, { apiKey: g.apiKey, model: body.model || DEFAULT_MODEL, signal: req.signal, referer: new URL(req.url).origin });
    return Response.json({ results }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return llmErrorResponse(e);
  }
}
