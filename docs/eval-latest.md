# Eval — latest

_Generated 2026-11-15 · model `anthropic/claude-sonnet-5.5` · prompt `review.v2` · source: data/demo-results.json (2026-11-15)_

Evaluated on **40 synthetic controls** with **33 planted defects** (15 defective controls, 25 clean).

| Metric | Value |
|---|---|
| Recall (planted defects found) | **100%** (33/33) |
| False-positive rate on clean controls | **4%** (clean controls with ≥1 finding) |
| Precision (findings that match ground truth) | 85% (6 extra findings) |

## Per check

| Check | Planted | Found | Missed | Extra | Recall |
|---|---:|---:|---:|---:|---:|
| Who — performer role (`who`) | 4 | 4 | 0 | 1 | 100% |
| What — concrete action (`what`) | 3 | 3 | 0 | 1 | 100% |
| When — timing / trigger (`when`) | 3 | 3 | 0 | 1 | 100% |
| Frequency (`frequency`) | 2 | 2 | 0 | 0 | 100% |
| Evidence retained (`evidence`) | 3 | 3 | 0 | 1 | 100% |
| Precision / threshold (`precision`) | 5 | 5 | 0 | 2 | 100% |
| Frequency mismatch (`freq_mismatch`) | 2 | 2 | 0 | 0 | 100% |
| Nature mismatch (`nature_mismatch`) | 2 | 2 | 0 | 0 | 100% |
| Owner not a role (`owner_invalid`) | 3 | 3 | 0 | 0 | 100% |
| Segregation of duties (`sod_conflict`) | 2 | 2 | 0 | 0 | 100% |
| Risk / objective link (`missing_risk_link`) | 2 | 2 | 0 | 0 | 100% |
| Key control without evidence (`key_no_evidence`) | 2 | 2 | 0 | 0 | 100% |

## Misses

- none

## Extra findings (not in ground truth)

- O2C-04: `what` — Supporting documents are mentioned, but 'appropriateness' and 'followed up' are vague; define what is checked and how follow-up is done.
- O2C-04: `precision` — Criterion is not defined; specify the population (e.g. all changes to credit limits, payment terms, bank data) and what counts as authorised.
- TRE-03: `evidence` — Name the artefact (e.g. invoice copy, approval record) and its exact location in e-banking.
- TRE-03: `precision` — Threshold sets scope only; approval criteria are undefined and payments up to CHF 1,000 are not addressed.
- TRE-04: `when` — Deadline covers preparation only; add when the Group Treasurer completes the review.
- ITG-04: `who` — A team is named rather than a role; name the role that disables accounts, e.g. Service Desk Agent.

Ground truth: `data/demo-rcm.ground-truth.json`. Reproduce: `npm run eval` (set `OPENROUTER_API_KEY` and add `-- --live` for a live run).
