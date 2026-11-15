/** Client-safe constants (no Node imports). */
export const PROMPT_VERSION = "review.v1";
export const DEFAULT_MODEL = "anthropic/claude-sonnet-5.5"; // ADR 0010
export const SUGGESTED_MODELS = [
  { id: "anthropic/claude-sonnet-5.5", label: "Claude Sonnet 5.5", note: "default · best eval · ~$0.40 / 40 controls" },
  { id: "anthropic/claude-haiku-5.5", label: "Claude Haiku 5.5", note: "budget · ~$0.04 / 40 controls" },
  { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash", note: "not evaluated yet" },
  { id: "deepseek/deepseek-v4.1-flash", label: "DeepSeek V4.1 Flash", note: "not evaluated yet" },
] as const;
