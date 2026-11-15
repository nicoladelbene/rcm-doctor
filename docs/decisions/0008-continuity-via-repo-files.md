# 0008 — Continuity via files in the repo

- Status: accepted
- Date: 2026-11-15

## Context
Sessions are weekly with gaps (including a two-week pause); context must survive without relying on chat history.

## Decision
CLAUDE.md imports docs/STATUS.md. The /resume and /wrap-up commands load and update state. A Stop hook blocks stopping once if code changed without updating STATUS.md.

## Consequences
STATUS.md is rewritten (not appended) each session and kept under ~60 lines.
