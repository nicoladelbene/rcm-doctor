# rcm-doctor — project memory

@docs/STATUS.md
@AGENTS.md

## What this is
Open-source AI reviewer for Risk & Control Matrices (internal controls / IKS).
Personal weekend project of Nicola Del Bene (Deloitte CH, DAICA). Synthetic/public data only.
Weekly increments → Sunday LinkedIn post. Read docs/ROADMAP.md for the plan.

## Rules
- Never re-open decisions in docs/decisions/ unless Nicola asks. New decision → new ADR file.
- No Deloitte names, clients, templates, logos or methodology in code, data or docs.
- Every finding must cite the exact source text span (traceability is the brand).
- Core logic stays in src/core (no Next.js imports). UI in src/app.
- Demo mode must always work without an API key. Never log or persist user API keys.
- Run `npm run lint && npm test && npm run eval` before declaring a task done.
- Keep the README "Try it in 30 seconds" link working.
- Anything doable via CLI or API (gh, vercel, OpenRouter) Claude does itself. Leave Nicola only logins,
  authorizations and things with no API (e.g. pinning repos, social preview image).

## Session protocol
- Start of session: run /resume. /resume also reads docs/WORKFLOW.md.
- End of session (or when Nicola says "chiudiamo"/"wrap up"): run /wrap-up.
