---
name: rcm-doctor
description: Review a Risk & Control Matrix (RCM, internal controls, IKS, SOX, ICFR) and draft audit test scripts with the rcm-doctor MCP tools. Use when the user shares or mentions an RCM or a list of controls (xlsx/csv or pasted), asks whether controls are well designed, asks for findings, rewrites, segregation-of-duties issues, sample sizes, test of design / operating effectiveness, or test scripts.
---

# rcm-doctor

Two MCP tools from the `rcm-doctor` server do the work. Use them; do not review controls from memory when the tools are available.

| Tool | Use for |
|---|---|
| `review_rcm` | Design review of each control: pass / weak / fail, findings with the exact cited text, automation score 0–5, suggested rewrite. |
| `generate_test_scripts` | Test of design (walkthrough) and test of operating effectiveness (sample size by frequency, population, test attributes citing the phrase they test, exception definition). Controls with high-severity design findings come back as "blocked: remediate the design first". |

Both take the same input — pick one:
- `path`: the user's .xlsx / .xls / .csv file. Prefer an absolute path.
- `csv`: CSV text with a header row, when the user pastes controls. Convert a pasted table to CSV yourself; minimum columns are `Control ID` and `Control Description`; add `Control Owner`, `Frequency`, `Nature`, `Key Control`, `Evidence`, `Process` when known.
- `source: "demo"`: the built-in synthetic RCM (40 controls, Alpenfirn Industries AG, fictional), for "show me how it works".
- Optional `control_ids` to focus on a few controls; `rules_only: true` to skip the AI step.

## Workflow

1. Run `review_rcm` first. Summarise: counts (fail / weak / pass), the top issue types, then the failing controls worst first.
2. For each finding you mention, quote the cited text exactly as returned (`cited_text`), e.g. *TRE-03 — segregation of duties: “prepares and approves”*. If `cited_text` is null the attribute is missing: say "not stated", never invent a quote.
3. Offer the suggested rewrites for failing controls. Keep the user's terminology (role names, systems, thresholds).
4. When the user asks about testing, or the design is acceptable, run `generate_test_scripts`. Present blocked controls separately ("fix the design first") before the test-ready ones; give sample size with its basis, and the attributes with the phrase each one tests.
5. For more than ~10 controls, give the summary and the top issues, then offer details per control instead of printing everything.

## Modes — say which one ran

The tool output states the mode; repeat it in one line.
- **demo**: precomputed results from a real AI run, no key needed.
- **ai**: the server has `OPENROUTER_API_KEY`; design attributes, automation score and rewrites come from the review model, rules always run.
- **rules-only**: no key. Only the six deterministic checks (frequency mismatch, nature mismatch, owner not a role, segregation of duties, risk link, key control without evidence) and the deterministic parts of test scripts (sample size, blockers). You may add your own assessment of who / what / when / evidence / precision, but label it as yours and quote the control text verbatim for every point.

## Rules

- Traceability first: every finding you state must point to text in the user's RCM. No quote, no finding.
- Sample sizes are illustrative minimums by frequency, not a firm methodology: say so if the user will rely on them.
- Never ask the user to paste an API key into the chat. The key belongs in the MCP server's environment (see the README).
- This is a design-review aid, not audit advice. Synthetic demo data only in examples.
