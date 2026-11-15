/**
 * Week 6 — "AI systems controls pack": a ready-to-use RCM module of 25 controls for AI systems, written for the
 * fictional Alpenfirn Industries AG as a DEPLOYER of AI (CV screening, credit-limit scoring of business customers,
 * invoice coding, demand forecasting, a GenAI assistant, a vendor chatbot).
 *
 * Framework references: only references checked on the web on 2026-11-15 are used
 * (log: docs/research/ai-governance-references.md). Where no verified reference fits, the field is left empty.
 *  - EU AI Act = Regulation (EU) 2024/1689 (article text read on artificialintelligenceact.eu)
 *  - ISO/IEC 42001:2023 Annex A (IDs/titles from a public listing; the standard itself is paywalled)
 *  - NIST AI RMF 1.0 (AI 100-1) subcategories (NIST AI RMF Playbook)
 *  - FINMA Guidance 08/2024 sections 2.1–2.7 (PDF read; guidance, not binding law)
 * Six rows carry planted design defects (ground truth in `defects`), like the Week 1 demo.
 */
import type { DemoRow } from "./demo-rcm-data";

export interface AiRow extends DemoRow {
  refs: { euAiAct: string; iso42001: string; nistAiRmf: string; finma: string };
}

const S = "AI inventory (ServiceNow), SharePoint";

