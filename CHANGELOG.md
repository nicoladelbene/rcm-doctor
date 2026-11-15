# Changelog

All notable changes. Versions follow the weekly increments; dates are build dates.

## v0.5.0 — 2026-11-15 · Launch: the full control lifecycle

Review → Test → Evidence → Automate, plus MCP. Everything below was built on 15 Nov 2026 and merged for the launch.

### Added
- **Review (Week 1):** six design attributes (who, what, when, frequency, evidence, precision) with cited spans,
  six deterministic consistency rules, automation score 0–5, suggested rewrite, Excel export, keyless demo,
  BYOK via OpenRouter, rules-only mode. Eval on a 40-control demo set and an independent holdout.
- **Week 1.1:** German rules (`Leiter …` is a role, German departments, `manuell`), more segregation-of-duties
  phrasings (EN/DE), prompt `review.v2` with an AI SoD assessment, holdout v2 (HelvetiaMedTech AG, 30 controls,
  10 in German) measured before and after. ADR 0015.
- **Test (Week 2):** test-script generator: walkthrough (ToD), sample size by frequency, population, test attributes
  traced to the text, exception definition, "remediate the design first" blockers; `/api/testscript`; "Test scripts"
  export sheet. ADR 0012.
- **Evidence (Week 3):** evidence tester: PDF / screenshot / CSV, tick & tie per sample item × attribute, boxes on the
  evidence where the proof is, conclusion computed by code; in-browser PDF/CSV ingest, screenshot compression;
  synthetic evidence for 5 demo controls (2 with planted exceptions); `eval:evidence`. ADR 0014.
- **Automate (Week 4):** process × control-type heatmap, business case per control with score ≥ 4 (hours/yr, CHF,
  ITAC vs RPA/script with cited cue, prerequisites, payback, verdict); all assumptions editable, kept in the browser
  and exported; per-transaction controls excluded until a volume is entered. ADR 0013.
- **MCP (Week 5):** stdio MCP server with `review_rcm` and `generate_test_scripts` over `src/core`, bundled
  (`npx -y github:nicoladelbene/rcm-doctor`), Claude skill `skills/rcm-doctor`, setup for Claude Code / Desktop,
  integration test. ADR 0016.
- **Launch:** lifecycle home with deep links per step, "Use it inside Claude" card, version badge, Open Graph image,
  full-lifecycle video (16:9 + 4:5).

### Measured (see README → Evaluation)
- Demo (regression test, not a benchmark): recall 100% (33/33), FP on clean 4% (1/25).
- Holdout v2 (never seen), Week 1.1: recall 92% (58/63), FP on clean 25% (3/12) · German 95% / 0% · English 90% / 43%.
- Evidence (regression test, not a benchmark): planted exceptions 3/3, false exceptions 0/186.

### Known issues
- English false positives on holdout v2 (43%). Not fixed yet.
- Week 6 (AI-governance pack) is on its own branch: the AI run stopped when the OpenRouter credit ran out.
