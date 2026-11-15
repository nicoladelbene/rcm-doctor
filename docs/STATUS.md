# STATUS
_Last session: 2026-11-15 (launch v0.5.0) · Next session: 2026-12-05/06 · **Nicola in Japan until 30/11**_

## Where we are
- **v0.5.0 is on main and live** → https://rcm-doctor.vercel.app (demo: /?demo). Every push to main deploys production
  (Vercel Git integration); CI (lint, unit, MCP bundle check, eval, eval:holdout, eval:holdout2) on every push.
- On main: Review (Week 1 + 1.1), Test scripts (Week 2), Evidence tester (Week 3), Automation heatmap (Week 4),
  MCP server + Claude skill (Week 5), lifecycle home, OG image, full-lifecycle video. See CHANGELOG.md.
- **Not on main: `week-6`** (AI-governance pack, 26 controls). Functional, but its AI run stopped when the OpenRouter
  credit ran out (7/26 controls rules-only, test scripts deterministic only). Handoff: `docs/handoff/week-6.md` on
  that branch. Its ADR is numbered 0015, which main already uses (Week 1.1): renumber to 0017 when merging.
- Verified at close (15 Nov, ~18:25): Vercel production deploy ✅ · prod e2e 13/13 ✅ on https://rcm-doctor.vercel.app ·
  launch video re-recorded on production · CI green on main. Branches left: `main`, `week-6` (+ local worktree
  `../rcm-doctor-w6`). Merged branches and worktrees deleted; handoffs kept in `docs/history/`.
- ADRs on main: 0013 automation (W4), 0014 evidence (W3), 0015 Week 1.1, 0016 MCP (W5).
- Launch post: `docs/posts/2026-11-15-launch.md` (2 variants + first comment), video `docs/media/launch-lifecycle-4x5.mp4`.

## Next exact step (5 Dec)
1. **Top up the OpenRouter credit** (it is exhausted; demo and rules-only work without it). Check the key limit.
2. `git fetch && git switch week-6 && git merge main` → resolve docs conflicts → rename its ADR 0015 → 0017.
3. Run the AI pack precompute from `docs/handoff/week-6.md` (step 1), then `npm run eval:ai`, update numbers, re-record.
4. `npm run lint && npm test && npm run eval`, merge into main, prod e2e: `E2E_BASE_URL=https://rcm-doctor.vercel.app npx playwright test`.
5. Then English false positives + holdout v3 (ROADMAP "Week of 5–6 Dec").

## Open questions for Nicola
- Pick a launch post variant (A/B) and post it with `launch-lifecycle-4x5.mp4`; link in the first comment.
- Upload `docs/media/og-image.png` as GitHub social preview (no API).
- npm publish of the MCP server: yes/no (needs your npm login).

## Known issues / tech debt
- English false positives on holdout v2: 43% (3/7 clean), strict "frequency"/"when" readings.
- `llm.ts` no longer matches `frozen-reviewer.sha256` (documented transport fix; prompt and rules match).
- Demo and evidence eval sets are regression tests, not benchmarks. Holdout labels contain generator noise.
- Automation: ITAC/RPA choice is a cue-word heuristic (not measured); assumptions are illustrative defaults.
- MCP server via `npx github:` downloads the whole package (~15 s first start) until published on npm.
- No rate limiting on /api/* (BYOK); per-request input limits. Dark mode not implemented.

## Metrics
- Demo eval (review.v2): recall 100% (33/33) · FP 4% (1/25) · precision 85%
- Holdout v2 (never seen, Week 1.1): recall 92% (58/63) · FP 25% (3/12) · DE 95% / 0% · EN 90% / 43%
- Holdout v1 (Week 1, first measurement): recall 82% · FP 17% · EN 89% / 0% · DE 70% / 50%
- Evidence: planted exceptions 3/3 (with box) · false exceptions 0/186 · conclusions 5/5
- Automation (demo, defaults): 15 candidates (7 priced, 8 need a volume) · 295 h/yr · CHF 32k · 4 already automated
- OpenRouter: credit exhausted, **top up before resuming**
- GitHub stars: __ · LinkedIn post views: __ (Nicola fills)