export const AI_ROWS: AiRow[] = [
  /* ------------------------- Inventory and classification ------------------------- */
  {
    id: "AIG-01", process: "AI governance", sub: "Inventory", riskId: "R-AIG-01",
    risk: "AI systems are used without being known to risk management, so their risks are not assessed or controlled.",
    objective: "All AI systems in development or use are recorded in a complete, central inventory.",
    desc: "Each quarter, within 15 business days after quarter-end, the AI Governance Officer reconciles the central AI inventory in ServiceNow with the IT application register, the procurement contract list (contracts tagged 'AI' or with AI features) and the list of enabled GenAI tools. Every system found outside the inventory is added within 10 business days with an owner, purpose and provisional risk class. The signed reconciliation is retained in the AI governance SharePoint folder.",
    owner: "AI Governance Officer", freq: "Quarterly", type: "Detective", nature: "IT-dependent manual", key: true,
    evidence: "Signed quarterly inventory reconciliation", systems: S, assertions: "Completeness",
    refs: { euAiAct: "", iso42001: "A.4.2", nistAiRmf: "GOVERN 1.6", finma: "2.1; 2.2" }, defects: [],
  },
  {
    id: "AIG-02", process: "AI governance", sub: "Risk classification", riskId: "R-AIG-02",
    risk: "A high-risk or prohibited AI use is not identified, so legal obligations are missed.",
    objective: "Every AI system is classified against the EU AI Act and internal materiality criteria before use.",
    desc: "Before an AI system is put into use or its intended purpose changes, the AI Governance Officer classifies it with the AI classification questionnaire: prohibited practice (EU AI Act Art. 5), high-risk under Annex III, transparency obligations, or minimal risk, plus the internal materiality rating (high / medium / low). The classification is reviewed and approved by the Chief Risk Officer, and no system is enabled in production without an approved classification in the AI inventory.",
    owner: "AI Governance Officer", freq: "Per change", type: "Preventive", nature: "IT-dependent manual", key: true,
    evidence: "Approved classification questionnaire in the AI inventory", systems: S, assertions: "Compliance",
    refs: { euAiAct: "Art. 5(1); Art. 6(2) + Annex III", iso42001: "A.5.2", nistAiRmf: "MAP 1.1; MAP 1.5", finma: "2.2" }, defects: [],
  },
  {
    id: "AIG-03", process: "AI governance", sub: "Impact assessment", riskId: "R-AIG-03",
    risk: "Effects of a high-risk AI system on individuals' fundamental rights are not assessed before use.",
    objective: "High-risk AI systems have a documented impact assessment before first use.",
    desc: "Before first use of a high-risk AI system, the business owner completes an impact assessment covering the affected persons, the specific risks of harm, the human-oversight measures and the complaint mechanism. The AI Governance Officer reviews it and the AI Committee approves it; the approved assessment is stored with the system's inventory record.",
    owner: "AI Committee", freq: "Per change", type: "Preventive", nature: "Manual", key: true,
    evidence: "Approved impact assessment in the AI inventory", systems: S, assertions: "Compliance",
    refs: { euAiAct: "Art. 27(1)", iso42001: "A.5.2; A.5.3; A.5.4", nistAiRmf: "MAP 5.1", finma: "" }, defects: [],
  },
  {
    id: "AIG-04", process: "AI governance", sub: "Policy and roles", riskId: "R-AIG-04",
    risk: "Responsibilities for AI risks are unclear, so risks fall between business, IT and compliance.",
    objective: "An approved AI policy assigns accountable roles for every AI system.",
    desc: "Annually, the AI Committee reviews the AI policy, including the RACI for development, deployment, monitoring and use of AI, and the Executive Board approves it. The approved policy and minutes are filed in the AI governance SharePoint folder.",
    owner: "AI Committee", freq: "Annually", type: "Preventive", nature: "Manual", key: false,
    evidence: "Approved AI policy and Executive Board minutes", systems: "SharePoint", assertions: "Compliance",
    refs: { euAiAct: "", iso42001: "A.2.2; A.2.4; A.3.2", nistAiRmf: "GOVERN 2.1", finma: "2.1" }, defects: [],
  },
  {
    id: "AIG-05", process: "AI governance", sub: "AI literacy", riskId: "R-AIG-05",
    risk: "Staff using or overseeing AI do not understand its limits and over-rely on its outputs.",
    objective: "Staff operating AI systems have sufficient AI literacy.",
    desc: "Management makes sure employees are trained on AI as needed.",
    owner: "Management", freq: "", type: "Preventive", nature: "Manual", key: true,
    evidence: "", systems: "Learning platform", assertions: "Compliance",
    refs: { euAiAct: "Art. 4", iso42001: "A.4.6", nistAiRmf: "GOVERN 2.2", finma: "2.1" },
    defects: ["who", "what", "when", "frequency", "evidence", "owner_invalid", "key_no_evidence"],
  },

  /* --------------------------------- Data quality --------------------------------- */
  {
    id: "AID-01", process: "AI data", sub: "Data quality", riskId: "R-AID-01",
    risk: "Input data for the credit-limit scoring model is incomplete or outdated, leading to wrong credit limits.",
    objective: "Input data used by AI systems is complete, correct and current.",
    desc: "Every business day by 08:00, the data pipeline for the credit-limit scoring model runs automated checks on the input file: completeness of mandatory fields, value ranges, duplicates and data age (no record older than 3 days). If more than 1% of records fail, the run is stopped automatically and an incident is opened in ServiceNow for the Data Steward, who resolves it before the model is rerun. The check results are logged in the data-quality dashboard.",
    owner: "Data Steward", freq: "Daily", type: "Preventive", nature: "Automated", key: true,
    evidence: "Data-quality dashboard log; ServiceNow incidents", systems: "Data platform, ServiceNow", assertions: "Accuracy, Completeness",
    refs: { euAiAct: "Art. 26(4)", iso42001: "A.7.4", nistAiRmf: "", finma: "2.3" }, defects: [],
  },
  {
    id: "AID-02", process: "AI data", sub: "Training data", riskId: "R-AID-02",
    risk: "Training data for the CV-screening model is unrepresentative or biased, leading to discriminatory shortlists.",
    objective: "Training, validation and test data are relevant, representative and examined for bias.",
    desc: "Before each retraining of the CV-screening model, the Data Science Lead documents the data sources, sampling period and representativeness by gender, age band and nationality, and runs the bias test suite (selection-rate ratio of at least 0.8 for each group versus the most selected group). The HR Analytics Manager reviews and signs the data sheet; retraining does not proceed while any group is below 0.8. The signed data sheet is stored in the model repository.",
    owner: "Data Science Lead", freq: "Per change", type: "Preventive", nature: "IT-dependent manual", key: true,
    evidence: "Signed data sheet and bias test report", systems: "Model repository", assertions: "Accuracy",
    refs: { euAiAct: "Art. 10(2)(f); Art. 10(3)", iso42001: "A.7.2; A.7.4", nistAiRmf: "MEASURE 2.11", finma: "2.3" }, defects: [],
  },
  {
    id: "AID-03", process: "AI data", sub: "Data provenance", riskId: "R-AID-03",
    risk: "Data of unknown origin or licence is used to train or prompt AI systems.",
    objective: "The origin and permitted use of data for AI systems are known.",
    desc: "For every new dataset used to train or fine-tune an AI model, the Data Steward records the source, owner, legal basis or licence and retention period in the data catalogue, and the Data Protection Officer approves the entry before the dataset can be accessed by the data science workspace. The catalogue entry and the approval are retained in the data catalogue.",
    owner: "Data Steward", freq: "Per change", type: "Preventive", nature: "IT-dependent manual", key: false,
    evidence: "Approved data catalogue entry", systems: "Data catalogue", assertions: "Compliance",
    refs: { euAiAct: "", iso42001: "A.7.3; A.7.5", nistAiRmf: "MAP 4.1", finma: "2.3" }, defects: [],
  },
  {
    id: "AID-04", process: "AI data", sub: "Data quality", riskId: "R-AID-04",
    risk: "Changes in input data make the demand-forecasting model inapplicable without anyone noticing.",
    objective: "Input data drift is detected and handled.",
    desc: "The forecasting platform calculates population stability for the key input features of the demand-forecasting model and sends an alert when drift exceeds the threshold. The alert is reviewed.",
    owner: "Supply Chain Analytics Lead", freq: "Weekly", type: "Detective", nature: "Automated", key: false,
    evidence: "Drift alert log", systems: "Forecasting platform", assertions: "Accuracy",
    refs: { euAiAct: "", iso42001: "A.6.2.6", nistAiRmf: "MEASURE 2.4", finma: "2.4" },
    defects: ["precision", "who", "nature_mismatch"],
  },

  /* ------------------------------- Human oversight -------------------------------- */
  {
    id: "AIH-01", process: "AI human oversight", sub: "Oversight design", riskId: "R-AIH-01",
    risk: "Decisions proposed by the CV-screening model are applied without effective human review.",
    objective: "A competent person reviews and can override every AI-proposed decision.",
    desc: "For every candidate rejected by the CV-screening model, a trained HR Recruiter reviews the CV before the rejection is sent and either confirms or overrides the model's proposal in the applicant tracking system, entering a reason for each override. The system does not send a rejection without the recruiter's confirmation. Confirmations and overrides are logged in the applicant tracking system.",
    owner: "Head of Talent Acquisition", freq: "Per transaction", type: "Preventive", nature: "IT-dependent manual", key: true,
    evidence: "ATS confirmation and override log", systems: "Applicant tracking system", assertions: "Compliance",
    refs: { euAiAct: "Art. 14(4)(d); Art. 26(2)", iso42001: "A.9.2", nistAiRmf: "MAP 3.5; GOVERN 3.2", finma: "" }, defects: [],
  },
  {
    id: "AIH-02", process: "AI human oversight", sub: "Overseer competence", riskId: "R-AIH-02",
    risk: "People assigned to oversee AI systems lack the competence or authority to intervene.",
    objective: "Overseers of high-risk AI systems are trained and authorised.",
    desc: "Before a user is granted the 'AI overseer' role in a high-risk AI system, the system owner confirms in the access request that the user completed the AI-oversight training (pass mark 80%) within the last 12 months; the IT Security Officer grants the role only with this confirmation. Each quarter the system owner recertifies all overseer roles. Access requests and recertifications are retained in ServiceNow.",
    owner: "AI System Owner", freq: "Per change", type: "Preventive", nature: "IT-dependent manual", key: true,
    evidence: "ServiceNow access requests and quarterly recertifications", systems: "ServiceNow, Learning platform", assertions: "Compliance",
    refs: { euAiAct: "Art. 26(2)", iso42001: "A.4.6", nistAiRmf: "MAP 3.4", finma: "2.1" }, defects: [],
  },
  {
    id: "AIH-03", process: "AI human oversight", sub: "Stop and fallback", riskId: "R-AIH-03",
    risk: "A malfunctioning AI system cannot be stopped quickly, and the process has no fallback.",
    objective: "Each high-risk or material AI system can be safely stopped and the process continued manually.",
    desc: "Semi-annually, the AI System Owner tests the documented stop procedure of each high-risk or material AI system in the test environment, confirms the process can continue on the manual fallback within 4 hours, and records the result in the business continuity tool. Failed tests are remediated and retested within 30 days.",
    owner: "AI System Owner", freq: "Semi-annually", type: "Preventive", nature: "Manual", key: true,
    evidence: "Stop/fallback test record in the BCM tool", systems: "BCM tool", assertions: "Availability",
    refs: { euAiAct: "Art. 14(4)(e)", iso42001: "", nistAiRmf: "MANAGE 2.4", finma: "" }, defects: [],
  },
  {
    id: "AIH-04", process: "AI human oversight", sub: "Transparency to persons", riskId: "R-AIH-04",
    risk: "Customers and applicants are not told that they interact with or are assessed by AI.",
    objective: "Affected persons are informed about AI interaction and AI-supported decisions.",
    desc: "Before go-live and after every change to the customer chatbot or the applicant journey, the Compliance Officer checks that the chatbot discloses that the user is talking to an AI and that the job application page informs applicants that a high-risk AI system supports screening. The signed checklist is filed in the compliance SharePoint folder.",
    owner: "Compliance Officer", freq: "Per change", type: "Preventive", nature: "Manual", key: false,
    evidence: "Signed transparency checklist", systems: "SharePoint", assertions: "Compliance",
    refs: { euAiAct: "Art. 50(1); Art. 26(11)", iso42001: "A.8.2", nistAiRmf: "MEASURE 2.8", finma: "" }, defects: [],
  },
  {
    id: "AIH-05", process: "AI human oversight", sub: "Explainability", riskId: "R-AIH-05",
    risk: "Credit-limit decisions cannot be explained to customers, auditors or the regulator.",
    objective: "Material AI-supported decisions can be explained.",
    desc: "For each credit-limit decision above CHF 250,000, the Credit Analyst prepares and approves the explanation report showing the five most important drivers of the score and files it in the credit file before the limit is communicated; the same Credit Analyst then approves the limit.",
    owner: "Credit Manager", freq: "Per transaction", type: "Preventive", nature: "IT-dependent manual", key: true,
    evidence: "Explanation report in the credit file", systems: "Credit platform", assertions: "Accuracy",
    refs: { euAiAct: "", iso42001: "", nistAiRmf: "MEASURE 2.9", finma: "2.6" },
    defects: ["sod_conflict"],
  },

  /* --------------------------- Testing and monitoring ----------------------------- */
  {
    id: "AIM-01", process: "AI monitoring", sub: "Validation before release", riskId: "R-AIM-01",
    risk: "A model that does not meet performance requirements is released to production.",
    objective: "AI systems are validated against predefined criteria before release.",
    desc: "Before each production release of a material AI model, the independent Model Validation team runs the validation plan (out-of-sample accuracy, stability across the last 4 quarters, stress and adversarial tests) against acceptance criteria defined in advance by the business owner. The release ticket in ServiceNow cannot be approved without the signed validation report attached.",
    owner: "Head of Model Validation", freq: "Per change", type: "Preventive", nature: "IT-dependent manual", key: true,
    evidence: "Signed validation report on the release ticket", systems: "ServiceNow, Model repository", assertions: "Accuracy",
    refs: { euAiAct: "Art. 15(1)", iso42001: "A.6.2.4; A.6.2.5", nistAiRmf: "MEASURE 2.1; MEASURE 2.3", finma: "2.4; 2.7" }, defects: [],
  },
  {
    id: "AIM-02", process: "AI monitoring", sub: "Performance monitoring", riskId: "R-AIM-02",
    risk: "Model performance degrades in production without detection.",
    objective: "Performance of material AI systems is monitored against thresholds.",
    desc: "By the 10th business day of each month, the AI System Owner reviews the monitoring report for each material AI system (accuracy against labelled outcomes, override rate, drift indicators) against the thresholds in the model card. Any breach is escalated to the AI Committee within 5 business days with a remediation plan. The signed monthly report is stored in the model repository.",
    owner: "AI System Owner", freq: "Monthly", type: "Detective", nature: "IT-dependent manual", key: true,
    evidence: "Signed monthly monitoring report", systems: "Model repository", assertions: "Accuracy",
    refs: { euAiAct: "Art. 26(5)", iso42001: "A.6.2.6", nistAiRmf: "MEASURE 2.4; MANAGE 4.1", finma: "2.4" }, defects: [],
  },
  {
    id: "AIM-03", process: "AI monitoring", sub: "Override analysis", riskId: "R-AIM-03",
    risk: "Systematic weaknesses visible in user overrides are ignored.",
    objective: "Overrides of AI outputs are analysed to find model weaknesses.",
    desc: "Each quarter the HR Analytics Manager analyses all recruiter overrides of the CV-screening model by reason code and candidate group, and presents findings above a 10% override rate in any group to the AI Committee within 20 business days after quarter-end. The analysis and minutes are filed in the AI governance SharePoint folder.",
    owner: "HR Analytics Manager", freq: "Monthly", type: "Detective", nature: "IT-dependent manual", key: false,
    evidence: "Override analysis and AI Committee minutes", systems: "Applicant tracking system, SharePoint", assertions: "Accuracy",
    refs: { euAiAct: "", iso42001: "A.6.2.6", nistAiRmf: "MEASURE 3.1", finma: "2.4" },
    defects: ["freq_mismatch"],
  },
  {
    id: "AIM-04", process: "AI monitoring", sub: "Independent review", riskId: "R-AIM-04",
    risk: "Weaknesses in model development and use are not challenged independently.",
    objective: "Material AI systems are reviewed by a function independent of development.",
    desc: "Annually, Internal Audit reviews the development, validation, monitoring and use of each material AI system on a rotating plan that covers every material system at least every 3 years, and reports findings with owners and due dates to the Audit Committee. Reports are retained in the audit management system.",
    owner: "Head of Internal Audit", freq: "Annually", type: "Detective", nature: "Manual", key: false,
    evidence: "Internal audit reports; Audit Committee minutes", systems: "Audit management system", assertions: "Compliance",
    refs: { euAiAct: "", iso42001: "", nistAiRmf: "GOVERN 1.5", finma: "2.7" }, defects: [],
  },
  {
    id: "AIM-05", process: "AI monitoring", sub: "Documentation", riskId: "R-AIM-05",
    risk: "Documentation of material AI systems is missing or outdated, so they cannot be reviewed or handed over.",
    objective: "Each material AI system has complete, current documentation.",
    desc: "Within 10 business days after each production release, the AI System Owner updates the model card (purpose, data sources and quality checks, model choice, performance measures, assumptions, limitations, tests, controls and fallback), and the AI Governance Officer checks it against the documentation standard and signs it off in the model repository.",
    owner: "AI System Owner", freq: "Per change", type: "Detective", nature: "Manual", key: false,
    evidence: "Signed-off model card in the model repository", systems: "Model repository", assertions: "Completeness",
    refs: { euAiAct: "", iso42001: "A.6.2.7", nistAiRmf: "", finma: "2.5" }, defects: [],
  },

  /* ------------------------------ Third parties ----------------------------------- */
  {
    id: "AIV-01", process: "AI third parties", sub: "Vendor due diligence", riskId: "R-AIV-01",
    risk: "A purchased AI solution is used without knowing its data, methods or the vendor's competence.",
    objective: "AI vendors and solutions are assessed before contracting.",
    desc: "Before signing or renewing any contract for software or services that contain AI, the Procurement Manager obtains the completed AI vendor questionnaire (training data, model type, testing, incident handling, sub-processors) and the AI Governance Officer approves the assessment. The contract cannot be released in the procurement system without the approval attached.",
    owner: "Procurement Manager", freq: "Per change", type: "Preventive", nature: "IT-dependent manual", key: true,
    evidence: "Approved AI vendor assessment in the procurement system", systems: "Procurement system", assertions: "Compliance",
    refs: { euAiAct: "", iso42001: "A.10.3", nistAiRmf: "GOVERN 6.1", finma: "2.1" }, defects: [],
  },
  {
    id: "AIV-02", process: "AI third parties", sub: "Contract clauses", riskId: "R-AIV-02",
    risk: "Contracts do not allocate responsibility for AI failures, changes and incidents.",
    objective: "AI contracts define responsibilities, change notification and incident duties.",
    desc: "Before signature, Legal Counsel checks every AI-related contract against the AI clause checklist (allocation of responsibilities, notification of material model changes at least 30 days in advance, incident notification within 24 hours, audit rights, use of customer data for training only with consent) and signs the checklist, which is attached to the contract record.",
    owner: "Legal Counsel", freq: "Per change", type: "Preventive", nature: "Manual", key: false,
    evidence: "Signed AI clause checklist on the contract record", systems: "Contract management system", assertions: "Compliance",
    refs: { euAiAct: "Art. 25(1)(b)", iso42001: "A.10.2", nistAiRmf: "GOVERN 6.2", finma: "2.1" }, defects: [],
  },
  {
    id: "AIV-03", process: "AI third parties", sub: "Vendor monitoring", riskId: "R-AIV-03",
    risk: "Changes to a vendor's model degrade results without the company noticing.",
    objective: "Third-party AI risks are monitored during the contract.",
    desc: "The vendor relationship is monitored.",
    owner: "Procurement", freq: "Quarterly", type: "Detective", nature: "Manual", key: false,
    evidence: "", systems: "Procurement system", assertions: "Compliance",
    refs: { euAiAct: "", iso42001: "A.10.3", nistAiRmf: "MANAGE 3.1", finma: "" },
    defects: ["who", "what", "when", "evidence", "precision", "owner_invalid"],
  },

  /* ------------------------------- Logging and incidents -------------------------- */
  {
    id: "AIL-01", process: "AI logging and incidents", sub: "Logging", riskId: "R-AIL-01",
    risk: "Logs of high-risk AI systems are not kept, so decisions cannot be traced or incidents investigated.",
    objective: "Automatically generated logs are kept for at least six months.",
    desc: "The applicant tracking system automatically records every CV-screening run (input reference, model version, score, recruiter decision, timestamp) in a write-once log store with a retention of 24 months. Each month the IT Operations Manager checks the log-completeness report (runs versus log entries) and investigates any gap above 0.1% within 5 business days. The signed report is retained in ServiceNow.",
    owner: "IT Operations Manager", freq: "Monthly", type: "Detective", nature: "IT-dependent manual", key: true,
    evidence: "Signed monthly log-completeness report", systems: "Applicant tracking system, Log store, ServiceNow", assertions: "Completeness",
    refs: { euAiAct: "Art. 12(1); Art. 26(6)", iso42001: "A.6.2.8", nistAiRmf: "", finma: "" }, defects: [],
  },
  {
    id: "AIL-02", process: "AI logging and incidents", sub: "Incident management", riskId: "R-AIL-02",
    risk: "Serious AI incidents are not escalated or reported to the provider and the authority in time.",
    objective: "AI incidents are classified, escalated and reported within legal deadlines.",
    desc: "For every incident ticket tagged 'AI' in ServiceNow, the AI Governance Officer assesses within 1 business day whether it is a serious incident (death or serious harm to health, critical infrastructure disruption, infringement of fundamental-rights obligations, serious harm to property or the environment). Serious incidents are reported to the provider immediately and escalated to the Chief Risk Officer the same day; the assessment and notifications are recorded on the ticket.",
    owner: "AI Governance Officer", freq: "Per transaction", type: "Detective", nature: "IT-dependent manual", key: true,
    evidence: "ServiceNow AI incident ticket with assessment and notifications", systems: "ServiceNow", assertions: "Compliance",
    refs: { euAiAct: "Art. 3(49); Art. 26(5); Art. 73(2)", iso42001: "A.8.4", nistAiRmf: "MANAGE 4.3; GOVERN 4.3", finma: "" }, defects: [],
  },
  {
    id: "AIL-03", process: "AI logging and incidents", sub: "Concerns and complaints", riskId: "R-AIL-03",
    risk: "Concerns about AI behaviour raised by staff or affected persons are lost.",
    objective: "Concerns about AI systems are captured, assessed and answered.",
    desc: "Each month the Compliance Officer reviews all AI concerns and complaints received through the speak-up channel and the customer complaint form, confirms each was assessed and answered within 20 business days, and escalates overdue items to the AI Committee. The signed review is filed in the compliance SharePoint folder.",
    owner: "Compliance Officer", freq: "Monthly", type: "Detective", nature: "Manual", key: false,
    evidence: "Signed monthly concerns review", systems: "Speak-up tool, SharePoint", assertions: "Compliance",
    refs: { euAiAct: "", iso42001: "A.3.3", nistAiRmf: "GOVERN 5.1", finma: "" }, defects: [],
  },
  {
    id: "AIL-04", process: "AI logging and incidents", sub: "GenAI use", riskId: "R-AIL-04",
    risk: "Confidential or personal data is entered into public GenAI tools.",
    objective: "Only approved GenAI tools are used, and confidential data does not leave them.",
    desc: "The secure web gateway blocks access to GenAI services not on the approved list and the data-loss-prevention rule blocks uploads classified 'Confidential' to approved GenAI tools. Weekly, the IT Security Officer reviews the block log and follows up repeated attempts (3 or more per user per week) with the user's line manager. The reviewed log is retained in ServiceNow.",
    owner: "IT Security Officer", freq: "Weekly", type: "Preventive", nature: "IT-dependent manual", key: false,
    evidence: "Reviewed gateway and DLP block log", systems: "Secure web gateway, DLP, ServiceNow", assertions: "Confidentiality",
    refs: { euAiAct: "", iso42001: "A.9.2", nistAiRmf: "MEASURE 2.10", finma: "2.3" }, defects: [],
  },
];
