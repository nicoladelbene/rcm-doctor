# 0013 — Week 4: automation heatmap + business case (deterministic, assumptions in the open)

- Status: accepted (on branch week-4)
- Date: 2026-11-15

## Context
ROADMAP Week 4: which controls should a robot do? A process × control-type view of the automation score, and for each
control with score ≥ 4 a mini business case: hours saved per year from the frequency, approach (ITAC or RPA/script),
prerequisites. Assumptions must be declared and editable in the UI. Traceability remains the brand.

## Decision
- **No new LLM call.** The automation score (0–5) comes from the existing review (`review.v1`, prompt frozen for the
  holdout). Everything else is arithmetic in `src/core/automation.ts`, so it works in demo mode, rules-only and offline.
- **Hours saved = occurrences/yr × minutes/occurrence ÷ 60 × share of effort removed.** Occurrences and minutes come
  from a table by frequency; the share removed depends on the score (4 → 60 %, 5 → 90 %). CHF = hours × hourly rate.
  Payback = build hours (ITAC 40 h, RPA/script 80 h) ÷ hours saved. Verdict: strong ≤ 12 months, moderate ≤ 36, else weak.
- **All numbers are `DEFAULT_ASSUMPTIONS`, illustrative and generic**, shown in an Assumptions panel where each can be
  changed (plus per-control overrides of volume and minutes, since "per transaction" volume is unknowable from an RCM).
  The assumptions are exported with the cases (sheet "Automation") and kept in the viewer's browser (localStorage,
  sanitised on load; "Reset defaults" clears it). No firm methodology or benchmark is used.
- **Approach by rule, with a citation.** ITAC when the control is preventive, runs in a system of record (not
  SharePoint/Excel/e-mail) and the text names an enforceable check (match, block, tolerance, approval, workflow…);
  otherwise RPA/script. The cue word is cited as a verified span of the control description, like every finding.
- **Already automated** controls (automated nature, no nature-mismatch finding) are shown, not counted: 0 hours.
  "Automated" controls with a nature-mismatch finding are treated as manual candidates.
- **Design first.** High-severity design findings (same set as the test-script blockers, ADR 0012) are shown as
  "remediate the design first"; precision / SoD / evidence findings also become prerequisites ("a robot needs a number").
- The heatmap groups by process × control type (Preventive / Detective / other values as found); colour = average score.

## Consequences
Demo RCM with defaults: 15 candidates, 695 h/yr (≈ 0.41 FTE), CHF 76k/yr, 880 build hours (≈ 15 months payback
overall), 4 already automated, 4 candidates need a design fix first. The numbers are only as good as the assumptions —
which is why they are on screen and in the export. The cue-word approach rule is a heuristic, not tested against a holdout.
