# STATUS
_Last session: 2026-11-15 (Week 1 + Week 2 build) · Next session: 2026-12-05/06 · Nicola in Japan 19–30 Nov_

## Where we are
- **Week 1 is live** on main → https://rcm-doctor.vercel.app (demo: /?demo). Auto-deploy: Vercel Git integration,
  every push to main deploys production; other branches get (protected) previews. CI (lint, unit, eval, eval:holdout) on every push/PR.
- **Week 2 is READY on branch `week-2`. On 6 Dec only polish, merge and publish remain.** It contains the test-script
  generator: ToD walkthrough + ToE attributes traced to source spans, sample size by frequency, "remediate first" blockers,
  /api/testscript, drawer "Test script" tab, "Test scripts" export sheet, precomputed demo scripts, ADR 0012,
  media (docs/media/week-2-*), post draft docs/posts/2026-12-06-week-2.md. CI green, preview deployed, prod untouched.
- **Week 4 is READY on branch `week-4`** (parallel session, 15 Nov; not merged, prod untouched): automation heatmap
  (process × control type) + business case per control with score ≥ 4 (hours/yr, CHF, ITAC vs RPA/script with cited cue,
  prerequisites, payback), all assumptions editable in the UI and exported (sheet "Automation"). ADR 0013,
  10-min demo `docs/demos/week-4-demo.md`, post `docs/posts/2026-12-20-week-4.md`, media `docs/media/week-4-*`. CI green.
  Merge order: week-2 → (week-3) → week-4; expect trivial conflicts in README/STATUS/e2e sheet names.
- **Holdout eval** (data/holdout, `npm run eval:holdout`): 30 controls for Limmatquell Privatkliniken AG, generated and
  labelled by openai/gpt-5.6-sol before review; review prompt frozen (sha256 in data/holdout/review-prompt.sha256).
- GitHub profile: bio set, "Current project" section added to nicoladelbene/nicoladelbene README.

## Next exact step (6 Dec)
1. `git switch week-2 && git merge main` (should be clean), `npm run lint && npm test && npm run eval`, open the preview.
2. Polish UI copy if needed, then `git switch main && git merge week-2 && git push` (auto-deploys production).
3. Check https://rcm-doctor.vercel.app/?demo → "Test script" tab; pick a post variant in docs/posts/2026-12-06-week-2.md.
4. Then start the German / rules fixes below, and measure on a NEW holdout (the current one is now "seen").

## Open questions for Nicola
- LinkedIn post format: variants A/B for Week 1 (updated with holdout) and Week 2 drafts. Pick / discuss.
- Pin rcm-doctor and upload the social preview (no API).

## Known issues / tech debt
- Week 4: ITAC/RPA choice is a cue-word heuristic (not measured); "per transaction" volume is a placeholder. Assumptions persist
  in localStorage (per browser); per-control overrides do not. Nicola to confirm default assumptions (ADR 0013).
- **German (holdout):** recall 70%, FP 50% on clean German controls. Causes: owner rule treats "Leiter …" as a person
  name (4 FP) and misses German departments; nature rule misses "manuell". Not fixed on purpose (holdout integrity).
- **SoD regex** misses "prepares … and then approves the same …" (2/2 holdout misses, English). The review prompt
  delegates SoD to rules, so the AI does not catch it either. Fix in rules + re-measure on a new holdout.
- Demo eval set is authored with the prompt (regression test, not a benchmark). Holdout labels contain generator noise.
- Week 2 preview is behind Vercel Authentication (open it while logged in); e2e ran locally on the same commit.
- No rate limiting on /api/* (BYOK); input limits ≤10 controls, ≤4000 chars/field, ≤200 KB. Dark mode not implemented.

## Metrics
- Demo eval: recall 100 % (33/33) · FP 0 % (0/25) · precision 89 % (anthropic/claude-sonnet-5.5, review.v1)
- Holdout: recall 82 % (23/28) · FP 17 % (2/12) · precision 82 % · EN 89 % / 0 % · DE 70 % / 50 %
- Week 2 (branch): 40 scripts in 77 s · 30 ToE-ready / 10 blocked · 95 % (172/181) test attributes cite a verified span
- Week 4 (branch, demo, default assumptions): 15 candidates · 695 h/yr (≈0.41 FTE) · CHF 76k · 880 build h · 4 already automated · 4 blocked by design
- OpenRouter spend today: USD 1.91 of the USD 5 key limit
- GitHub stars: __ · LinkedIn post views: __ (Nicola fills)
