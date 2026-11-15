# Model comparison (demo RCM, prompt review.v1, 2026-11-15)

| Model | Recall | FP on clean controls | Precision | Cost / 40 controls | Notes |
|---|---:|---:|---:|---:|---|
| anthropic/claude-sonnet-5.5 | **100%** (33/33) | **0%** (0/25) | 89% | ~USD 0.41 | default; precomputed demo |
| anthropic/claude-haiku-5.5 | 82% (27/33) | 4% (1/25) | 93% | ~USD 0.04 | misses all 3 "when / trigger" defects |

Deterministic rules alone (no LLM): 39% recall (13/33), 0% FP — every rule check at 100%.
Reproduce: `OPENROUTER_API_KEY=... npm run eval -- --live --model <id>`.
