# Week 4 demo — 10 minutes (for Nicola)

Run: `git switch week-4 && npm ci && npm run build && PORT=3300 npm start` → http://localhost:3300/?demo&view=automation
(or `npx next dev -p 3300`). No API key needed. Branch only: nothing merged to main, production untouched.

| Min | Do | Look for |
|---|---|---|
| 0–1 | Open `/?demo`, click the tab **Automation opportunities** (next to "Design review"). | Same demo RCM, second view; no extra AI call. |
| 1–2 | Read the 5 totals. | 15 candidates (score ≥ 4) · 695 h/yr · CHF 76'406 · 880 build h (≈ 15 months) · 4 already automated · "4 need a design fix first". |
| 2–3 | **Heatmap**: process rows × Preventive/Detective columns; colour = avg score. Hover a cell. | Each cell: avg score, # controls, # ≥ 4, # already automated, hours/yr. Right column: hours per process. |
| 3–4 | Click **Treasury / Detective**. | List filters to TRE-08 (daily, *moderate*, 12.8 months) and TRE-05 (annual, *weak*, 200 months): a 4 is not always worth automating. "Show all processes" resets. |
| 4–5 | On TRE-08 read the card. | Cue word **reconciles** highlighted (RPA) in the description, "Why a script", the arithmetic 250 × 30 min = 125 h × 60 % = 75 h/yr, CHF, build, payback, 4 prerequisites. |
| 5–6 | Open a preventive card, e.g. **P2P-04** or **R2R-01**. | ITAC (configure in the system), cue word like *released / approved*, prerequisites about configuration baseline + ITGCs + test of one. |
| 6–7 | Find **P2P-06** (SoD) or **ITG-04** / **O2C-07** / **ITG-03**. | Red box "Remediate the design first"; prerequisites start with "Resolve the segregation-of-duties conflict…". ITG-03 is labelled "Automated" but the review found a manual step → treated as a candidate. |
| 7–8 | **Assumptions panel**: Daily min/run 30 → 60. | Totals and cells recalc live (hours ≈ 920). Click **Reset defaults**. Set threshold to 5 → 0 cases (all score-5 controls are already automated); back to 4. |
| 8–9 | On a per-transaction card set occurrences 500 → 5000. | Card shows overridden input (blue), "reset" link; panel says "1 control overridden · Clear". |
| 9–10 | Click a control ID → opens the review drawer. Then **Download report (.xlsx)**. | Sheet **Automation**: cases sorted by hours, cited cue, all numbers, total row, and the full assumption list at the bottom. |

Decisions to take: defaults OK? (ADR 0013 — 10 min per event, 30 daily, 180 monthly…; 60 %/90 % removed; CHF 110/h;
ITAC 40 h / RPA 80 h). Post: 3 lines in `docs/posts/2026-12-20-week-4.md`.
Known limits: approach rule is a cue-word heuristic (not measured on the holdout); "per transaction" volume is a placeholder;
assumptions live in memory (reset on reload); the header badge still says "week 1".
