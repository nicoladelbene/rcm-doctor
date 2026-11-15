# 0010 — Default model: anthropic/claude-sonnet-5.5 (Haiku 5.5 as budget option)

- Status: accepted (revised same day after the first eval)
- Date: 2026-11-15

## Context
BOOTSTRAP asks for a strong, inexpensive current model from the OpenRouter list, user-selectable.
On 2026-11-15 the OpenRouter /models list offers, with structured-output support:
anthropic/claude-haiku-5.5 (USD 0.10 / 0.50 per M tokens) and anthropic/claude-sonnet-5.5 (USD 2 / 10).

First plan was Haiku 5.5. The eval on the 40-control demo RCM (prompt review.v1) showed:

| Model | Recall | FP on clean controls | Precision | Cost per 40 controls |
|---|---:|---:|---:|---:|
| anthropic/claude-sonnet-5.5 | 100% (33/33) | 0% | 89% | ~USD 0.41 |
| anthropic/claude-haiku-5.5 | 82% (27/33) | 4% | 93% | ~USD 0.04 |

Haiku missed every planted "when / trigger" defect (0/3).

## Decision
Default model = `anthropic/claude-sonnet-5.5`. The UI offers Haiku 5.5 as the budget option, plus
Gemini 3.8 Flash, DeepSeek V4.1 Flash and a free-text model id. Demo results are precomputed with Sonnet 5.5.

## Consequences
A full 40-control review costs well under USD 1 with the default. Verifiability beats a 10x cost saving
for this audience. Re-run the eval when the prompt or the default changes; update this ADR if the model is retired.
