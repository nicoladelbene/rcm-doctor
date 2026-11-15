# Eval — latest

_Generated 2026-11-15 · model `anthropic/claude-sonnet-5.5` · prompt `review.v1` · source: data/ai-pack-results.json (2026-11-15)_

Evaluated on **26 synthetic controls** with **18 planted defects** (5 defective controls, 21 clean).

| Metric | Value |
|---|---|
| Recall (planted defects found) | **72%** (13/18) |
| False-positive rate on clean controls | **48%** (clean controls with ≥1 finding) |
| Precision (findings that match ground truth) | 43% (17 extra findings) |

## Per check

| Check | Planted | Found | Missed | Extra | Recall |
|---|---:|---:|---:|---:|---:|
| Who — performer role (`who`) | 3 | 2 | 1 | 1 | 67% |
| What — concrete action (`what`) | 2 | 1 | 1 | 1 | 50% |
| When — timing / trigger (`when`) | 2 | 1 | 1 | 5 | 50% |
| Frequency (`frequency`) | 1 | 1 | 0 | 1 | 100% |
| Evidence retained (`evidence`) | 2 | 1 | 1 | 1 | 50% |
| Precision / threshold (`precision`) | 2 | 1 | 1 | 7 | 50% |
| Frequency mismatch (`freq_mismatch`) | 1 | 1 | 0 | 0 | 100% |
| Nature mismatch (`nature_mismatch`) | 1 | 1 | 0 | 0 | 100% |
| Owner not a role (`owner_invalid`) | 2 | 2 | 0 | 1 | 100% |
| Segregation of duties (`sod_conflict`) | 1 | 1 | 0 | 0 | 100% |
| Risk / objective link (`missing_risk_link`) | 0 | 0 | 0 | 0 | — |
| Key control without evidence (`key_no_evidence`) | 1 | 1 | 0 | 0 | 100% |

## Misses

- AIV-03: `who`
- AIV-03: `what`
- AIV-03: `when`
- AIV-03: `evidence`
- AIV-03: `precision`

## Extra findings (not in ground truth)

- AIG-02: `precision` — Criteria for the high/medium/low rating and the CRO's approval basis are not defined.
- AIG-03: `precision` — Content areas are listed, but no approval criteria or conditions for rejection or rework are defined.
- AIG-03: `frequency` — Only an implied one-time trigger; the column says 'Per change', so state whether reassessment on change is required.
- AIG-04: `precision` — No review criteria are defined, such as regulatory changes, incidents or RACI gaps to be checked.
- AIG-04: `when` — Only a frequency word; no fixed timing such as a month or deadline relative to the policy cycle.
- AID-03: `precision` — The DPO's approval criteria are not defined, for example a valid legal basis or licence covering AI training.
- AID-04: `evidence` — The description does not say what evidence of the alert and its review is kept, or where.
- AID-04: `what` — Calculation and alerting are concrete, but 'reviewed' does not say what the reviewer does or what happens after review.
- AID-04: `when` — The alert trigger is defined, but there is no deadline for reviewing the alert after it is raised.
- AIM-04: `who` — A function is named, not a role; name the role performing and signing off the review, e.g. Head of Internal Audit.
- AIM-04: `precision` — 'Material' is not defined; state the criteria or inventory that determines which AI systems are in scope.
- AIM-04: `when` — Only a frequency word; no fixed timing or deadline for fieldwork or for reporting to the Audit Committee.
- AIM-05: `precision` — Standard is referenced but completeness criteria and handling of deficiencies are not defined; name the standard and rejection rule.
- AIV-01: `precision` — No approval criteria are defined, e.g. minimum answers or conditions for rejection or escalation.
- AIV-02: `owner_invalid` — Owner "Legal Counsel" looks like a person's name. Use a role, so the control survives staff changes.
- AIL-03: `when` — Monthly cadence is stated but not the deadline or trigger, e.g. within X business days after month-end.
- AIL-04: `when` — Blocks occur in real time, but the weekly review lacks a fixed day or deadline.

Ground truth: `data/ai-pack.ground-truth.json`. Reproduce: `npm run eval:ai` (set `OPENROUTER_API_KEY` and add `-- --live` for a live run).
