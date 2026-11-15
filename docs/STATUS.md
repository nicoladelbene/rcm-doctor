# STATUS
_Last session: 2026-11-15 (Week 1) · Next session: 2026-12-05/06 (Week 2) · Nicola in Japan 19–30 Nov_

## Where we are
- Week 1 shipped. Live at https://rcm-doctor.vercel.app (demo: /?demo) · repo github.com/nicoladelbene/rcm-doctor (public, Apache-2.0).
- Core (`src/core`): parser with header auto-mapping, 6 deterministic rules, OpenRouter LLM review (prompt review.v1,
  JSON-schema output, zod validation, one repair retry), batching + cache, xlsx export, eval vs ground truth.
- UI: keyless demo, upload + column mapping, rules-only or live AI review (BYOK), cited-span drawer, xlsx export.
- Verified in production: e2e (3/3) and a live /api/review call.
- Media: docs/media/demo.mp4 (17 s), demo.gif (5.3 MB), screenshot*.png. Post drafts: docs/posts/2026-11-15-week-1.md.
- Vercel project linked (`.vercel/`, gitignored); deploy with `npx vercel deploy --prod`. No Git integration yet:
  pushes to main do NOT auto-deploy.

## Next exact step
- Week 2: test-script generator. Start with `src/core/testscript.ts` + a zod schema for TestScript
  (test of design + test of operating effectiveness, sample size by frequency), seeded from the demo RCM.

## Open questions for Nicola
- LinkedIn post format: two variants drafted (A result hook, B problem hook). Pick one / discuss.
- Connect the Vercel project to GitHub (dashboard → Settings → Git) so pushes auto-deploy?
- GitHub social preview: upload docs/media/screenshot.png by hand (Settings → Social preview).

## Known issues / tech debt
- Eval set is small and written by the same author as the prompt: regression test, not a benchmark.
- No rate limiting on /api/review (BYOK: abuse costs only the caller). Input limits: ≤10 controls, ≤4000 chars/field, ≤200 KB.
- Dark mode not implemented. Gemini / DeepSeek options are not evaluated yet.
- `npm run eval` offline evaluates the stored demo results; changing rules requires `npm run precompute` (~USD 0.41).

## Metrics
- Eval: recall 100 % (33/33) · false-positive rate 0 % (0/25 clean) · precision 89 % (demo RCM, anthropic/claude-sonnet-5.5, review.v1)
- Haiku 5.5: recall 82 % · FP 4 % · Rules only: recall 39 % · FP 0 %
- GitHub stars: __ · LinkedIn post views: __ (Nicola fills)
