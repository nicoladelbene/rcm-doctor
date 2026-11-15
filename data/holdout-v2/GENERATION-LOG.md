# Holdout v2 — generation log

- Generator: `google/gemini-4-argon` via OpenRouter, temperature 0.7, prompt in `generation.json`.
- Reviewer frozen first: commit e6b88a8, hashes in `frozen-reviewer.sha256` (review.v2 prompt + rules).
- Attempt 1 (kept as `generation.rejected-1.json`): 12 German controls instead of 10, so it was rejected on structure.
- Attempts 2–4: 11 German each, rejected by the generator's own spec check and not written.
- The generator prompt was then made positional ("controls 1–10 are German"). Attempt 5 passed and is the holdout.
- No review output was looked at before the set was committed. Labels are the generator's and have not been edited.

## Change after the freeze (transport only)
- The first review runs failed on the same batches with "invalid JSON". The cause: Sonnet 5.5 spends ~3.5k reasoning tokens
  inside `max_tokens`, so long German batches were truncated (`finish_reason: length`).
- Fix in `src/core/llm.ts`: the token budget went from 1200×n+500 to 2000×n+4000, and truncation is reported explicitly.
  `review.v2.md` and `rules.ts` are unchanged (hashes still match `frozen-reviewer.sha256`), while `llm.ts` no longer does.
- The precompute script now retries OpenRouter 402/429 (credit reservation, new-account rate limit).
- Results: `holdout-results.json` (Week 1.1) and `holdout-results.baseline-week1.json` (Week 1 code at 6101f2e, run from a git worktree).
