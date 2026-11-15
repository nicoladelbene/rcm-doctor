# Handoff — branch `week-6` (AI systems controls pack)

**Status: NOT READY (functional, AI run incomplete).** Last session 2026-11-15. Branched from origin/main (6101f2e).

## Done
- 26 controls for AI systems (inventory/classification, data quality, human oversight, monitoring, third parties,
  logging/incidents): `scripts/ai-pack-data.ts` → `npm run gen:ai-pack` → `data/ai-pack-rcm.xlsx` (+ public copy,
  mappings, ground truth with 5 planted-defect controls).
- References verified on the web before writing (log `docs/research/ai-governance-references.md`); empty = no verified
  reference. Unit test enforces the verified whitelist.
- Second demo RCM in the UI ("AI systems controls pack", `/?demo=ai`), "Framework mapping" box in the drawer,
  `eval:ai` (measurement, in CI), recorder flow `RECORD_FLOW=ai`, ADR 0015, demo `docs/demo-week-6.md`,
  media `docs/media/week-6-*`, post draft `docs/posts/2027-01-week-6.md`.

## Checks
- Lint ✅ · unit 95/95 ✅ · eval demo gate ✅ · e2e 7/7 on a local production build ✅ · GitHub CI green ✅.
- `eval:ai` (not a gate): recall 72% (13/18), FP on clean 48% — not tuned.

## Missing / risks
- **OpenRouter credit exhausted mid-run**: 7/26 controls reviewed by rules only (flagged per control and in the UI
  note); test scripts are deterministic only (no AI attributes). The numbers above will change after a full run.
- ISO/IEC 42001 Annex A IDs from one public listing only — re-check against a licensed copy.
- EU AI Act text read on artificialintelligenceact.eu (EUR-Lex returned no text); no application dates stated.
- README/STATUS/ROADMAP also edited on other branches → expect merge conflicts in docs.

## Next exact step
1. Top up OpenRouter credit, then (no other sessions running):
   `LLM_CACHE=/tmp/ai-cache.json LLM_BATCH=5 LLM_CONCURRENCY=2 npx tsx scripts/precompute-demo.ts --input data/ai-pack-rcm.xlsx --out data/ai-pack-results.json`
   and `npm run precompute:testscripts -- --input data/ai-pack-rcm.xlsx --reviews data/ai-pack-results.json --out data/ai-pack-testscripts.json`.
2. `npm run eval:ai`, update numbers in ADR 0015 / post / demo doc, re-record `RECORD_FLOW=ai`.
3. Re-check ISO 42001 IDs; then `npm run lint && npm test && npm run eval`, push.
