# Week 6 demo — AI systems controls pack (10 minutes)

Setup: `npm run dev -- -p 3500`, open http://localhost:3500 (no key needed).

| Min | Do | Say / look for |
|---|---|---|
| 0–1 | Click **AI systems controls pack** (or `/?demo=ai`) | 26 controls, six areas. Header note: 19 reviewed by Sonnet 5.5, 7 by rules only (credit ran out — honest label). |
| 1–3 | Open **AIH-01** (CV-screening human review) | "Framework mapping": EU AI Act Art. 14(4)(d) + 26(2), ISO 42001 A.9.2, NIST MAP 3.5 / GOVERN 3.2, FINMA empty ("no verified reference" — by design). Green spans: who/what/when/evidence present. |
| 3–4 | Tab **Test script** | Per-transaction control → sample 25 (deterministic). Attributes need an AI run (credit). |
| 4–6 | Open **AIG-05** (AI literacy, planted defect) | Fails: no performer role, no action, no frequency, no evidence; owner "Management". Mapping still shows Art. 4 / A.4.6 / GOVERN 2.2 / FINMA 2.1. |
| 6–7 | **AIH-05** (explainability) | Planted SoD: the analyst prepares and approves — caught by the rules. **AID-04** (drift): automated but "the alert is reviewed" → nature mismatch, no threshold. |
| 7–8 | Filter by process **AI third parties**, open **AIV-01/02/03** | Vendor due diligence (A.10.3, GOVERN 6.1, FINMA 2.1), contract clauses (Art. 25(1)(b)), AIV-03 vague (planted). |
| 8–9 | Download report (.xlsx) and `public/ai-pack-rcm.xlsx` | Four reference columns next to the RCM columns. |
| 9–10 | `docs/research/ai-governance-references.md`, `npm run eval:ai` | What was verified where; recall 72%, FP 48% on clean (not tuned → harsher than the Week 1 demo). ISO caveat: one public source. |
