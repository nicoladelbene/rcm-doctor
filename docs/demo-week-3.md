# Week 3 demo — evidence tester (10 minutes)

Setup: `npm run dev -- -p 3200` (or the branch preview), open http://localhost:3200/?demo. No key needed until step 6.

| Min | Do | Say / look for |
|---|---|---|
| 0–1 | Results header: **"Evidence: 5 controls tested · exceptions in TRE-01, R2R-01"** | Week 1 reviewed the design, Week 2 wrote the test script, Week 3 tests the evidence against that script. |
| 1–3 | Click **TRE-01** (bank account requests, signed PDF form, 4 requests) | Red banner "Exceptions noted · 1" (conclusion computed by code). Matrix 4 items × 4 attributes; **BAR-2026-03 · C** is ✗ and selected: the box sits on **18.06.2026** on page 3, the note shows the business-day count (10.06 → 18.06 = 6 > 2), and the attribute's phrase is highlighted in the control description ("Within 2 business days…"). Faint outlines = other results for the same request (both signatures). |
| 3–4 | Click **BAR-2026-02 · C** | Near-miss: confirmed Thu 26.03, register Mon 30.03 = 2 business days, so a ✓, not an exception. Then **BAR-2026-01 · B** → boxes on both signatures. |
| 4–6 | Esc → **R2R-01** (CSV: 25 manual journal entries × 5 attributes + a config extract) | Two ✗: **100033 · D** (CHF 1,412,500.00, no Group Controller approval; cell outlined) and **100061 · A** (approved 16:05 after posting 11:32). **100049 · D** is "–": CHF 1,000,000.00 is not *above* 1m. **C** (self-approval block) is tied to the configuration extract, tested once ("ALL"). |
| 6–7 | Esc → **ITG-06** → tab Evidence (screenshot of password parameters) | Boxes on the screenshot; D ties to the post-upgrade comparison line. P2P-05 and ITG-05 are clean controls with traps (an amount just below CHF 25k without a note; an unticketed firefighter session escalated within 2 days). |
| 7–9 | Live: still in **TRE-01**, scroll to "Test your own evidence": upload `public/demo-evidence/TRE-01/bank-account-requests-2026.pdf`, samples `BAR-2026-02, BAR-2026-03`, paste your OpenRouter key → "Tick & tie" | ~40 s. The PDF is parsed in the browser (pdf.js: "The PDF's own text layer — boxes exact"); the result replaces the demo one for this control. Same on **ITG-06** with `public/demo-evidence/ITG-06/password-parameters-2026-05-18.png`: the vision model transcribes it first ("boxes approximate", ~50 s). Without a key you still see the evidence and its text layer. |
| 9–10 | `npm run eval` | Demo review gate + evidence gate: 3/3 planted exceptions, 0/160 false exceptions, 100% tied to a verified box. Caveat: authored with the prompt — regression test, not a benchmark. |

Files: evidence generator `scripts/evidence-demo-data.ts` + `scripts/generate-evidence.ts`, core `src/core/evidence.ts`,
prompt `src/core/prompts/evidence.v1.md`, UI `src/app/components/EvidencePanel.tsx`, ADR 0013.
