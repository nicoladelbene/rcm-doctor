import { z } from "zod";
import { LlmError } from "@/core/llm";
import { ControlSchema } from "@/core/schema";

/** Input limits shared by the LLM routes: keep requests small and cheap; the client batches. */
export const LIMITS = { maxControls: 10, maxFieldChars: 4000, maxBodyBytes: 200_000 } as const;

const field = z.string().max(LIMITS.maxFieldChars).default("");
export const BodyControlSchema = ControlSchema.extend({
  control_id: z.string().min(1).max(100),
  process: field, sub_process: field, risk_id: field, risk_description: field, control_objective: field,
  control_description: field, control_owner: field, frequency: field, control_type: field, nature: field,
  evidence: field, systems: field, assertions: field,
});
export const ModelSchema = z.string().regex(/^[\w.-]+\/[\w.:-]+$/).max(100).optional();

export const err = (status: number, error: string) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

/** Validates key header and body size; returns the key and raw text, or an error Response. Never logs the key. */
export async function readGuarded(req: Request): Promise<{ apiKey: string; text: string } | Response> {
  const apiKey = req.headers.get("x-openrouter-key")?.trim();
  if (!apiKey) return err(401, "Missing OpenRouter API key.");
  if (!/^[\w-]{20,200}$/.test(apiKey)) return err(400, "That does not look like an OpenRouter API key.");
  if (Number(req.headers.get("content-length") ?? 0) > LIMITS.maxBodyBytes) return err(413, "Request too large.");
  const text = await req.text();
  if (text.length > LIMITS.maxBodyBytes) return err(413, "Request too large.");
  return { apiKey, text };
}

export function llmErrorResponse(e: unknown): Response {
  const status = e instanceof LlmError && e.status ? e.status : 502;
  return err(status === 401 || status === 402 || status === 429 ? status : 502, (e as Error).message.slice(0, 300));
}
