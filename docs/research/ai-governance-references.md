# AI governance pack — reference verification log (2026-11-15)

Status of each source as checked on the web before writing any control. Use only rows marked VERIFIED; leave the
mapping empty where a reference is unverified.

## EU AI Act — Regulation (EU) 2024/1689
Source read: artificialintelligenceact.eu article pages (EUR-Lex returned an empty body; re-check against EUR-Lex).
VERIFIED (number + title + content): Art. 4 (AI literacy) · Art. 5(1) (prohibited practices) · Art. 6(2) + Annex III
(5(b) creditworthiness of natural persons, 5(c) life/health insurance pricing, 4(a)/(b) employment) · Art. 9 (risk
management system) · Art. 10(2)(f) bias examination, 10(3) data relevant/representative/error-free/complete · Art. 11 +
Annex IV (technical documentation) · Art. 12(1) automatic event logs · Art. 13 (information to deployers) · Art. 14(4)(a)–(e)
human oversight incl. override (d) and stop (e) · Art. 15 (accuracy, robustness, cybersecurity) · Art. 17 (QMS) ·
Art. 19(1) provider logs ≥ 6 months · Art. 25(1)(b) substantial modification makes a deployer a provider ·
Art. 26(1), (2), (4), (5) deployer obligations (verbatim) · Art. 26(6), (7), (11) (numbering from page summary) ·
Art. 27(1) FRIA incl. deployers of Annex III 5(b)/(c) · Art. 50(1) (provider duty) and 50(4) · Art. 72 post-market
monitoring · Art. 73(2) 15 days, 73(3) 2 days, 73(4) 10 days · Art. 3(49) serious incident.
CAUTION: Art. 113 dates on the page reflect amendments (Annex III high-risk 2 Dec 2027; Annex I 2 Aug 2028). Verify on
EUR-Lex before stating any application date.

## ISO/IEC 42001:2023
Annex A IDs/titles from ONE public source (isms.online; ISO OBP returned 403). NOT cross-checked → treat as unverified
until a second source confirms: A.2.2–A.2.4, A.3.2–A.3.3, A.4.2–A.4.6, A.5.2–A.5.5, A.6.1.2–A.6.1.3, A.6.2.2–A.6.2.8
(A.6.2.6 operation and monitoring, A.6.2.8 event logs), A.7.2–A.7.6 (A.7.4 data quality, A.7.5 provenance),
A.8.2–A.8.5 (A.8.4 communication of incidents), A.9.2–A.9.4, A.10.2–A.10.4 (A.10.3 suppliers).
Clause sub-numbers (6.1.2, 6.1.4, 8.4, 9.1 …): NOT verified.

## NIST AI RMF 1.0 (AI 100-1) — via airc.nist.gov Playbook
VERIFIED verbatim: GOVERN 1.1, 1.5, 1.6 (inventory), 1.7, 2.1; MAP 1.1, 1.5; MEASURE 1.1, 2.1, 2.3, 2.4 (monitored in
production); MANAGE 1.3.
VERIFIED topic (summary wording): GOVERN 2.2, 3.2, 4.3, 5.1, 6.1, 6.2; MAP 2.1, 3.4, 3.5 (human oversight), 4.1, 5.1;
MEASURE 2.5, 2.7, 2.8, 2.9, 2.10, 2.11 (fairness/bias), 3.1; MANAGE 2.3, 2.4, 3.1, 3.2, 4.1, 4.3 (incidents communicated).

## FINMA
VERIFIED from the PDF (finma.ch, FINMA Guidance 08/2024 "Governance and risk management when using artificial
intelligence", 18 Dec 2024): 2 Findings from supervision — 2.1 Governance (incl. inventory, responsibilities, training,
outsourcing: additional tests, controls, contractual clauses) · 2.2 Inventory and risk classification · 2.3 Data
quality · 2.4 Tests and ongoing monitoring (accuracy, robustness, stability, bias; thresholds; data drift; analysis of
outputs ignored or changed by users) · 2.5 Documentation · 2.6 Explainability · 2.7 Independent review.
FINMA guidance "does not have legal impact" (not binding): it states supervisory observations.

## Decision for the pack
ISO/IEC 42001 Annex A IDs are used although only one public listing could be read (ISO's own pages are paywalled /
blocked); a second check (Drata, Vanta: 404; ISO: 403) failed. They are flagged as such in ADR 0015 — re-check against
a licensed copy of the standard before relying on them.
