# Eval — latest

_Generated 2026-11-15 · model `anthropic/claude-sonnet-5.5` · prompt `review.v1` · source: data/demo-results.json (2026-11-15)_

Evaluated on **40 synthetic controls** with **33 planted defects** (15 defective controls, 25 clean).

| Metric | Value |
|---|---|
| Recall (planted defects found) | **100%** (33/33) |
| False-positive rate on clean controls | **0%** (clean controls with ≥1 finding) |
| Precision (findings that match ground truth) | 89% (4 extra findings) |

## Per check

| Check | Planted | Found | Missed | Extra | Recall |
|---|---:|---:|---:|---:|---:|
| Who — performer role (`who`) | 4 | 4 | 0 | 1 | 100% |
| What — concrete action (`what`) | 3 | 3 | 0 | 1 | 100% |
| When — timing / trigger (`when`) | 3 | 3 | 0 | 0 | 100% |
| Frequency (`frequency`) | 2 | 2 | 0 | 0 | 100% |
| Evidence retained (`evidence`) | 3 | 3 | 0 | 1 | 100% |
| Precision / threshold (`precision`) | 5 | 5 | 0 | 1 | 100% |
| Frequency mismatch (`freq_mismatch`) | 2 | 2 | 0 | 0 | 100% |
| Nature mismatch (`nature_mismatch`) | 2 | 2 | 0 | 0 | 100% |
| Owner not a role (`owner_invalid`) | 3 | 3 | 0 | 0 | 100% |
| Segregation of duties (`sod_conflict`) | 2 | 2 | 0 | 0 | 100% |
| Risk / objective link (`missing_risk_link`) | 2 | 2 | 0 | 0 | 100% |
| Key control without evidence (`key_no_evidence`) | 2 | 2 | 0 | 0 | 100% |

## Misses

- none

## Extra findings (not in ground truth)

- O2C-04: `what` — Review is stated but 'appropriateness' and the supporting documents are not defined.
- O2C-04: `precision` — 'Unauthorised' is not defined; state what counts as an exception, e.g. no approved change request.
- TRE-03: `evidence` — Name the artefact (e.g. approval record, invoice copy) and its exact location.
- ITG-04: `who` — A team is named rather than a role; specify who performs the deactivation, e.g. Service Desk Agent.

Ground truth: `data/demo-rcm.ground-truth.json`. Reproduce: `npm run eval` (set `OPENROUTER_API_KEY` for a live run).
