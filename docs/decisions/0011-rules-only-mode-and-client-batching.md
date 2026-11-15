# 0011 — Rules-only mode without a key; the browser drives LLM batches

- Status: accepted
- Date: 2026-11-15

## Context
Uploaded RCMs need some value without an API key, and Vercel function time limits make a single
40-control LLM request fragile (~60 s with Sonnet 5.5).

## Decision
- Upload without a key runs the six deterministic rules in the browser (no server call).
- With a key, the browser sends batches of 5 controls (3 in parallel) to `/api/review`, which reviews one
  batch per request (max 10 controls, 4000 chars/field, 200 KB). Results are cached in localStorage; the key never is.
- Files are parsed client-side (SheetJS); only the fields the reviewer needs are sent to the model.

## Consequences
Per-control progress in the UI, no long-running functions, and a failed batch degrades to rules-only for those
controls (shown in the drawer) instead of failing the run.
