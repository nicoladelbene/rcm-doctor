# 0015 — Week 6: AI systems controls pack (verified references only)

- Status: accepted (on branch week-6)
- Date: 2026-11-15

## Context
ROADMAP Week 6: a ready RCM module of controls for AI systems, mapped to EU AI Act, ISO/IEC 42001, NIST AI RMF and,
where relevant, FINMA expectations. A wrong article number would destroy the credibility the project is built on.

## Decision
- **26 controls** for the fictional Alpenfirn Industries AG as a *deployer* of AI (CV screening — Annex III 4(a);
  credit-limit scoring of business customers; invoice coding; demand forecasting; GenAI; a vendor chatbot), in six
  areas: inventory and classification, data quality, human oversight, monitoring, third parties, logging and incidents.
  Source: `scripts/ai-pack-data.ts` → `npm run gen:ai-pack` → `data/ai-pack-rcm.xlsx` (+ mappings, ground truth).
- **References are verified on the web before they are written** (`docs/research/ai-governance-references.md`):
  EU AI Act articles read on artificialintelligenceact.eu (EUR-Lex did not return text); NIST AI RMF subcategories on
  the NIST Playbook; FINMA Guidance 08/2024 sections 2.1–2.7 from the PDF. **An empty cell means no verified
  reference fits** — never a guess. A unit test fails if a reference outside the verified list appears.
- **ISO/IEC 42001 caveat**: Annex A IDs come from one public listing (the standard is paywalled; a second public source
  could not be reached). They are shown, flagged in the research log, to be re-checked against a licensed copy.
- **Application dates of the AI Act are not stated** anywhere: the consulted text shows amended dates that must be
  checked on EUR-Lex first.
- **Same pipeline as any RCM**: review (prompt `review.v1`), test scripts, automation score; selectable in the UI as
  the second demo ("AI systems controls pack", deep link `/?demo=ai`), with a "Framework mapping" box in the drawer.
- Five controls carry planted design defects; `npm run eval:ai` measures them (not a gate).

## Consequences
On 2026-11-15 the OpenRouter account ran out of credit mid-run (shared with parallel sessions): 19 of 26 controls were
reviewed with Sonnet 5.5, 7 by the deterministic rules only (flagged per control and in the UI note), and test scripts
are the deterministic part only (sample size, blockers). Measured: recall 72% (13/18), FP on clean controls 48% —
the clean controls were not tuned to the prompt, so this is closer to a holdout than the Week 1 demo. Rerun with
credit: `LLM_CACHE=… npx tsx scripts/precompute-demo.ts --input data/ai-pack-rcm.xlsx --out data/ai-pack-results.json`
then `npm run precompute:testscripts -- --input data/ai-pack-rcm.xlsx --reviews data/ai-pack-results.json --out data/ai-pack-testscripts.json`.
