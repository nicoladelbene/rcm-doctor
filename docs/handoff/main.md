# Handoff — main (2026-11-15, end of day)

**Status: READY.** Week 2 and Week 1.1 are on main and deployed to production (Vercel: success on 4f54862).

## Done
- Week 2 (test-script generator): week-2 was fast-forward merged into main, and prod e2e passed 6/6 after that merge.
- Week 1.1:
  - German rules: `Leiter …` is a role, German departments are recognised, `manuell` is recognised.
  - More segregation-of-duties phrasings, in English and German.
  - Prompt `review.v2` with an AI `sod_conflict` assessment.
  - ADR 0015 (renumbered because week-3 and week-4 use 0013 and 0014).
- Holdout v2: HelvetiaMedTech AG, 30 controls (10 in German), generated and labelled by google/gemini-4-argon.
  - The labels and the reviewer hashes were committed before any review.
  - Week 1.1 results: recall 92% (58/63), FP on clean controls 25% (3/12). In German: recall 95%, FP 0%.
  - Week 1 baseline on the same set: recall 86%, FP 58%. In German: FP 80%.
- README: holdout v1 and v2 side by side, plus an honest changelog.
- `eval:holdout2` added to package.json and CI.
- The site hero shows holdout v2.
- Transport fix: the token budget now includes reasoning tokens, and a truncated answer is reported as such. This is logged in data/holdout-v2/GENERATION-LOG.md.

## Green?
- **Local:** lint ✅ · unit 100/100 ✅ · `npm run eval` ✅ (demo 100% recall, 4% FP) · `eval:holdout2` ✅ · build ✅ · e2e 6/6 ✅.
- **CI:** CI on main @4f54862 ✅ success.
- **Not run:** prod e2e on the Week 1.1 deploy (stopped on request). Run `E2E_BASE_URL=https://rcm-doctor.vercel.app npx playwright test`.

## Missing (not started; day closed)
- Code-freeze tasks: merge week-3 then week-4 into main, run the full e2e, and record the ~30 s "full lifecycle" video.
- Update the post drafts: the Week 2 post should say "published today", and the Week 1.1 numbers need adding.
- /wrap-up.

## Risks
- **OpenRouter credit:** used up (about USD 0.5 left of 10). No live runs are possible until it is topped up. Demo mode is unaffected.
- **Merge conflicts:** week-3 and week-4 both change README, STATUS, ROADMAP and App.tsx (hero and header badge). Expect conflicts there; keep the Week 1.1 holdout v2 numbers.
- **English FP on holdout v2:** still 43% (3/7), from strict readings of "frequency" and "when". freq_mismatch catches 1 of 3 cases.
- **Frozen hashes:** `llm.ts` no longer matches `frozen-reviewer.sha256`. This is the documented transport fix; the prompt and rules still match.

## Next exact step
1. `E2E_BASE_URL=https://rcm-doctor.vercel.app npx playwright test`
2. `git merge week-3` (resolve the docs and App.tsx conflicts), lint, test, eval, e2e. Then `git merge week-4`, and repeat the checks.
3. Push, run prod e2e, then `RECORD_FLOW=lifecycle` (extend scripts/record-demo.ts) and record the ~30 s video.
4. /wrap-up.
