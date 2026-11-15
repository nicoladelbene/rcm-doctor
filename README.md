# rcm-doctor

[![CI](https://github.com/nicoladelbene/rcm-doctor/actions/workflows/ci.yml/badge.svg)](https://github.com/nicoladelbene/rcm-doctor/actions/workflows/ci.yml)

**An open-source AI reviewer for Risk & Control Matrices (internal controls / IKS / SOX).**
It covers the control lifecycle, **Review → Test → Evidence → Automate**, and works inside Claude via MCP.
Every finding cites the exact text behind it, and the review is measured against ground truth, including holdouts it never saw.

![Review → Test → Evidence → Automate in 30 seconds](docs/media/launch-lifecycle.gif)

### Try it in 30 seconds → **[https://rcm-doctor.vercel.app](https://rcm-doctor.vercel.app/?demo)**

No API key needed: the demo opens a synthetic 40-control RCM (*Alpenfirn Industries AG*, fictional) with precomputed results.
The home page links each lifecycle step straight to its demo view.

---

## Why

Risk & Control Matrices are the backbone of every internal control system. For Swiss companies under ordinary audit, the auditor confirms that an internal control system (IKS) exists (Art. 728a OR). In practice RCMs are full of controls that are hard to test and hard to automate. Typical problems:

- no clear owner, or a person's name instead of a role
- vague verbs: *"Finance ensures invoices are correct"*
- no trigger or timing, and a frequency that contradicts the frequency column
- no evidence defined, and no precision threshold for review controls
- the same role preparing and approving

rcm-doctor finds these problems, shows where they are in the text and proposes a rewrite.

## The lifecycle

### 1 · Review: what it checks

**Six design attributes** (AI review, each with a cited span or flagged as missing):

| | Attribute | Passes when… |
|---|---|---|
| 1 | **Who** | the performer is a *role*, not a person or a department |
| 2 | **What** | there is a concrete action: review, reconcile, compare, approve, block |
| 3 | **When** | there is a timing or trigger: "within 3 business days after month-end", "before payment release" |
| 4 | **Frequency** | the frequency is stated and plausible for the risk |
| 5 | **Evidence** | the text says what is retained and where |
| 6 | **Precision** | review controls have a threshold or investigation criterion ("> CHF 10k or 5%") |

**Six consistency rules** (deterministic, no AI): frequency in the description vs. the frequency column · *automated* controls that describe manual steps · owner empty or a person's name · segregation-of-duties conflict ("prepares and approves") · missing risk ID or control objective · key control without evidence.

**Per control:** status (pass / weak / fail), findings with severity, an **automation score** from 0 (pure judgment) to 5 (system-enforceable, ITAC candidate), and a **suggested rewrite** that invents nothing material. Missing facts become `[placeholders]`.

### 2 · Test: test scripts

For each control: a test of design (walkthrough steps) and a test of operating effectiveness, with the sample size from the frequency (illustrative minimums, configurable), the population, test attributes that each point to the phrase they test, and an exception definition. Controls with high-severity design findings are marked **"remediate the design first"** instead of being tested.

### 3 · Evidence: tick & tie

Upload the evidence for a control (PDF, screenshot or CSV) and the agent ticks & ties every sampled item against every test attribute: ✓ met, ✗ exception, ? not evidenced, – n/a. Each result draws a **box on the PDF page or screenshot** (or outlines the CSV cell) where the proof is, and links back to the phrase of the control it tests. A box is drawn only where code found the quoted text in the evidence; the conclusion is computed from the results, not by the model. The demo ships synthetic evidence for 5 controls, two with planted exceptions.

### 4 · Automate: heatmap and business case

A process × control-type heatmap of the automation score. For each control scoring ≥ 4, a business case: hours saved per year from the frequency, **ITAC or RPA/script** (with the words that justify the choice cited), prerequisites, payback, and "remediate the design first" where needed. Every assumption (minutes per run, volumes, share of effort removed, hourly rate, build effort) is on screen, editable and exported. Per-transaction controls stay out of the totals until you enter their volume. No extra AI call.

### Use it inside Claude (MCP server + skill)

rcm-doctor ships an [MCP](https://modelcontextprotocol.io) server (stdio) with two tools, built on the same `src/core` as the web app:

| Tool | What it does |
|---|---|
| `review_rcm` | Design review per control: pass / weak / fail, findings that each cite the exact source text, automation score, suggested rewrite. |
| `generate_test_scripts` | Test of design + test of operating effectiveness: sample size by frequency, population, test attributes traced to the text, "remediate first" blockers. |

Input: `path` to an .xlsx/.xls/.csv RCM, `csv` text, or `source: "demo"` (the synthetic 40-control RCM, no key needed). Optional `control_ids`.
Without `OPENROUTER_API_KEY` in the server's environment it runs the deterministic rules (or the precomputed demo); with it, the full AI review. The key stays in your config: it is never logged or returned by a tool.

![Asking Claude to review an RCM through the MCP server](docs/media/week-5-demo.gif)

**Claude Code**

```bash
claude mcp add rcm-doctor -- npx -y github:nicoladelbene/rcm-doctor
# optional, for the AI step:
claude mcp add rcm-doctor -e OPENROUTER_API_KEY=sk-or-... -- npx -y github:nicoladelbene/rcm-doctor
```

**Claude Desktop** — Settings → Developer → Edit config (`claude_desktop_config.json`), then restart:

```json
{
  "mcpServers": {
    "rcm-doctor": {
      "command": "npx",
      "args": ["-y", "github:nicoladelbene/rcm-doctor"],
      "env": { "OPENROUTER_API_KEY": "sk-or-... (optional)" }
    }
  }
}
```

From a clone (faster start, no download): `npm ci`, then use `"command": "node", "args": ["/path/to/rcm-doctor/mcp/dist/rcm-doctor-mcp.mjs"]`, or `npm run mcp` to run it from source.

**Skill** — [`skills/rcm-doctor/SKILL.md`](skills/rcm-doctor/SKILL.md) tells Claude when to use the tools and how to present results (quote the cited text, never invent a finding, say which mode ran).
Claude Code: copy the folder to `~/.claude/skills/rcm-doctor/` (or `.claude/skills/` in a project). Claude apps: zip the `rcm-doctor` folder and upload it under Settings → Capabilities → Skills.

Then ask: *"Review the Treasury controls in my RCM (~/Documents/my-rcm.xlsx). What should I fix first?"* — or *"Show me rcm-doctor on the demo RCM"*.

### Traceability, everywhere

The model quotes; code locates the quote in your RCM or evidence and computes the offsets. A quote that cannot be found is dropped, never shown. The Excel export records every cited span with its field and offsets.

## Evaluation: honest numbers

All runs use the default model (`anthropic/claude-sonnet-5.5`). Recall = labelled defects found; FP = clean controls with at least one finding.

| Set | System | Controls | Defects | Recall | FP on clean | Precision |
|---|---|---:|---:|---:|---:|---:|
| **Demo** (authored with the prompt — *regression test, not a benchmark*) | Week 1.1 (`review.v2`) | 40 EN | 33 | **100%** (33/33) | **4%** (1/25) | 85% |
| **Holdout v1** — gpt-5.6-sol, first measurement | Week 1 (`review.v1`) | 30 (10 DE) | 28 | 82% (23/28) | 17% (2/12) | 82% |
| **Holdout v2** — gemini-4-argon, never seen | Week 1 (baseline) | 30 (10 DE) | 63 | 86% (54/63) | 58% (7/12) | 76% |
| **Holdout v2** — gemini-4-argon, never seen | **Week 1.1** (`review.v2`) | 30 (10 DE) | 63 | **92%** (58/63) | **25%** (3/12) | 84% |

By language:

| | Holdout v1 · Week 1 | Holdout v2 · Week 1 | Holdout v2 · Week 1.1 |
|---|---|---|---|
| English: recall / FP on clean | 89% / 0% (0/8) | 88% / 43% (3/7) | 90% / 43% (3/7) |
| German: recall / FP on clean | 70% / 50% (2/4) | 81% / 80% (4/5) | **95% / 0%** (0/5) |

**Methodology:** for each holdout, a non-Claude model generated 30 controls for a new fictional Swiss company (10 in German, Swiss IKS terms) and labelled the defects in the same call. The labels were committed before any review. The reviewer was frozen first, with SHA-256 hashes in `data/holdout*/`. Labels are the generator's and were not edited, so the numbers include the generator's own label noise. Holdout v2 was generated *after* the Week 1.1 fixes were frozen. Its rejected attempts and the one post-freeze change are listed in [`data/holdout-v2/GENERATION-LOG.md`](data/holdout-v2/GENERATION-LOG.md).

### Changelog (honest version)
- **Week 1.1** (Nov 15): German rules (`Leiter …` / `…verantwortliche` are roles, German departments are flagged, `manuell` is recognised), more segregation-of-duties phrasings, and SoD assessed by the AI as well (prompt `review.v2`).
  - **German on unseen data:** false positives on clean German controls went from 80% to 0%, and German recall from 81% to 95% (holdout v2, same model, same day).
  - **Not fixed:** English false positives on holdout v2 are still 43% (3/7 clean controls), mostly a strict "frequency"/"when" reading. Frequency-mismatch catches 1 of 3 cases.
  - **Demo:** one new false positive (1/25), which was 0/25 with v1.
- Holdout v1 re-run with Week 1.1 scores 100% / 0%, but that set was **seen** while writing the fixes, so it is not evidence and is not in the table ([report](docs/eval-holdout-v1-rerun.md)).
- **Transport fix after the freeze:** the token budget was raised and truncated answers are now reported as such, because Sonnet 5.5 reasoning tokens truncated long German batches. The prompt and rules were not changed.
- **Week 1** (Nov 15): first release; holdout v1 measured once with the frozen `review.v1`.

Other models on the demo set (`review.v1`): Haiku 5.5 reaches 82% recall with 4% false positives (~USD 0.04 per 40 controls, vs ~USD 0.41 for Sonnet). Rules alone reach 39% recall with 0% false positives.
**Evidence tester** (Week 3; 5 controls with synthetic evidence, 189 sample-item × attribute cells, 2 controls with planted exceptions): planted exceptions found **3/3** (box on the proving text 3/3), false exceptions **0/186**, control conclusions 5/5. Also authored together with the feature, so again a *regression test, not a benchmark* ([report](docs/eval-evidence.md), `npm run eval:evidence`).

The demo and evidence sets were written together with the prompts: they catch regressions, they do not prove accuracy. The holdouts are the honest numbers, and they include label noise from the generating model.

Reports: [`docs/eval-latest.md`](docs/eval-latest.md) · [`docs/eval-holdout.md`](docs/eval-holdout.md) (v1) · [`docs/eval-holdout-v2.md`](docs/eval-holdout-v2.md) · [`docs/eval-holdout-v2-baseline.md`](docs/eval-holdout-v2-baseline.md) · [`docs/eval-models.md`](docs/eval-models.md). Reproduce offline: `npm run eval`, `npm run eval:holdout`, `npm run eval:holdout2`. All run in CI.

## Use your own RCM

1. Click **Upload your RCM** and drop an `.xlsx` or `.csv` file. Common header variants are mapped automatically ("Owner", "Control activity", "Periodicity" …), and you confirm the mapping. You can also start from the [template](public/rcm-template.xlsx).
2. **No key:** the six consistency rules run instantly in your browser.
3. **With an [OpenRouter](https://openrouter.ai/keys) key:** you also get the six attributes, the automation score and the rewrite. Pick any model.
4. **Download report (.xlsx):** your original columns plus status, findings, cited text, automation score and rewrite.

**Privacy:** files are parsed in your browser. For the AI review, controls are sent in batches to this app's `/api/review` endpoint, which forwards them to OpenRouter with your key. The key is never logged or stored, and results are cached only in your browser's localStorage. Even so, use synthetic or anonymised data.

## Run locally

```bash
git clone https://github.com/nicoladelbene/rcm-doctor && cd rcm-doctor
npm install
npm run dev                      # http://localhost:3000

npm test                         # unit tests (vitest)
npm run eval                     # eval against the committed demo results
OPENROUTER_API_KEY=... npm run eval -- --live --model anthropic/claude-haiku-5.5
npm run test:e2e                 # Playwright end-to-end (E2E_BASE_URL=https://rcm-doctor.vercel.app for production)
npm run eval:holdout2            # holdout v2 (offline, committed results)
npm run mcp                      # MCP server from source (stdio)
npm run gen:demo                 # regenerate the synthetic RCM + ground truth
OPENROUTER_API_KEY=... npm run precompute   # regenerate demo results
```

## Architecture in brief

| Layer | Where | Notes |
|---|---|---|
| Core logic | [`src/core`](src/core) | Plain TypeScript, no framework imports: parse, rules, LLM transport, review, test scripts, evidence, automation, export, eval. |
| Prompts | [`src/core/prompts`](src/core/prompts) | Versioned (`review.v2`, `testscript.v1`, `evidence.v1`); holdout runs pin the reviewer by hash. |
| Web app | [`src/app`](src/app) | Next.js 16 on Vercel. BYOK: `/api/*` forwards to OpenRouter with the user's key, never stored. Demo = precomputed JSON in [`data/`](data). |
| MCP server | [`mcp/`](mcp) | stdio, two tools over `src/core`, bundled to `mcp/dist/rcm-doctor-mcp.mjs` (CI checks it is up to date). Skill in [`skills/rcm-doctor`](skills/rcm-doctor). |
| Eval | [`scripts/`](scripts), [`docs/eval-*.md`](docs) | Offline against committed results; runs in CI on every push. |
| Decisions | [`docs/decisions`](docs/decisions) | One ADR per decision (0001–0016). History: [`docs/history`](docs/history). |

## Known limits

- **English false positives on holdout v2: 43%** (3/7 clean controls), mostly a strict reading of "frequency" and "when".
- Demo and evidence sets are **regression tests, not benchmarks**; holdout labels include the generating model's noise.
- Sample sizes and automation assumptions are **illustrative defaults**, not a methodology: adjust them to yours.
- The ITAC vs RPA/script choice is a cue-word heuristic, not measured on a holdout.
- Screenshot evidence is transcribed by a vision model, so its boxes are approximate.
- No rate limiting on `/api/*` (BYOK); per-request input limits apply. Dark mode is not implemented.
- Not on npm yet: the MCP server starts via `npx -y github:nicoladelbene/rcm-doctor` (about 15 s on first start).

## Roadmap

Weekly increments, one post each: see [docs/ROADMAP.md](docs/ROADMAP.md) and [CHANGELOG.md](CHANGELOG.md).
Next: the AI-governance control pack (built on a branch, its AI run still to finish), English false positives, holdout v3, npm, then a Treasury module (payments, bank accounts, camt.053 reconciliation).

## Disclaimer

Personal project by Nicola Del Bene. Views are my own; not affiliated with or endorsed by any employer. All demo data is synthetic: *Alpenfirn Industries AG* is a fictional company. This is a design-review aid, not audit advice.

## License

[Apache-2.0](LICENSE)
