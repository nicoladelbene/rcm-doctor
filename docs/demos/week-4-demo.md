# Week 4 demo — 10 minutes (for Nicola)

Run: `git switch week-4 && npm ci && npm run build && PORT=3300 npm start` → http://localhost:3300/?demo&view=automation
(or `npx next dev -p 3300`). No API key needed. Branch only: nothing merged to main, production untouched.

| Min | Do | Look for |
|---|---|---|
| 0–1 | Open `/?demo`, click the tab **Automation opportunities** (next to "Design review"). | Same demo RCM, second view; no extra AI call. |
| 1–2 | Banner "Illustrative defaults", then the 5 totals. | 15 candidates (score ≥ 4): 8 need a volume (not in totals), 4 need a design fix · 295 h/yr (≈ 0.17 FTE) · CHF 32'406 · 560 build h (≈ 23 months) · 4 already automated. |
| 2–3 | **Heatmap**: process rows × Preventive/Detective columns; colour = avg score. Hover a cell. | Each cell: avg score, # controls, # ≥ 4, # already automated, hours/yr. Right column: hours per process. |
| 3–4 | Click **Treasury / Detective**. | List filters to TRE-08 (daily, *moderate*, 12.8 months) and TRE-05 (annual, *weak*, 200 months): a 4 is not always worth automating. "Show all processes" resets. |
| 4–5 | On TRE-08 read the card. | Cue word **reconciles** highlighted (RPA) in the description, "Why a script", the arithmetic 250 × 30 min = 125 h × 60 % = 75 h/yr, CHF, build, payback, 4 prerequisites. |
| 5–6 | Open a preventive card, e.g. **P2P-04** or **R2R-01**. | ITAC (configure in the system), cue word like *released / approved*, prerequisites about configuration baseline + ITGCs + test of one. |
| 6–7 | Find **P2P-06** (SoD) or **ITG-04** / **O2C-07** / **ITG-03**. | Red box "Remediate the design first"; prerequisites start with "Resolve the segregation-of-duties conflict…". ITG-03 is labelled "Automated" but the review found a manual step → treated as a candidate. |
| 7–8 | **Assumptions panel**: Daily min/run 30 → 60. | Totals and cells recalc live (295 → 520 h). Reload: still 60 (kept in this browser). Click **Reset defaults**. Threshold 5 → 0 cases (score-5 controls are already automated); back to 4. |
| 8–9 | Box "8 per-transaction controls: enter the annual volume": type 1200 for P2P-04, Enter. | It leaves the box, becomes a priced card (blue = overridden, "reset" link) and enters the totals. |
| 9–10 | Click a control ID → opens the review drawer. Then **Download report (.xlsx)**. | Sheet **Automation**: cases sorted by hours, cited cue, all numbers, total row, and the full assumption list at the bottom. |

Defaults (ADR 0013) are illustrative: 10 min per event (no default volume), 30 daily, 180 monthly…; 60 %/90 % removed;
CHF 110/h fully loaded; ITAC 40 h / RPA 80 h. Post: 3 lines in `docs/posts/2026-12-20-week-4.md`.
Known limits: approach rule is a cue-word heuristic (not measured on the holdout);
assumptions are kept in this browser (localStorage), per-control overrides reset on reload.
