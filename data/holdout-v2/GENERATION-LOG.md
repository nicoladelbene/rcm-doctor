# Holdout v2 — generation log

- Generator: `google/gemini-4-argon` via OpenRouter, temperature 0.7, prompt in `generation.json`.
- Reviewer frozen first: commit e6b88a8, hashes in `frozen-reviewer.sha256` (review.v2 prompt + rules).
- Attempt 1 (kept as `generation.rejected-1.json`): 12 German controls instead of 10, so it was rejected on structure.
- Attempts 2–4: 11 German each, rejected by the generator's own spec check and not written.
- The generator prompt was then made positional ("controls 1–10 are German"). Attempt 5 passed and is the holdout.
- No review output was looked at before the set was committed. Labels are the generator's and have not been edited.
