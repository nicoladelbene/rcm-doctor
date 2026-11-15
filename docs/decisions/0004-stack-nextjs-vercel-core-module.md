# 0004 — Stack: Next.js + TypeScript + Tailwind on Vercel, framework-free core

- Status: accepted
- Date: 2026-11-15

## Context
Need a fast-to-ship public demo, and later reuse as CLI, Claude skill or MCP server.

## Decision
Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel. All review logic lives in `src/core/` as pure TypeScript with no Next.js imports.

## Consequences
UI code in src/app only calls src/core. Scripts (eval, precompute) import src/core directly via tsx.
