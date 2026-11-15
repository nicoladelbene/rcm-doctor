# Handoff — branch `week-3` (evidence tester)

**Status: READY (not merged).** Last session 2026-11-15.

## Done
- Evidence tester: upload PDF / screenshot / CSV per control; tick & tie of every sample item × test attribute
  (✓ / ✗ / ? / –), box on the evidence (PDF/screenshot) or outlined CSV cell, link to the control-description span.
  Boxes only where code finds the quoted text; conclusion computed by code. Core `src/core/evidence.ts`, prompt
  `evidence.v1`, UI `EvidencePanel.tsx`, route `/api/evidence` (BYOK, maxDuration 120 s, 3.5 MB limit).
- Screenshots resized ≤ 2000 px and re-encoded WebP/JPEG in the browser (≤ 2.5 MB each, ≤ 2.4 MB total); PDFs/CSVs
  parsed in the browser (pdf.js).
- Synthetic evidence for 5 demo controls (TRE-01 and R2R-01 with planted exceptions), precomputed run, `eval:evidence`
  (part of `npm run eval`), ADR 0014 (renumbered; 0013 is week-4), demo `docs/demo-week-3.md`, media
  `docs/media/week-3-*`, post draft `docs/posts/2026-12-13-week-3.md`.

## Checks
- Lint ✅ · unit 107/107 ✅ · eval (review gate + evidence gate: 3/3 planted exceptions, 0/160 false, 100% traced) ✅ ·
  e2e 10/10 on a local production build ✅ · GitHub CI green on every push ✅.

## Missing / risks
- **Not verified on the Vercel preview**: the Vercel connector is denied access to the team
  (team_A0kOksBke1jgGNhXv9ACQKGq). Uploads verified only on localhost + local prod build.
- Evidence eval is authored with the prompt (regression test, not a benchmark).
- Branch is based on week-2; merge order: week-2 → main first. STATUS.md is also edited on other branches (expect
  small merge conflicts there).

## Next exact step
1. Authorize the Vercel connector for the team (or open the preview logged in):
   https://rcm-doctor-git-week-3-nicoladelbene.vercel.app/?demo → "Evidence: … TRE-01" → upload
   `public/demo-evidence/TRE-01/bank-account-requests-2026.pdf` and the ITG-06 PNG with a key (needs OpenRouter credit).
2. After week-2 is on main: `git switch week-3 && git merge main`, `npm run lint && npm test && npm run eval`, merge.
