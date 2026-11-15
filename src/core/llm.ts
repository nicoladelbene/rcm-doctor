import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { controlForEvidencePrompt, layerForPrompt, type EvidencePack } from "./evidence";
import { ATTRIBUTE_CHECKS, type Control } from "./schema";
import type { TestScript } from "./testscript";

import { DEFAULT_MODEL, PROMPT_VERSION } from "./models";
export { DEFAULT_MODEL, PROMPT_VERSION };

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const promptCache = new Map<string, string>();
/** Load a versioned prompt from src/core/prompts (default: the review prompt). */
export function loadPrompt(version: string = PROMPT_VERSION): string {
  if (!promptCache.has(version)) {
    // RCM_DOCTOR_ROOT lets the MCP server find the prompts when started from another directory.
    const raw = readFileSync(join(process.env.RCM_DOCTOR_ROOT ?? process.cwd(), "src/core/prompts", `${version}.md`), "utf8");
    promptCache.set(version, raw.replace(/^<!--[\s\S]*?-->\s*/, ""));
  }
  return promptCache.get(version)!;
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

export async function post(opts: LlmCallOptions, body: Record<string, unknown>) {
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
 * Generic structured batch call: one request returns {"results": [...]} with one item per control_id.
 * JSON-schema output; falls back to json_object for models without schema support; validates with zod
 * and retries once with the validation error on failure.
 */
export async function structuredBatch<T extends { control_id: string }>(args: {
  ids: string[];
  messages: (repairNote?: string) => { role: string; content: unknown }[];
  itemSchema: z.ZodType<T>;
  jsonSchema: Record<string, unknown>;
  maxTokens: number;
  opts: LlmCallOptions;
}): Promise<T[]> {
  const { ids, opts } = args;
  const model = opts.model || DEFAULT_MODEL;
  const batchSchema = z.object({ results: z.array(args.itemSchema) });
  let format: Record<string, unknown> = { type: "json_schema", json_schema: args.jsonSchema };
  let repairNote: string | undefined;

  for (let attempt = 0; attempt < 3; attempt++) {
    let content: string;
    try {
      content = await post(opts, { model, temperature: 0, max_tokens: args.maxTokens, response_format: format, messages: args.messages(repairNote) });
    } catch (e) {
      // Some models reject json_schema; downgrade once to json_object.
      if (e instanceof LlmError && e.status === 400 && format.type === "json_schema" && /response_format|schema|structured/i.test(e.message)) {
        format = { type: "json_object" };
        continue;
      }
      throw e;
    }
    try {
      const parsed = batchSchema.parse(extractJson(content));
      const wanted = new Set(ids);
      const results = parsed.results.filter((r) => wanted.has(r.control_id));
      const missing = ids.filter((id) => !results.some((r) => r.control_id === id));
      if (missing.length) throw new Error(`missing results for ${missing.join(", ")}`);
      return results;
    } catch (e) {
      if (repairNote) throw new LlmError(`Model output failed validation twice: ${(e as Error).message.slice(0, 200)}`);
      repairNote = (e as Error).message.slice(0, 500);
    }
  }
  throw new LlmError("Model output could not be obtained");
}

/** Review a batch of controls with one LLM call (prompt review.v1). */
export async function reviewBatchWithLlm(controls: Control[], opts: LlmCallOptions): Promise<LlmControlResult[]> {
  return structuredBatch({
    ids: controls.map((c) => c.control_id),
    messages: (repair) => buildMessages(controls, repair),
    itemSchema: LlmControlResultSchema,
    jsonSchema: RESPONSE_JSON_SCHEMA,
    maxTokens: 1200 * controls.length + 500,
    opts,
  });
}

/** Adapter for review.ts: a batch function bound to a key and model. */
export function openRouterBatchFn(opts: LlmCallOptions) {
  return (controls: Control[]) => reviewBatchWithLlm(controls, opts);
}

/* ------------------------------------------------------------------ */
/* Week 2: test scripts (prompt testscript.v1)                         */
/* ------------------------------------------------------------------ */

const LlmTestScriptSchema = z.object({
  control_id: z.string(),
  population: z.string(),
  tod_steps: z.array(z.string()).min(1).max(8),
  toe_attributes: z
    .array(z.object({ attribute: z.string(), procedure: z.string(), evidence: z.string(), quote: z.string().nullable() }))
    .min(1)
    .max(10),
  exception_definition: z.string(),
});

const TESTSCRIPT_JSON_SCHEMA = {
  name: "rcm_test_scripts",
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
          required: ["control_id", "population", "tod_steps", "toe_attributes", "exception_definition"],
          properties: {
            control_id: { type: "string" },
            population: { type: "string" },
            tod_steps: { type: "array", items: { type: "string" } },
            toe_attributes: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["attribute", "procedure", "evidence", "quote"],
                properties: {
                  attribute: { type: "string" },
                  procedure: { type: "string" },
                  evidence: { type: "string" },
                  quote: { type: ["string", "null"] },
                },
              },
            },
            exception_definition: { type: "string" },
          },
        },
      },
    },
  },
};

export interface TestScriptInput {
  control: Control;
  review: { findings: { check: string; severity: string; message: string }[] } | null;
}

export function buildTestScriptMessages(items: TestScriptInput[], repairNote?: string) {
  const payload = items.map(({ control, review }) => ({
    ...controlForPrompt(control),
    systems: control.systems,
    review_findings: (review?.findings ?? []).map((f) => `${f.severity} · ${f.check}: ${f.message}`),
  }));
  const user =
    `Draft test scripts for these ${items.length} controls. Respond with JSON {"results": [...]} containing exactly one result per control_id.\n\n` +
    JSON.stringify(payload, null, 1) +
    (repairNote ? `\n\nYour previous answer was invalid: ${repairNote}\nReturn valid JSON only.` : "");
  return [
    { role: "system", content: loadPrompt("testscript.v1") },
    { role: "user", content: user },
  ];
}

