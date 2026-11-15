import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { ATTRIBUTE_CHECKS, type Control } from "./schema";

import { DEFAULT_MODEL, PROMPT_VERSION } from "./models";
export { DEFAULT_MODEL, PROMPT_VERSION };

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

let promptCache: string | null = null;
export function loadPrompt(): string {
  if (!promptCache) {
    const raw = readFileSync(join(process.cwd(), "src/core/prompts", `${PROMPT_VERSION}.md`), "utf8");
    promptCache = raw.replace(/^<!--.*?-->\s*/s, "");
  }
  return promptCache;
}

/* ------------------------------------------------------------------ */
/* Output contract                                                     */
/* ------------------------------------------------------------------ */

const AttrStatus = z.enum(["ok", "weak", "missing", "n/a"]);
const AttrSchema = z.object({
  status: AttrStatus,
  quote: z.string().nullable(),
  comment: z.string(),
});
export const LlmControlResultSchema = z.object({
  control_id: z.string(),
  attributes: z.object(Object.fromEntries(ATTRIBUTE_CHECKS.map((k) => [k, AttrSchema])) as Record<(typeof ATTRIBUTE_CHECKS)[number], typeof AttrSchema>),
  automation_score: z.number().int().min(0).max(5),
  automation_rationale: z.string(),
  suggested_rewrite: z.string(),
});
export type LlmControlResult = z.infer<typeof LlmControlResultSchema>;
const LlmBatchSchema = z.object({ results: z.array(LlmControlResultSchema) });

const attrJson = {
  type: "object",
  additionalProperties: false,
  required: ["status", "quote", "comment"],
  properties: {
    status: { type: "string", enum: ["ok", "weak", "missing", "n/a"] },
    quote: { type: ["string", "null"] },
    comment: { type: "string" },
  },
};
export const RESPONSE_JSON_SCHEMA = {
  name: "rcm_review",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["results"],
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["control_id", "attributes", "automation_score", "automation_rationale", "suggested_rewrite"],
          properties: {
            control_id: { type: "string" },
            attributes: {
              type: "object",
              additionalProperties: false,
              required: [...ATTRIBUTE_CHECKS],
              properties: Object.fromEntries(ATTRIBUTE_CHECKS.map((k) => [k, attrJson])),
            },
            automation_score: { type: "integer", minimum: 0, maximum: 5 },
            automation_rationale: { type: "string" },
            suggested_rewrite: { type: "string" },
          },
        },
      },
    },
  },
};

/* ------------------------------------------------------------------ */
/* Call                                                                */
/* ------------------------------------------------------------------ */

export class LlmError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export interface LlmCallOptions {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  referer?: string;
}

/** Only the fields the reviewer needs; keeps tokens low and avoids leaking extra columns. */
export function controlForPrompt(c: Control) {
  return {
    control_id: c.control_id,
    control_description: c.control_description,
    control_owner: c.control_owner,
    frequency_column: c.frequency,
    control_type: c.control_type,
    nature: c.nature,
    key_control: c.key_control,
    evidence_column: c.evidence,
    risk_description: c.risk_description,
  };
}

export function buildMessages(controls: Control[], repairNote?: string) {
  const user =
    `Review these ${controls.length} controls. Respond with JSON {"results": [...]} containing exactly one result per control_id.\n\n` +
    JSON.stringify(controls.map(controlForPrompt), null, 1) +
    (repairNote ? `\n\nYour previous answer was invalid: ${repairNote}\nReturn valid JSON only.` : "");
  return [
    { role: "system", content: loadPrompt() },
    { role: "user", content: user },
  ];
}

export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("no JSON object in response");
  return JSON.parse(body.slice(start, end + 1));
}

async function post(opts: LlmCallOptions, body: Record<string, unknown>) {
  const f = opts.fetchImpl ?? fetch;
  const res = await f(OPENROUTER_URL, {
    method: "POST",
    signal: opts.signal,
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": opts.referer ?? "https://github.com/nicoladelbene/rcm-doctor",
      "X-Title": "rcm-doctor",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 300);
    try {
      msg = JSON.parse(text)?.error?.message ?? msg;
    } catch {}
    throw new LlmError(`OpenRouter ${res.status}: ${msg}`, res.status);
  }
  const json = JSON.parse(text);
  const content: string | undefined = json?.choices?.[0]?.message?.content;
  if (!content) throw new LlmError(`Empty response from model${json?.error?.message ? `: ${json.error.message}` : ""}`);
  return content;
}

/**
 * Review a batch of controls with one LLM call. Structured output via JSON schema;
 * falls back to json_object for models without schema support; validates with zod
 * and retries once with the validation error on failure.
 */
export async function reviewBatchWithLlm(controls: Control[], opts: LlmCallOptions): Promise<LlmControlResult[]> {
  const model = opts.model || DEFAULT_MODEL;
  let format: Record<string, unknown> = { type: "json_schema", json_schema: RESPONSE_JSON_SCHEMA };
  let repairNote: string | undefined;

  for (let attempt = 0; attempt < 3; attempt++) {
    let content: string;
    try {
      content = await post(opts, {
        model,
        temperature: 0,
        max_tokens: 1200 * controls.length + 500,
        response_format: format,
        messages: buildMessages(controls, repairNote),
      });
    } catch (e) {
      // Some models reject json_schema; downgrade once to json_object.
      if (e instanceof LlmError && e.status === 400 && format.type === "json_schema" && /response_format|schema|structured/i.test(e.message)) {
        format = { type: "json_object" };
        continue;
      }
      throw e;
    }
    try {
      const parsed = LlmBatchSchema.parse(extractJson(content));
      const ids = new Set(controls.map((c) => c.control_id));
      const results = parsed.results.filter((r) => ids.has(r.control_id));
      const missing = controls.filter((c) => !results.some((r) => r.control_id === c.control_id));
      if (missing.length) throw new Error(`missing results for ${missing.map((m) => m.control_id).join(", ")}`);
      return results;
    } catch (e) {
      if (repairNote) throw new LlmError(`Model output failed validation twice: ${(e as Error).message.slice(0, 200)}`);
      repairNote = (e as Error).message.slice(0, 500);
    }
  }
  throw new LlmError("Model output could not be obtained");
}

/** Adapter for review.ts: a batch function bound to a key and model. */
export function openRouterBatchFn(opts: LlmCallOptions) {
  return (controls: Control[]) => reviewBatchWithLlm(controls, opts);
}
