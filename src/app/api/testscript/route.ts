import { z } from "zod";
import { testScriptBatchWithLlm } from "@/core/llm";
import { DEFAULT_MODEL } from "@/core/models";
import { BodyControlSchema, err, LIMITS, llmErrorResponse, ModelSchema, readGuarded } from "../_shared/limits";

export const maxDuration = 60;

const FindingIn = z.object({ check: z.string().max(40), severity: z.string().max(10), message: z.string().max(LIMITS.maxFieldChars) });
const BodySchema = z.object({
  model: ModelSchema,
  items: z
    .array(z.object({ control: BodyControlSchema, review: z.object({ findings: z.array(FindingIn).max(30) }).nullable().default(null) }))
    .min(1)
    .max(LIMITS.maxControls),
});

/** Week 2: drafts test scripts for one batch with the caller's own OpenRouter key (never logged or stored). */
export async function POST(req: Request) {
  const g = await readGuarded(req);
  if (g instanceof Response) return g;
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(JSON.parse(g.text));
  } catch {
    return err(400, `Invalid request: send 1–${LIMITS.maxControls} items, each field ≤ ${LIMITS.maxFieldChars} characters.`);
  }
  try {
    const results = await testScriptBatchWithLlm(body.items, { apiKey: g.apiKey, model: body.model || DEFAULT_MODEL, signal: req.signal, referer: new URL(req.url).origin });
    return Response.json({ results }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return llmErrorResponse(e);
  }
}
