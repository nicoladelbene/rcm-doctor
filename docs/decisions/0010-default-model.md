# 0010 — Default model: anthropic/claude-haiku-5.5

- Status: accepted
- Date: 2026-11-15

## Context
BOOTSTRAP asks for a strong, inexpensive current model from the OpenRouter list, user-selectable. On 2026-11-15 the OpenRouter /models list shows anthropic/claude-haiku-5.5 at USD 0.10 / 0.50 per million input/output tokens, 1M context, with structured_outputs support.

## Decision
Default model for user reviews: `anthropic/claude-haiku-5.5`. The UI offers a short curated list (also anthropic/claude-sonnet-5.5, google/gemini-3.8-flash, deepseek/deepseek-v4.1-flash) plus a free-text model id. Precomputed demo results use a stronger model where possible (claude-sonnet-5.5) and record which model produced them.

## Consequences
A 40-control review costs well under one US cent with the default. If the model is retired, update this ADR and the default in src/core/llm.ts.
