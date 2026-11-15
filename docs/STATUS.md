# STATUS
_Last session: 2026-11-15 (Week 1) · Next session: 2026-12-05/06 (Week 2) · Nicola in Japan 19–30 Nov_

## Where we are
- Week 1 MVP built and pushed to github.com/nicoladelbene/rcm-doctor (public, Apache-2.0).
- Core (`src/core`): parser with header auto-mapping, 6 deterministic rules, OpenRouter LLM review (prompt review.v1,
  structured output, zod, retry), orchestration with batching/cache, xlsx export, eval.
- UI: demo mode (no key), upload + column mapping, rules-only or live AI review, cited-span drawer, export.
- Demo media in docs/media (demo.mp4, demo.gif 5.3 MB, screenshots). Post drafts in docs/posts/2026-11-15-week-1.md.
- NOT YET DEPLOYED: waiting for Vercel CLI login (`! npx vercel login`). README and post contain `__VERCEL_URL__` placeholders.

## Next exact step
- After login: `npx vercel link` + `npx vercel deploy --prod`, replace `__VERCEL_URL__` in README.md and the post,
  run e2e against prod (`E2E_BASE_URL=<url> npx playwright test`), set GitHub repo homepage, then /wrap-up.

## Open questions for Nicola
- LinkedIn post format (visual-first: GIF/video, short text) — two variants drafted, to be discussed.
- GitHub social preview image must be uploaded by hand (Settings → Social preview → docs/media/screenshot.png).

## Known issues / tech debt
- Eval set is small and authored by the same person as the prompt: regression test, not a benchmark.
- No rate limiting on /api/review (BYOK, so abuse costs only the caller); input size limits are in place.
- Dark mode not implemented (first item on the cut list).

## Metrics
- Eval: recall 100 % · false-positive rate 0 % on clean controls · precision 89 % (demo RCM, anthropic/claude-sonnet-5.5, prompt review.v1)
- Haiku 5.5: recall 82 % · FP 4 % · Rules only: recall 39 % · FP 0 %
- GitHub stars: __ · LinkedIn post views: __ (Nicola fills)
