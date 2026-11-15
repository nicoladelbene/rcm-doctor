# STATUS
_Last session: 2026-11-15 (Week 1 + Week 2 + Week 1.1, stopped mid-session at ~16:30 on usage limit) · Nicola in Japan 19–30 Nov_

## Where we are
- **Week 2 is LIVE** on production (week-2 fast-forward merged into main, prod e2e 6/6). https://rcm-doctor.vercel.app/?demo → "Test script" tab.
- **Week 1.1 is LIVE** (pushed to main 2026-11-15 ~18:10): German rules (`Leiter …` = role, `manuell`,
  German departments), extra SoD patterns, SoD assessed by the AI in prompt `review.v2`, eval sets
  `holdout-v1-rerun` / `holdout2` / `holdout2-baseline` in scripts/eval.ts.
- **Holdout v2** (data/holdout-v2): HelvetiaMedTech AG, 30 controls (10 DE, 12 clean, 63 defects), generated and labelled
  by google/gemini-4-argon, committed before any review. The reviewer was frozen first (frozen-reviewer.sha256).
  Rejected attempts are documented in GENERATION-LOG.md.
- week-3 / week-4 branches (parallel sessions) were not touched.

## Next exact step
1. At the 18:30 code freeze: merge week-3 then week-4 into main, full e2e (local + prod), record the ~30 s "full lifecycle" video, /wrap-up.
2. Next fix target: English false positives (frequency/when), then a holdout v3 to measure it.

## Open questions for Nicola
- LinkedIn post format (Week 1 / Week 2 drafts). The Week 2 post must now say "published", not "6 Dec".
- Pin rcm-doctor and upload the social preview (no API).

## Known issues / tech debt
- English FP on holdout v2 still 43 % (3/7), mostly strict frequency/when readings; freq_mismatch rule catches 1/3.
- OpenRouter: account credits almost used up (~USD 0.5 left of 10); new-account limit of 20 requests per minute.
- Gemini generator: it reports the German count inaccurately (it needed a positional instruction).
- Demo eval set is authored with the prompt (regression test, not a benchmark). Holdout labels contain generator noise.
- No rate limiting on /api/* (BYOK); input limits ≤10 controls, ≤4000 chars/field, ≤200 KB. Dark mode not implemented.

## Metrics
- Demo eval (review.v2, sonnet-5.5): recall 100 % (33/33) · FP 4 % (1/25) · precision 85 %
- Holdout v1, first measurement (review.v1): recall 82 % · FP 17 % · EN 89 %/0 % · DE 70 %/50 %
- Holdout v1 re-run with Week 1.1: recall 100 % · FP 0 % (SEEN set, not a holdout)
- Holdout v2, Week 1 baseline: recall 86 % (54/63) · FP 58 % · precision 76 % · DE 81 %/80 % · EN 88 %/43 %
- Holdout v2, Week 1.1: recall 92 % (58/63) · FP 25 % (3/12) · precision 84 % · DE 95 %/0 % · EN 90 %/43 %
- Demo test scripts: 29/40 ToE-ready · 95 % (177/187) attributes traced
