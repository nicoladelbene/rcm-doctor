# Eval — evidence tester (tick & tie)

Model `anthropic/claude-sonnet-5.5` · prompt `evidence.v1` · results `data/demo-evidence-results.json` (2026-11-15, 50.7 s) · ground truth `data/evidence/ground-truth.json` · `npm run eval:evidence`

| Metric | Value |
|---|---:|
| Controls / sample items × attributes | 5 / 189 |
| Planted exceptions found | 100% (3/3) |
| …with the box on the proving text | 3/3 |
| False exceptions on clean items | 0% (0/186) |
| Clean items left "not evidenced" (for a human) | 0 |
| Control conclusions correct | 5/5 |
| Results tied to a verified box / cell | 100% (139/139) |

| Control | Expected | Got | Planted | Found | False exc. | Not evidenced |
|---|---|---|---:|---:|---:|---:|
| P2P-05 | no_exceptions | no_exceptions | 0 | 0 | 0 | 0 |
| TRE-01 | exceptions | exceptions | 1 | 1 | 0 | 0 |
| R2R-01 | exceptions | exceptions | 2 | 2 | 0 | 0 |
| ITG-05 | no_exceptions | no_exceptions | 0 | 0 | 0 | 0 |
| ITG-06 | no_exceptions | no_exceptions | 0 | 0 | 0 | 0 |

## Honest caveats

- 5 synthetic controls, 3 planted exceptions, 160+ clean item × attribute cells including deliberate near-misses
  (an amount exactly at a threshold, a weekend inside a 2-business-day deadline, an unticketed session that was escalated in time).
- The evidence and the prompt were written by the same author: this is a regression test, not a benchmark.
- Demo text layers are exact (generated with the documents). Uploaded screenshots are transcribed by the vision model, so their boxes are approximate.
