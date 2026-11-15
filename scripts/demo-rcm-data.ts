/**
 * Synthetic RCM for a fictional Swiss mid-cap, "Alpenfirn Industries AG" (CHF).
 * Every row is invented. `defects` is the ground truth: the checks a senior
 * controls reviewer should raise. Rows with no defects are written to pass
 * every check ("gold standard" wording) and measure the false-positive rate.
 */
import type { CheckId } from "../src/core/schema";

export interface DemoRow {
  id: string;
  process: string;
  sub: string;
  riskId: string;
  risk: string;
  objective: string;
  desc: string;
  owner: string;
  freq: string;
  type: "Preventive" | "Detective";
  nature: "Manual" | "Automated" | "IT-dependent manual";
  key: boolean;
  evidence: string;
  systems: string;
  assertions: string;
  defects: CheckId[];
}

export const DEMO_ROWS: DemoRow[] = [
  /* ---------------------------- Procure-to-Pay ---------------------------- */
  {
    id: "P2P-01", process: "Procure-to-Pay", sub: "Vendor master data", riskId: "R-P2P-01",
    risk: "Fictitious vendors or unauthorised changes to vendor bank details lead to fraudulent payments.",
    objective: "Only authorised and accurate vendor master data changes are processed.",
    desc: "Upon each request to create or change vendor master data, the Head of AP Operations compares the SAP change report field by field with the approved request form before the vendor is unblocked for payment. For bank detail changes, the AP Master Data Specialist first performs a call-back to the vendor using a phone number from an independent source. Any mismatch is rejected and logged. The approved workflow item and the call-back log are retained in SAP.",
    owner: "Head of AP Operations", freq: "Per change", type: "Preventive", nature: "IT-dependent manual", key: true,
    evidence: "Approved SAP workflow item; call-back log", systems: "SAP S/4HANA", assertions: "Existence, Accuracy", defects: [],
  },
  {
    id: "P2P-02", process: "Procure-to-Pay", sub: "Invoice processing", riskId: "R-P2P-02",
    risk: "Invoices are paid for goods not received or at prices not agreed.",
    objective: "Only invoices matching an approved PO and goods receipt are paid.",
    desc: "At invoice posting, SAP S/4HANA performs an automated three-way match of purchase order, goods receipt and invoice. Invoices with a price variance above 2% or CHF 500, or any quantity variance, are automatically blocked for payment until released through the price-variance workflow. The tolerance configuration is evidenced by the SAP tolerance key report retained in the ITGC configuration baseline.",
    owner: "AP Process Owner", freq: "Continuous", type: "Preventive", nature: "Automated", key: true,
    evidence: "Tolerance key configuration report", systems: "SAP S/4HANA", assertions: "Existence, Accuracy", defects: [],
  },
  {
    id: "P2P-03", process: "Procure-to-Pay", sub: "Invoice processing", riskId: "R-P2P-03",
    risk: "Incorrect supplier invoices are paid.",
    objective: "Supplier invoices are accurate before payment.",
    desc: "Finance ensures that supplier invoices are checked and are correct before payment.",
    owner: "Finance", freq: "Daily", type: "Preventive", nature: "Manual", key: true,
    evidence: "", systems: "SAP S/4HANA", assertions: "Accuracy",
    defects: ["who", "what", "evidence", "precision", "owner_invalid", "key_no_evidence"],
  },
  {
    id: "P2P-04", process: "Procure-to-Pay", sub: "Purchasing", riskId: "R-P2P-04",
    risk: "Purchases are made without budget holder authorisation.",
    objective: "Purchase orders are approved in line with the approval matrix.",
    desc: "Before a purchase order can be released, SAP S/4HANA routes each purchase requisition above CHF 5,000 to the responsible Cost Centre Manager for approval according to the approval matrix; requisitions above CHF 100,000 additionally require CFO approval. The Cost Centre Manager approves or rejects the requisition in the workflow, and the PO cannot be released until approval is complete. Approval history is retained in the SAP workflow log.",
    owner: "Cost Centre Manager", freq: "Per transaction", type: "Preventive", nature: "IT-dependent manual", key: true,
    evidence: "SAP workflow approval log", systems: "SAP S/4HANA", assertions: "Occurrence", defects: [],
  },
  {
    id: "P2P-05", process: "Procure-to-Pay", sub: "Period-end", riskId: "R-P2P-05",
    risk: "Liabilities for goods received are not recorded or GR/IR balances are misstated.",
    objective: "GR/IR clearing balances are complete, accurate and investigated timely.",
    desc: "By the 5th business day after month-end, the AP Team Lead reviews the GR/IR clearing account ageing report from SAP S/4HANA and investigates all open items older than 90 days or above CHF 25,000; corrections are posted only after Accounting Manager approval. The signed ageing report and investigation notes are filed in the month-end close folder on SharePoint.",
    owner: "AP Team Lead", freq: "Monthly", type: "Detective", nature: "Manual", key: true,
    evidence: "Signed GR/IR ageing report and notes", systems: "SAP S/4HANA, SharePoint", assertions: "Completeness, Accuracy", defects: [],
  },
  {
    id: "P2P-06", process: "Procure-to-Pay", sub: "Purchasing", riskId: "R-P2P-06",
    risk: "Unauthorised or uneconomic purchases of non-catalogue items.",
    objective: "Non-catalogue purchase orders are authorised.",
    desc: "The Purchasing Manager creates and approves purchase orders above CHF 10,000 for non-catalogue items. Approval is documented in the SAP release strategy log.",
    owner: "Purchasing Manager", freq: "Per transaction", type: "Preventive", nature: "Manual", key: false,
    evidence: "SAP release strategy log", systems: "SAP S/4HANA", assertions: "Occurrence",
    defects: ["when", "sod_conflict"],
  },
  {
    id: "P2P-07", process: "Procure-to-Pay", sub: "Invoice processing", riskId: "R-P2P-07",
    risk: "The same invoice is recorded and paid twice.",
    objective: "Duplicate invoices are prevented.",
    desc: "At invoice entry, SAP S/4HANA compares vendor, invoice reference, amount and invoice date with all invoices posted in the last 24 months and blocks posting of any exact match with a hard error message. The duplicate-check settings are evidenced by a configuration screenshot retained in the ITGC configuration baseline.",
    owner: "AP Process Owner", freq: "Continuous", type: "Preventive", nature: "Automated", key: true,
    evidence: "Duplicate-check configuration screenshot", systems: "SAP S/4HANA", assertions: "Occurrence, Accuracy", defects: [],
  },
  {
    id: "P2P-08", process: "Procure-to-Pay", sub: "Vendor master data", riskId: "R-P2P-08",
    risk: "One-time vendor accounts are misused to bypass vendor onboarding controls.",
    objective: "Payments to one-time vendors are legitimate and approved.",
    desc: "Each quarter, within 10 business days after quarter-end, the AP Team Lead reviews the SAP report of all payments to one-time vendor accounts and investigates every payment above CHF 2,000 against the supporting invoice and approval. The signed report is retained in the AP SharePoint folder.",
    owner: "AP Team Lead", freq: "Monthly", type: "Detective", nature: "Manual", key: false,
    evidence: "Signed one-time vendor payment report", systems: "SAP S/4HANA, SharePoint", assertions: "Occurrence",
    defects: ["freq_mismatch"],
  },
  {
    id: "P2P-09", process: "Procure-to-Pay", sub: "Period-end", riskId: "R-P2P-09",
    risk: "Accruals for goods and services received but not invoiced are incomplete or inaccurate.",
    objective: "Accruals for uninvoiced receipts are complete and accurate.",
    desc: "By business day 3 after month-end, the AP Accountant prepares the accrual for goods received not invoiced from the SAP GR/IR report. The Accounting Manager reviews the accrual against the report and investigates movements above CHF 50,000 or 10% versus the prior month before the entry is posted. The review is evidenced by sign-off in the close checklist tool.",
    owner: "Accounting Manager", freq: "Monthly", type: "Detective", nature: "Manual", key: true,
    evidence: "Sign-off in close checklist tool", systems: "SAP S/4HANA", assertions: "Completeness, Cut-off", defects: [],
  },
  {
    id: "P2P-10", process: "Procure-to-Pay", sub: "Vendor reconciliation", riskId: "R-P2P-10",
    risk: "Vendor liabilities are misstated.",
    objective: "Vendor balances agree to supplier statements.",
    desc: "Within 15 business days after each quarter-end, the AP Accountant reconciles the supplier statements of the 20 largest vendors by spend to the SAP vendor ledger and investigates differences above CHF 1,000. The AP Team Lead reviews and signs the reconciliation pack, which is stored in the AP SharePoint folder.",
    owner: "AP Team Lead", freq: "Quarterly", type: "Detective", nature: "Manual", key: false,
    evidence: "Signed vendor reconciliation pack", systems: "SAP S/4HANA, SharePoint", assertions: "Completeness, Accuracy", defects: [],
  },

  /* ----------------------------- Order-to-Cash ---------------------------- */
  {
    id: "O2C-01", process: "Order-to-Cash", sub: "Credit management", riskId: "R-O2C-01",
    risk: "Sales are made to customers beyond their creditworthiness, leading to bad debts.",
    objective: "Sales orders do not exceed approved credit limits.",
    desc: "When a sales order is saved, SAP S/4HANA automatically blocks any order that would take the customer's total exposure above the approved credit limit. Blocked orders can only be released by the Credit Manager, and the block-and-release log is retained in SAP credit management. The credit-check configuration is evidenced by the configuration report in the ITGC configuration baseline.",
    owner: "Credit Manager", freq: "Continuous", type: "Preventive", nature: "Automated", key: true,
    evidence: "Credit-check configuration report; release log", systems: "SAP S/4HANA", assertions: "Valuation", defects: [],
  },
  {
    id: "O2C-02", process: "Order-to-Cash", sub: "Billing", riskId: "R-O2C-02",
    risk: "Customers are invoiced at incorrect prices.",
    objective: "Billing prices agree to approved customer price lists.",
    desc: "Before the monthly billing run, the Billing Specialist manually compares the SAP price conditions with the signed customer price lists in Excel and corrects differences above 0.5% before billing. The initialled comparison is filed in the billing folder on SharePoint.",
    owner: "Billing Specialist", freq: "Monthly", type: "Preventive", nature: "Automated", key: true,
    evidence: "Initialled price comparison", systems: "SAP S/4HANA, Excel", assertions: "Accuracy",
    defects: ["nature_mismatch"],
  },
  {
    id: "O2C-03", process: "Order-to-Cash", sub: "Revenue recognition", riskId: "R-O2C-03",
    risk: "Revenue is recorded in the wrong period.",
    objective: "Revenue is recognised in the period in which control passes to the customer.",
    desc: "Within 3 business days after each month-end, the Revenue Accountant compares the proof-of-delivery date with the billing date for all deliveries in the last 5 and first 5 business days of the period and investigates any shipment above CHF 20,000 billed in the wrong period. Adjustments are approved by the Accounting Manager before posting. The cut-off checklist with sign-off is retained in the month-end close folder.",
    owner: "Revenue Accountant", freq: "Monthly", type: "Detective", nature: "Manual", key: true,
    evidence: "Signed cut-off checklist", systems: "SAP S/4HANA", assertions: "Cut-off, Occurrence", defects: [],
  },
  {
    id: "O2C-04", process: "Order-to-Cash", sub: "Customer master data", riskId: "R-O2C-04",
    risk: "Unauthorised changes to customer master data (payment terms, credit limits, bank data).",
    objective: "Customer master data changes are authorised.",
    desc: "Customer master data changes are reviewed for appropriateness against supporting documents and any unauthorised change is followed up. A change log printout is signed and filed in the O2C master data binder.",
    owner: "Sales Operations Manager", freq: "", type: "Detective", nature: "Manual", key: false,
    evidence: "Signed change log printout", systems: "SAP S/4HANA", assertions: "Accuracy, Valuation",
    defects: ["who", "when", "frequency"],
  },
  {
    id: "O2C-05", process: "Order-to-Cash", sub: "Credit notes", riskId: "R-O2C-05",
    risk: "Unauthorised credit notes reduce revenue and receivables.",
    objective: "Credit notes are authorised before posting.",
    desc: "Before posting, every credit note above CHF 5,000 must be approved in the SAP workflow by the Head of Customer Service; credit notes above CHF 50,000 additionally require CFO approval. The system prevents posting without the required approvals. The workflow approval history is retained in SAP.",
    owner: "Head of Customer Service", freq: "Per transaction", type: "Preventive", nature: "IT-dependent manual", key: true,
    evidence: "SAP workflow approval history", systems: "SAP S/4HANA", assertions: "Occurrence, Accuracy", defects: [],
  },
  {
    id: "O2C-06", process: "Order-to-Cash", sub: "Receivables", riskId: "R-O2C-06",
    risk: "Trade receivables are overstated because doubtful debts are not provided for.",
    objective: "The bad-debt provision is adequate.",
    desc: "By business day 5 after month-end, the Credit Manager reviews the SAP AR ageing report, assesses every balance overdue more than 90 days or above CHF 50,000 for recoverability, and proposes provision adjustments, which the Group Controller approves before posting. The signed ageing review and the provision calculation are stored in the month-end close folder.",
    owner: "Credit Manager", freq: "Monthly", type: "Detective", nature: "Manual", key: true,
    evidence: "Signed ageing review; provision calculation", systems: "SAP S/4HANA", assertions: "Valuation", defects: [],
  },
  {
    id: "O2C-07", process: "Order-to-Cash", sub: "Pricing", riskId: "R-O2C-07",
    risk: "Excessive discounts erode margin.",
    objective: "Discounts are in line with the pricing policy.",
    desc: "The Sales Director monitors pricing exceptions to make sure discounts are appropriate. Discounts above 15% are looked at within 5 business days after month-end.",
    owner: "Sales Director", freq: "Monthly", type: "Detective", nature: "Manual", key: false,
    evidence: "Email", systems: "SAP S/4HANA", assertions: "Accuracy",
    defects: ["what", "evidence"],
  },
  {
    id: "O2C-08", process: "Order-to-Cash", sub: "Cash application", riskId: "R-O2C-08",
    risk: "Customer payments are not applied or are applied to the wrong invoice.",
    objective: "Incoming payments are applied completely and accurately.",
    desc: "Every business day by 12:00, the AR Team Lead reviews the SAP unapplied-cash report (generated from the camt.053 bank statement import) and investigates any item open for more than 3 business days or above CHF 10,000. The reviewed report is saved with e-signature in the AR SharePoint folder.",
    owner: "AR Team Lead", freq: "Daily", type: "Detective", nature: "IT-dependent manual", key: false,
    evidence: "E-signed unapplied-cash report", systems: "SAP S/4HANA, SharePoint", assertions: "Existence, Accuracy", defects: [],
  },
  {
    id: "O2C-09", process: "Order-to-Cash", sub: "Revenue analytics", riskId: "",
    risk: "Revenue is misstated.",
    objective: "",
    desc: "The Revenue Accountant reviews the monthly revenue analytics by customer and product versus budget and prior year within 4 business days after month-end and follows up unusual fluctuations. Review is evidenced by sign-off on the revenue analysis in the close folder.",
    owner: "Revenue Accountant", freq: "Monthly", type: "Detective", nature: "Manual", key: false,
    evidence: "Signed revenue analysis", systems: "SAP S/4HANA", assertions: "Occurrence, Accuracy",
    defects: ["precision", "missing_risk_link"],
  },
  {
    id: "O2C-10", process: "Order-to-Cash", sub: "Contracts", riskId: "R-O2C-10",
    risk: "Customer contracts contain non-standard terms that affect revenue recognition.",
    objective: "Non-standard contract terms are identified and approved before signature.",
    desc: "Before any customer contract with annual value above CHF 250,000 or payment terms beyond 60 days is signed, the Legal Counsel and the Head of Sales review it against the contract policy checklist and escalate any deviation to the CFO for approval. The signed checklist is attached to the contract record in the CRM.",
    owner: "Head of Sales", freq: "Per contract", type: "Preventive", nature: "Manual", key: false,
    evidence: "Signed contract policy checklist", systems: "CRM", assertions: "Occurrence, Rights & obligations", defects: [],
  },

  /* -------------------------------- Treasury ------------------------------- */
  {
    id: "TRE-01", process: "Treasury", sub: "Bank account management", riskId: "R-TRE-01",
    risk: "Unauthorised bank accounts are opened and used to divert funds.",
    objective: "Bank accounts are opened, changed and closed only with proper authorisation.",
    desc: "Before the bank is instructed to open, close or modify any bank account, the Group Treasurer and the CFO both approve the request form with their signatures. Within 2 business days after the bank confirms, the Treasury Analyst updates the bank account register. The approved request and the updated register are retained in the treasury SharePoint folder.",
    owner: "Group Treasurer", freq: "Per request", type: "Preventive", nature: "Manual", key: true,
    evidence: "Approved request form; bank account register", systems: "SharePoint", assertions: "Existence, Rights & obligations", defects: [],
  },
  {
    id: "TRE-02", process: "Treasury", sub: "Payment release", riskId: "R-TRE-02",
    risk: "Unauthorised or altered payments are released to the bank.",
    objective: "Only approved payments are released, under dual control.",
    desc: "For every payment run, the Treasury Analyst uploads the SAP payment file to the e-banking platform, and a second authorised signatory (Group Treasurer or Treasury Manager) releases it only after agreeing the total amount and number of payments to the approved SAP payment proposal; any difference stops the release. The bank platform enforces release by two different users. The release log is retained in the e-banking audit trail.",
    owner: "Group Treasurer", freq: "Per payment run", type: "Preventive", nature: "IT-dependent manual", key: true,
    evidence: "E-banking release log", systems: "SAP S/4HANA, e-banking platform", assertions: "Occurrence, Accuracy", defects: [],
  },
  {
    id: "TRE-03", process: "Treasury", sub: "Payment release", riskId: "R-TRE-03",
    risk: "Urgent manual payments bypass the payment run controls.",
    objective: "Manual payments are authorised.",
    desc: "The Treasury Manager prepares and approves manual (urgent) payments above CHF 1,000 outside the payment run in the e-banking portal. Each payment is supported by an invoice and evidence is kept in e-banking.",
    owner: "Treasury Manager", freq: "Per transaction", type: "Preventive", nature: "Manual", key: true,
    evidence: "E-banking payment record", systems: "e-banking platform", assertions: "Occurrence",
    defects: ["when", "sod_conflict"],
  },
  {
    id: "TRE-04", process: "Treasury", sub: "Cash forecasting", riskId: "R-TRE-04",
    risk: "Liquidity shortfalls are not identified in time.",
    objective: "The cash forecast is reliable and variances are explained.",
    desc: "Every Monday by 12:00, the Treasury Analyst prepares the 13-week rolling cash forecast from the TMS. The Group Treasurer reviews it and investigates variances between actuals and the prior-week forecast above CHF 500,000 or 10%, documenting explanations in the forecast file. The approved forecast is saved in the treasury SharePoint folder.",
    owner: "Group Treasurer", freq: "Weekly", type: "Detective", nature: "Manual", key: false,
    evidence: "Approved cash forecast with variance comments", systems: "TMS, SharePoint", assertions: "n/a (liquidity)", defects: [],
  },
  {
    id: "TRE-05", process: "Treasury", sub: "Bank reconciliation", riskId: "R-TRE-05",
    risk: "Cash balances are misstated or unauthorised transactions go undetected.",
    objective: "Cash in the ledger agrees to bank balances.",
    desc: "The Treasury Accountant reconciles all bank account balances in SAP to the bank statements annually, within 10 business days after year-end, and the Group Treasurer reviews the reconciliation. Signed reconciliations are filed in the treasury close folder.",
    owner: "Treasury Accountant", freq: "Annually", type: "Detective", nature: "Manual", key: true,
    evidence: "Signed bank reconciliations", systems: "SAP S/4HANA", assertions: "Existence, Completeness",
    defects: ["frequency", "precision"],
  },
  {
    id: "TRE-06", process: "Treasury", sub: "FX hedging", riskId: "R-TRE-06",
    risk: "FX hedges are executed outside policy, exposing the group to speculative positions.",
    objective: "FX hedges comply with the hedging policy.",
    desc: "FX hedges are approved before execution against the hedging policy (hedge ratio 50–80% of forecast exposures over the next 12 months); deals above CHF 5m require CFO approval. Deal tickets with approvals are stored in the TMS.",
    owner: "Martin Keller", freq: "Per transaction", type: "Preventive", nature: "Manual", key: true,
    evidence: "Approved deal tickets in TMS", systems: "TMS", assertions: "Valuation, Presentation",
    defects: ["who", "owner_invalid"],
  },
  {
    id: "TRE-07", process: "Treasury", sub: "Bank account management", riskId: "R-TRE-07",
    risk: "Former employees or unauthorised persons remain bank signatories.",
    objective: "Bank signatories are current and authorised.",
    desc: "Each quarter, within 10 business days after quarter-end, the Treasury Manager compares the signatory lists obtained directly from each bank with the approved signatory matrix and the HR leaver list. Any signatory not in the matrix, or who has left, is removed within 5 business days through a request signed by the Group Treasurer and the CFO. The signed comparison is retained in the treasury SharePoint folder.",
    owner: "Treasury Manager", freq: "Quarterly", type: "Detective", nature: "Manual", key: true,
    evidence: "Signed signatory comparison", systems: "SharePoint", assertions: "Existence",
    defects: [],
  },
  {
    id: "TRE-08", process: "Treasury", sub: "Bank reconciliation", riskId: "R-TRE-08",
    risk: "Differences between bank and ledger cash are not detected timely.",
    objective: "Daily cash positions agree between bank, TMS and SAP.",
    desc: "Every business day, the TMS reconciles the bank balances imported via camt.053 with the SAP cash accounts and generates an exception report of all differences above CHF 1. The Treasury Analyst investigates and clears every exception by the end of the next business day and documents the resolution in the TMS exception log.",
    owner: "Treasury Analyst", freq: "Daily", type: "Detective", nature: "IT-dependent manual", key: true,
    evidence: "TMS exception log", systems: "TMS, SAP S/4HANA", assertions: "Existence, Completeness", defects: [],
  },

  /* ----------------------------- Record-to-Report ---------------------------- */
  {
    id: "R2R-01", process: "Record-to-Report", sub: "Journal entries", riskId: "R-R2R-01",
    risk: "Erroneous or fraudulent manual journal entries are posted.",
    objective: "Manual journal entries are authorised before posting.",
    desc: "Before posting, every manual journal entry above CHF 10,000 is approved in the SAP workflow by an Accounting Manager other than the person who entered it; the system prevents self-approval. Entries above CHF 1m additionally require Group Controller approval. The workflow history is retained in SAP.",
    owner: "Accounting Manager", freq: "Per transaction", type: "Preventive", nature: "IT-dependent manual", key: true,
    evidence: "SAP workflow history", systems: "SAP S/4HANA", assertions: "Occurrence, Accuracy", defects: [],
  },
  {
    id: "R2R-02", process: "Record-to-Report", sub: "Financial reporting", riskId: "R-R2R-02",
    risk: "Material misstatements in the consolidated accounts are not detected.",
    objective: "Unusual movements in the consolidated financial statements are identified and explained.",
    desc: "The Group Controller reviews the consolidated balance sheet and P&L flux analysis quarterly, within 8 business days after period end, and follows up significant variances. Review evidenced by e-mail sign-off stored in the consolidation folder.",
    owner: "Group Controller", freq: "Monthly", type: "Detective", nature: "Manual", key: true,
    evidence: "E-mail sign-off", systems: "Consolidation system", assertions: "All",
    defects: ["freq_mismatch", "precision"],
  },
  {
    id: "R2R-03", process: "Record-to-Report", sub: "Account reconciliations", riskId: "R-R2R-03",
    risk: "Balance sheet accounts contain unreconciled or unsupported balances.",
    objective: "Balance sheet accounts are reconciled and differences resolved.",
    desc: "By business day 7 after month-end, the Senior Accountant reconciles every balance sheet account above CHF 100,000 to sub-ledgers or third-party evidence. The Accounting Manager then reviews each reconciliation and investigates unreconciled differences above CHF 5,000 or items older than 60 days. Both sign-offs are recorded in the reconciliation tool.",
    owner: "Accounting Manager", freq: "Monthly", type: "Detective", nature: "Manual", key: true,
    evidence: "Preparer and reviewer sign-offs in reconciliation tool", systems: "SAP S/4HANA, reconciliation tool", assertions: "Existence, Completeness, Accuracy", defects: [],
  },
  {
    id: "R2R-04", process: "Record-to-Report", sub: "Period-end close", riskId: "R-R2R-04",
    risk: "Month-end close is incomplete.",
    objective: "All close activities are completed.",
    desc: "Month-end close is monitored by the Accounting team to ensure all entries are complete, within 5 business days after month-end, using the close checklist. Checklist sign-off kept on SharePoint.",
    owner: "", freq: "Monthly", type: "Detective", nature: "Manual", key: false,
    evidence: "Close checklist", systems: "SharePoint", assertions: "Completeness",
    defects: ["who", "what", "precision", "owner_invalid"],
  },
  {
    id: "R2R-05", process: "Record-to-Report", sub: "Intercompany", riskId: "R-R2R-05",
    risk: "Intercompany balances do not eliminate on consolidation.",
    objective: "Intercompany balances are reconciled before consolidation.",
    desc: "By business day 4 after month-end and before consolidation, the Group Reporting Accountant reconciles intercompany balances between all entities in the consolidation system and agrees every difference above CHF 10,000 with the counterpart entity controller. The Group Reporting Manager reviews and signs off the intercompany matching report, which is retained in the consolidation folder.",
    owner: "Group Reporting Manager", freq: "Monthly", type: "Detective", nature: "IT-dependent manual", key: true,
    evidence: "Signed intercompany matching report", systems: "Consolidation system", assertions: "Existence, Accuracy, Presentation", defects: [],
  },
  {
    id: "R2R-06", process: "Record-to-Report", sub: "Impairment", riskId: "R-R2R-06",
    risk: "Goodwill and long-lived assets are not impaired when required.",
    objective: "Impairment is identified and recorded in accordance with the accounting framework.",
    desc: "Annually, within 20 business days after year-end, the Group Controller reviews the impairment test for each cash-generating unit, compares carrying amount with value in use, and escalates any unit with headroom below 10% to the CFO and the Audit Committee. The approved impairment memo is filed in the year-end close folder.",
    owner: "Group Controller", freq: "Annually", type: "Detective", nature: "Manual", key: true,
    evidence: "Approved impairment memo", systems: "Excel, consolidation system", assertions: "Valuation", defects: [],
  },

  /* ---------------------------------- ITGC --------------------------------- */
  {
    id: "ITG-01", process: "ITGC", sub: "Access management", riskId: "R-ITG-01",
    risk: "Users hold access inappropriate to their job role, enabling unauthorised transactions.",
    objective: "User access to SAP is appropriate and periodically recertified.",
    desc: "Each quarter, within 15 business days after quarter-end, each Business Application Owner reviews the SAP user access listing for their area against job roles, covering 100% of users with sensitive roles (e.g. vendor master maintenance, payment release), and flags any access not consistent with the user's role. The IT Security Officer removes flagged access within 5 business days and tracks each removal to closure in a ServiceNow ticket. The signed review and the tickets are retained in ServiceNow.",
    owner: "Business Application Owner", freq: "Quarterly", type: "Detective", nature: "Manual", key: true,
    evidence: "Signed access review; ServiceNow tickets", systems: "SAP S/4HANA, ServiceNow", assertions: "n/a (ITGC)", defects: [],
  },
  {
    id: "ITG-02", process: "ITGC", sub: "Change management", riskId: "R-ITG-02",
    risk: "Unauthorised or untested changes are moved to production.",
    objective: "Only authorised, tested changes reach SAP production.",
    desc: "Before any transport to SAP production, the Change Advisory Board approves the change in ServiceNow based on documented test results; SAP transport management only accepts transports linked to an approved change ticket, and developers have no access to import into production. The ticket with test evidence and CAB approval is retained in ServiceNow.",
    owner: "IT Change Manager", freq: "Per change", type: "Preventive", nature: "IT-dependent manual", key: true,
    evidence: "ServiceNow change ticket with test evidence and CAB approval", systems: "SAP S/4HANA, ServiceNow", assertions: "n/a (ITGC)", defects: [],
  },
  {
    id: "ITG-03", process: "ITGC", sub: "IT operations", riskId: "R-ITG-03",
    risk: "Failed batch jobs or interfaces lead to incomplete data processing.",
    objective: "Batch jobs and interfaces complete successfully, or failures are resolved timely.",
    desc: "Every business day by 09:00, the IT Operations Analyst checks whether the overnight SAP batch jobs and bank interface jobs completed, using the job monitoring dashboard, and opens a ServiceNow incident for every failed or delayed job, which is resolved within 1 business day. Evidence: daily checklist with initials in the IT operations SharePoint folder.",
    owner: "IT Operations Analyst", freq: "Daily", type: "Detective", nature: "Automated", key: false,
    evidence: "Initialled daily job checklist", systems: "SAP S/4HANA, ServiceNow", assertions: "n/a (ITGC)",
    defects: ["nature_mismatch"],
  },
  {
    id: "ITG-04", process: "ITGC", sub: "Access management", riskId: "R-ITG-04",
    risk: "Leavers retain system access after termination.",
    objective: "Leaver access is removed timely.",
    desc: "Upon notification from HR of each leaver, the IT Service Desk disables the leaver's network and SAP accounts within 1 business day of the termination date.",
    owner: "IT Service Desk Lead", freq: "Per leaver", type: "Preventive", nature: "Manual", key: true,
    evidence: "", systems: "Active Directory, SAP S/4HANA", assertions: "n/a (ITGC)",
    defects: ["evidence", "key_no_evidence"],
  },
  {
    id: "ITG-05", process: "ITGC", sub: "Privileged access", riskId: "R-ITG-05",
    risk: "Privileged (superuser) access is misused.",
    objective: "",
    desc: "Each month, within 10 business days after month-end, the IT Security Officer reviews the log of all SAP superuser and firefighter sessions, verifies each session against an approved ServiceNow ticket, and escalates any session without a ticket to the CIO within 2 business days. The signed log review is retained in ServiceNow.",
    owner: "IT Security Officer", freq: "Monthly", type: "Detective", nature: "Manual", key: true,
    evidence: "Signed firefighter log review", systems: "SAP S/4HANA, ServiceNow", assertions: "n/a (ITGC)",
    defects: ["missing_risk_link"],
  },
  {
    id: "ITG-06", process: "ITGC", sub: "Access management", riskId: "R-ITG-06",
    risk: "Weak authentication allows unauthorised access.",
    objective: "SAP enforces the password standard.",
    desc: "At every logon, SAP S/4HANA enforces the password parameters: minimum 12 characters, complexity rules, 90-day expiry and account lock after 5 failed attempts. The parameter settings are evidenced by a system parameter extract stored in the ITGC configuration baseline, which the IT Security Officer compares to the security standard after every SAP upgrade.",
    owner: "IT Security Officer", freq: "Continuous", type: "Preventive", nature: "Automated", key: true,
    evidence: "System parameter extract", systems: "SAP S/4HANA", assertions: "n/a (ITGC)", defects: [],
  },
];

/** Human-style headers, so the demo also exercises column auto-mapping. */
export const DEMO_HEADERS = [
  "Control ID", "Process", "Sub-process", "Risk ID", "Risk Description", "Control Objective",
  "Control Description", "Control Owner", "Frequency", "Control Type", "Nature", "Key Control (Y/N)",
  "Evidence", "System(s)", "Assertions",
] as const;

export function rowToCells(r: DemoRow): string[] {
  return [
    r.id, r.process, r.sub, r.riskId, r.risk, r.objective, r.desc, r.owner, r.freq, r.type, r.nature,
    r.key ? "Y" : "N", r.evidence, r.systems, r.assertions,
  ];
}