export async function testScriptBatchWithLlm(items: TestScriptInput[], opts: LlmCallOptions) {
  return structuredBatch({
    ids: items.map((i) => i.control.control_id),
    messages: (repair) => buildTestScriptMessages(items, repair),
    itemSchema: LlmTestScriptSchema,
    jsonSchema: TESTSCRIPT_JSON_SCHEMA,
    maxTokens: 1500 * items.length + 500,
    opts,
  });
}

/* ------------------------------------------------------------------ */
/* Week 3: evidence tester (prompt evidence.v1)                        */
/* ------------------------------------------------------------------ */

const TICK_RESULTS = ["tick", "exception", "not_evidenced", "n_a"] as const;
const LlmEvidenceSchema = z.object({
  control_id: z.string(),
  samples: z.array(z.string()),
  items: z.array(
    z.object({
      sample_id: z.string(),
      attribute_id: z.string(),
      result: z.enum(TICK_RESULTS),
      refs: z.array(z.string()),
      quote: z.string().nullable(),
      note: z.string(),
    }),
  ),
  summary: z.string(),
});

const EVIDENCE_JSON_SCHEMA = {
  name: "rcm_tick_and_tie",
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
          required: ["control_id", "samples", "items", "summary"],
          properties: {
            control_id: { type: "string" },
            samples: { type: "array", items: { type: "string" } },
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["sample_id", "attribute_id", "result", "refs", "quote", "note"],
                properties: {
                  sample_id: { type: "string" },
                  attribute_id: { type: "string" },
                  result: { type: "string", enum: [...TICK_RESULTS] },
                  refs: { type: "array", items: { type: "string" } },
                  quote: { type: ["string", "null"] },
                  note: { type: "string" },
                },
              },
            },
            summary: { type: "string" },
          },
        },
      },
    },
  },
};

export interface EvidenceInput {
  control: Control;
  script: TestScript;
  pack: EvidencePack;
}

/** One control per call: the evidence text layer is the bulk of the prompt. Images are attached for screenshots. */
export function buildEvidenceMessages({ control, script, pack }: EvidenceInput, repairNote?: string) {
  const files = pack.files.map((f) => `### Evidence ${f.file_id}: ${f.name} (${f.kind}${f.layer === "model-ocr" ? ", text transcribed from the image" : ""})\n${layerForPrompt(f)}`).join("\n\n");
  const text =
    `Tick & tie this control. Respond with JSON {"results": [ONE result for control_id ${control.control_id}]}.\n\n` +
    `## Control and test attributes\n${JSON.stringify(controlForEvidencePrompt(control, script), null, 1)}\n\n` +
    `## Sample selection\n${pack.samples.length ? JSON.stringify(pack.samples) : "(none given — identify the items in the evidence)"}\n\n` +
    `## Evidence\n${files}` +
    (repairNote ? `\n\nYour previous answer was invalid: ${repairNote}\nReturn valid JSON only.` : "");
  const images = pack.files.filter((f) => f.kind === "image").flatMap((f) => f.pages.map((p) => p.image).filter((u): u is string => !!u && u.startsWith("data:")));
  const content = images.length ? [{ type: "text", text }, ...images.map((url) => ({ type: "image_url", image_url: { url } }))] : text;
  return [
    { role: "system", content: loadPrompt("evidence.v1") },
    { role: "user", content },
  ];
}

export async function evidenceWithLlm(input: EvidenceInput, opts: LlmCallOptions) {
  const [r] = await structuredBatch({
    ids: [input.control.control_id],
    // content may be multimodal (array); structuredBatch passes messages through unchanged.
    messages: (repair) => buildEvidenceMessages(input, repair),
    itemSchema: LlmEvidenceSchema,
    jsonSchema: EVIDENCE_JSON_SCHEMA,
    maxTokens: 16000,
    opts,
  });
  return r;
}

/* Screenshot without a text layer: the vision model transcribes it (boxes approximate, flagged as model-ocr). */
const OcrSchema = z.object({ lines: z.array(z.object({ text: z.string(), box: z.array(z.number()).length(4) })) });
const OCR_JSON_SCHEMA = {
  name: "ocr_lines",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["lines"],
    properties: {
      lines: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["text", "box"],
          properties: { text: { type: "string" }, box: { type: "array", items: { type: "number" } } },
        },
      },
    },
  },
};

export async function transcribeImage(dataUrl: string, opts: LlmCallOptions): Promise<{ text: string; box: [number, number, number, number] }[]> {
  const content = await post(opts, {
    model: opts.model || DEFAULT_MODEL,
    temperature: 0,
    max_tokens: 8000,
    response_format: { type: "json_schema", json_schema: OCR_JSON_SCHEMA },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              'Transcribe every line or table cell of text in this screenshot, top to bottom, exactly as written. For each, give its bounding box as [x, y, width, height] in fractions of the image size (0..1). Respond with JSON {"lines": [{"text": "...", "box": [x, y, w, h]}]}.',
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });
  const parsed = OcrSchema.parse(extractJson(content));
  return parsed.lines
    .filter((l) => l.text.trim())
    .map((l) => ({ text: l.text.trim(), box: l.box.map((v) => Math.min(1, Math.max(0, v))) as [number, number, number, number] }));
}
