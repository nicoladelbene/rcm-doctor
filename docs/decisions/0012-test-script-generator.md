# 0012 — Week 2: test-script generator (deterministic sampling + traced LLM attributes)

- Status: accepted (on branch week-2)
- Date: 2026-11-15

## Context
ROADMAP Week 2: from a control description to an audit test script — test of design (ToD) and test of operating
effectiveness (ToE), with sample size by frequency and attributes to test. Traceability remains the brand.

## Decision
- **Sample sizes are computed by code, never by the LLM.** `SAMPLE_TABLE` in `src/core/testscript.ts` holds
  illustrative minimums commonly seen in published practice (automated 1 with ITGC reliance, annual 1, semi-annual 2,
  quarterly 2, monthly 2, weekly 5, daily 20, per transaction 25). It is generic, configurable and documented as
  "adjust to your methodology"; no firm-specific methodology is used.
- **ToE is blocked** when the design review has a high-severity finding on who / what / evidence / precision / SoD /
  nature, or the frequency is unknown: the script says "remediate the design first" instead of testing a broken control.
- **The LLM (prompt `testscript.v1`) drafts** population, walkthrough steps, 2–6 test attributes and the exception
  definition, with the design-review findings as context. Each attribute quotes the description; code locates the
  quote and drops it if not found (same mechanism as findings).
- Frequency normalisation for sampling also accepts German values, locally in `testscript.ts`, so the review rules
  (frozen for the holdout measurement) are untouched.
- `src/core/llm.ts` now has a generic `structuredBatch` used by both review and test scripts; review behaviour and
  the review prompt are unchanged (hash in `data/holdout/review-prompt.sha256`).

## Consequences
Demo: 40 scripts precomputed with Claude Sonnet 5.5 in 77 s; 30 ready for ToE, 10 blocked by design; 172/181 test
attributes (95%) cite a verified span. Without a key, uploads still get the deterministic part (sample size, blockers).
