# 0016 — Week 5: MCP server (stdio) + Claude skill

- Status: accepted (on branch week-5)
- Date: 2026-11-15

## Context
ROADMAP Week 5: make rcm-doctor usable inside Claude / Claude Code. Must reuse `src/core`, start with `npx`, keep
traceability, keep demo mode keyless, never log or persist API keys.

## Decision
- **One stdio MCP server** (`mcp/server.ts`, SDK `@modelcontextprotocol/sdk` 1.32) with two read-only tools,
  `review_rcm` and `generate_test_scripts`. Handlers live in `mcp/tools.ts` (no transport code) and call `src/core`
  directly; output is Markdown for the model plus `structuredContent` with spans and offsets.
- **Input**: file path (.xlsx/.xls/.csv, ≤ 5 MB), pasted CSV, or `source: "demo"`; optional `control_ids`; ≤ 200
  controls per call (no HTTP body limit here, but keep calls bounded).
- **Modes**: demo → precomputed results; `OPENROUTER_API_KEY` in the server env → AI review + rules (BYOK, same
  prompts `review.v1` / `testscript.v1`); otherwise rules-only + deterministic test-script parts. The key is read
  from the environment only, redacted from error messages, never returned.
- **Distribution**: esbuild bundles the server into one file, `mcp/dist/rcm-doctor-mcp.mjs` (≈ 1.2 MB, committed),
  exposed as package `bin` `rcm-doctor-mcp`. So `npx -y github:nicoladelbene/rcm-doctor` works without a clone or a
  build step (verified on the week-5 branch: ~13 s first start). CI rebuilds the bundle and fails if it differs.
  Publishing to npm is possible later (needs Nicola's npm login) and would make startup faster.
- **Root discovery**: the server finds the repo root from its own location and sets `RCM_DOCTOR_ROOT`, which
  `loadPrompt` now honours (prompt files unchanged; holdout hash unaffected).
- **Skill** (`skills/rcm-doctor/SKILL.md`): when to use the tools, workflow (review → rewrites → test scripts),
  quote `cited_text` verbatim or say "not stated", state the mode, label Claude's own additions as its own.

## Consequences
A real headless Claude Code session (`claude -p`, skill + server, live Sonnet 5.5 review) is kept as
`docs/media/week-5-session.json` and replayed as the Week 5 video. Integration test `tests/mcp.test.ts` starts the
bundled server over stdio from another directory without a key and calls both tools on the demo RCM.
