# ROADMAP

One increment per weekend, one LinkedIn post per increment. Nicola may reorder.
Pause: Nicola in Japan until 30 Nov. Done = on main, CI green, eval green, GIF + post draft in `docs/`.

## Shipped: launch v0.5.0 (15 Nov 2026)

| Week | Goal | Scope | Done when | Post idea | Status |
|---|---|---|---|---|---|
| 1 | Review an RCM like a senior reviewer | 6 attributes + 6 rules, automation score, rewrite, demo, export, eval + holdout v1 | Demo recall ≥ 90%; holdout measured once with a frozen prompt | "I gave an AI a 40-control RCM with 33 planted defects." | ✅ |
| 1.1 | Fix what the holdout found | German owner/nature rules, SoD phrasings, `review.v2`, holdout v2 | German FP on unseen data drops, measured before/after on a new holdout | "My AI failed in German. Here is what I fixed." | ✅ |
| 2 | From control to test script | ToD walkthrough, ToE sample by frequency, traced attributes, blockers | Every attribute cites its phrase or says "not stated"; blocked controls are not tested | "From control description to audit test script" | ✅ |
| 3 | Tick & tie with receipts | Evidence upload (PDF/screenshot/CSV), matrix, boxes on the evidence | Planted exceptions found with a box on the proof; conclusion computed by code | "Tick & tie, automated, with receipts" | ✅ |
| 4 | Which controls should a robot do? | Heatmap + business case, editable assumptions | Every number traceable to a visible assumption; no invented volumes | "Which of your controls should a robot do?" | ✅ |
| 5 | Inside Claude | MCP server (stdio) + Claude skill | `npx` start, integration test, real Claude session recorded | "I asked Claude to review my RCM" | ✅ |
| Launch | One story | Lifecycle home, OG image, full-lifecycle video | e2e green on production; video recorded on production | `docs/posts/2026-11-15-launch.md` | ✅ |

## Week of 5–6 Dec: open work

Goal: close what the launch left open before starting anything new. Top up the OpenRouter credit first.

| Item | Scope | Done when | Post idea |
|---|---|---|---|
| **Week 6: AI-governance pack** (branch `week-6`, not merged) | Finish the AI review and test scripts for the 26 controls, re-check the ISO/IEC 42001 IDs, renumber its ADR to the next free number (0017), merge | Full AI run (no rules-only fallbacks), `eval:ai` reported honestly, GIF + post updated | "Who controls the AI that runs your controls?" |
| **English false positives** | Strict "frequency" / "when" readings (43% FP on clean English controls, holdout v2) | Measured on a NEW holdout v3, not on v2 | "Fixing false positives without fooling myself" |
| **Holdout v3** | New fictional company, another model family, EN/DE (+FR?) | Labels and reviewer hashes committed before the review | Part of the post above |
| **npm** (optional) | Publish the MCP server (needs Nicola's npm login) | `npx rcm-doctor-mcp` starts in < 3 s | — |

## After that

| Week | Goal | Scope | Done when | Post idea |
|---|---|---|---|---|
| Treasury module | Controls where money moves | Payments (release, urgent payments, beneficiary changes), bank accounts (opening, signatories), reconciliation controls on camt.053 statements; demo RCM + synthetic camt.053 evidence | Review + test scripts + tick & tie on camt.053 with planted exceptions; eval green | "Your bank statement is evidence. Let the robot tick it." |
| From the comments | Ideas from the launch post (e.g. FR/IT RCMs, CLI, ITGC pack, SOX mapping) | One per weekend | Same done criteria as above | Depends on the idea |
