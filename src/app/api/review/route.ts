import { z } from "zod";
import { LlmError, reviewBatchWithLlm } from "@/core/llm";
import { DEFAULT_MODEL } from "@/core/models";
import { ControlSchema } from "@/core/schema";

export const maxDuration = 60;

/** Input limits: keep requests small and cheap; the client batches. */
const LIMITS = { maxControls: 10, maxFieldChars: 4000, maxBodyBytes: 200_000 } as const;

const field = z.string().max(LIMITS.maxFieldChars).default("");
const BodySchema = z.object({
  model: z.string().regex(/^[\w.-]+\/[\w.:-]+$/).max(100).optional(),
  controls: z
    .array(
      ControlSchema.extend({
        control_id: z.string().min(1).max(100),
        process: field, sub_process: field, risk_id: field, risk_description: field, control_objective: field,
        control_description: field, control_owner: field, frequency: field, control_type: field, nature: field,
        evidence: field, systems: field, assertions: field,
      }),
    )
    .min(1)
    .max(LIMITS.maxControls),
});

const err = (status: number, error: string) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Forwards one batch to OpenRouter with the caller's own key.
 * The key arrives in the x-openrouter-key header and is never logged or stored.
 */
export async function POST(req: Request) {
  const apiKey = req.headers.get("x-openrouter-key")?.trim();
  if (!apiKey) return err(401, "Missing OpenRouter API key.");
  if (!/^[\w-]{20,200}$/.test(apiKey)) return err(400, "That does not look like an OpenRouter API key.");

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > LIMITS.maxBodyBytes) return err(413, "Request too large.");
  const text = await req.text();
  if (text.length > LIMITS.maxBodyBytes) return err(413, "Request too large.");

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(JSON.parse(text));
  } catch {
    return err(400, `Invalid request: send 1–${LIMITS.maxControls} controls, each field ≤ ${LIMITS.maxFieldChars} characters.`);
  }

  try {
    const results = await reviewBatchWithLlm(body.controls, {
      apiKey,
      model: body.model || DEFAULT_MODEL,
      signal: req.signal,
      referer: new URL(req.url).origin,
    });
    return Response.json({ results }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    // Never echo request headers; messages come from OpenRouter or our validator.
    const status = e instanceof LlmError && e.status && e.status >= 400 && e.status < 600 ? e.status : 502;
    return err(status === 401 || status === 402 || status === 429 ? status : 502, (e as Error).message.slice(0, 300));
  }
}
