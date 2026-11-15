# 0005 — LLM: bring-your-own-key via OpenRouter, plus keyless demo mode

- Status: accepted
- Date: 2026-11-15

## Context
Hosting LLM costs for a public demo is not sustainable; users want model choice; visitors from LinkedIn will not paste a key.

## Decision
Users paste their own OpenRouter key and pick a model. The key travels only per request to /api/review, which forwards it to OpenRouter; it is never logged or stored server-side. A demo mode serves precomputed results (data/demo-results.json) without any key.

## Consequences
Demo mode must always work. The API route enforces input size limits. Precomputed results are regenerated with scripts/precompute-demo.ts and committed.
