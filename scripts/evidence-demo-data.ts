/**
 * Synthetic evidence for 5 demo controls of the fictional "Alpenfirn Industries AG".
 * Every name, number, bank and IBAN is invented. Two controls carry planted exceptions (R2R-01, TRE-01);
 * the clean ones contain deliberate near-misses (amount exactly at a threshold, a weekend in a deadline,
 * an unticketed session that WAS escalated in time) to measure false exceptions.
 */

export interface HtmlDoc {
  kind: "pdf" | "image";
  name: string;
  /** One HTML fragment per page (pdf) or a single screen (image). */
  pages: string[];
}
export interface CsvDoc {
  kind: "csv";
  name: string;
  rows: string[][];
}
export type DemoDoc = HtmlDoc | CsvDoc;

export interface DemoEvidence {
  control_id: string;
  samples: string[];
  docs: DemoDoc[];
  /** Planted exceptions: `find` = exact token texts that prove it (located after rendering → token ids). */
  exceptions: { sample_id: string; attribute_id: string; file: number; find: string[]; why: string }[];
}

const SYN = `<div class="syn">SYNTHETIC DEMO EVIDENCE — fictional company, invented data</div>`;

/* ------------------------------------------------------------------ */
/* P2P-05 — monthly GR/IR ageing review (PDF, 2 sampled months)        */
/* ------------------------------------------------------------------ */

function grir(month: string, runDate: string, items: string[][], corrections: string, signed: string, folder: string) {
  return `<div class="doc">
  ${SYN}
  <div class="hdr"><div><div class="co">Alpenfirn Industries AG</div><div class="sub">Accounts Payable · Month-end close</div></div><div class="sub">Page 1 of 1</div></div>
  <h1>GR/IR clearing account 191100 — ageing report</h1>
  <table class="kv"><tr><td>Period</td><td>${month}</td></tr><tr><td>Report run</td><td>${runDate}</td></tr><tr><td>Source</td><td>SAP S/4HANA, company code 1000</td></tr><tr><td>Selection</td><td>All open items, account 191100</td></tr></table>
  <table class="grid"><thead><tr><th>Document</th><th>Vendor</th><th>Age (days)</th><th>Amount CHF</th><th>Investigation note</th></tr></thead><tbody>
  ${items.map((r) => `<tr>${r.map((c, i) => `<td${i === 2 || i === 3 ? ' class="num"' : ""}>${c ? `<span>${c}</span>` : ""}</td>`).join("")}</tr>`).join("")}
  </tbody></table>
  <p class="small"><span>Threshold for investigation: open items older than 90 days or above CHF 25,000.</span></p>
  <h2>Corrections</h2>
  <p><span>${corrections}</span></p>
  <div class="sign"><div><div class="lbl">Reviewed and signed — AP Team Lead</div><div class="sig">L. Brunner</div><div class="lbl">Date: ${signed}</div></div></div>
  <div class="foot"><span>Filed: ${folder}</span></div>
</div>`;
}

const P2P05: DemoEvidence = {
  control_id: "P2P-05",
  samples: ["2026-03", "2026-09"],
  docs: [
    {
      kind: "pdf",
      name: "GRIR-ageing-2026-03-signed.pdf",
      pages: [
        grir(
          "March 2026",
          "01.04.2026 07:02",
          [
            ["5000018822", "Brennwald Logistik AG", "124", "8,450.00", "GR posted, invoice outstanding; vendor reminded 01.04.2026"],
            ["5000019310", "Talwerk Metall GmbH", "47", "31,200.00", "Price difference CHF 1,200; credit note requested"],
            ["5000019544", "Seetal Verpackungen AG", "22", "4,310.50", ""],
            ["5000019601", "Nordhang Elektro AG", "96", "2,980.00", "Duplicate goods receipt; reversal JE 4900007712"],
            ["5000019720", "Alpwerk Druckluft AG", "15", "12,775.00", ""],
          ],
          "JE 4900007712 (reversal of duplicate GR, CHF 2,980.00): approved by Accounting Manager R. Gasser on 02.04.2026 10:14; posted 02.04.2026 15:40.",
          "02.04.2026",
          "SharePoint › Finance › Month-end close › 2026-03 › GRIR",
        ),
      ],
    },
    {
      kind: "pdf",
      name: "GRIR-ageing-2026-09-signed.pdf",
      pages: [
        grir(
          "September 2026",
          "01.10.2026 06:58",
          [
            ["5000024410", "Talwerk Metall GmbH", "103", "6,120.00", "Partial delivery; remaining GR expected 15.10.2026"],
            ["5000024532", "Kandersteg Werkzeuge AG", "61", "24,980.00", ""],
            ["5000024588", "Brennwald Logistik AG", "33", "58,400.00", "Invoice received 30.09.2026, matched 02.10.2026"],
            ["5000024690", "Seetal Verpackungen AG", "9", "1,940.00", ""],
          ],
          "No corrections posted for September 2026.",
          "05.10.2026",
          "SharePoint › Finance › Month-end close › 2026-09 › GRIR",
        ),
      ],
    },
  ],
  exceptions: [],
};

/* ------------------------------------------------------------------ */
/* TRE-01 — bank account requests (PDF, 4 forms) · planted exception   */
/* ------------------------------------------------------------------ */

function bar(no: string, reqDate: string, action: string, account: string, gt: string, cfo: string, instructed: string, confirmed: string, registered: string, analyst: string) {
  return `<div class="doc">
  ${SYN}
  <div class="hdr"><div><div class="co">Alpenfirn Industries AG</div><div class="sub">Group Treasury</div></div><div class="sub">Form TR-07</div></div>
  <h1>Bank account request</h1>
  <table class="kv">
    <tr><td>Request no.</td><td>${no}</td></tr>
    <tr><td>Date of request</td><td>${reqDate}</td></tr>
    <tr><td>Entity</td><td>Alpenfirn Industries AG</td></tr>
    <tr><td>Bank</td><td>Bank Seeland AG (fictional)</td></tr>
    <tr><td>Action</td><td>${action}</td></tr>
    <tr><td>Account</td><td>${account}</td></tr>
  </table>
  <h2>Approval (both signatures required before the bank is instructed)</h2>
  <div class="sign two">
    <div><div class="lbl">Group Treasurer</div><div class="sig">S. Imhof</div><div class="lbl">Signed: ${gt}</div></div>
    <div><div class="lbl">Chief Financial Officer</div><div class="sig">D. Vogt</div><div class="lbl">Signed: ${cfo}</div></div>
  </div>
  <h2>Execution</h2>
  <table class="kv">
    <tr><td>Instruction sent to bank</td><td>${instructed}</td></tr>
    <tr><td>Bank confirmation received</td><td>${confirmed}</td></tr>
    <tr><td>Bank account register updated</td><td>${registered}</td></tr>
    <tr><td>Register updated by</td><td>${analyst}</td></tr>
  </table>
  <div class="foot"><span>Filed: SharePoint › Treasury › Bank accounts › 2026 › ${no}</span></div>
</div>`;
}

const TRE01: DemoEvidence = {
  control_id: "TRE-01",
  samples: ["BAR-2026-01", "BAR-2026-02", "BAR-2026-03", "BAR-2026-04"],
  docs: [
    {
      kind: "pdf",
      name: "bank-account-requests-2026.pdf",
      pages: [
        bar("BAR-2026-01", "09.01.2026", "Open — EUR operating account", "CH00 0000 0000 0000 0101 E (fictional)", "12.01.2026", "13.01.2026", "14.01.2026", "20.01.2026", "21.01.2026", "Treasury Analyst M. Odermatt"),
        // Near-miss: confirmation on a Thursday, register on the Monday = 2 business days (weekend in between).
        bar("BAR-2026-02", "16.03.2026", "Modify — remove signatory, add signatory", "CH00 0000 0000 0000 0102 C (fictional)", "17.03.2026", "17.03.2026", "18.03.2026", "26.03.2026", "30.03.2026", "Treasury Analyst M. Odermatt"),
        // Planted exception: confirmed Wed 10.06.2026, register updated Thu 18.06.2026 = 6 business days.
        bar("BAR-2026-03", "01.06.2026", "Close — USD collection account", "CH00 0000 0000 0000 0103 U (fictional)", "02.06.2026", "03.06.2026", "04.06.2026", "10.06.2026", "18.06.2026", "Treasury Analyst M. Odermatt"),
        bar("BAR-2026-04", "21.09.2026", "Open — CHF payroll account", "CH00 0000 0000 0000 0104 P (fictional)", "22.09.2026", "23.09.2026", "24.09.2026", "29.09.2026", "30.09.2026", "Treasury Analyst M. Odermatt"),
      ],
    },
  ],
  exceptions: [
    { sample_id: "BAR-2026-03", attribute_id: "C", file: 0, find: ["18.06.2026"], why: "register updated 6 business days after the bank confirmation (10.06 → 18.06), limit is 2" },
  ],
};

/* ------------------------------------------------------------------ */
/* R2R-01 — manual JE approvals (CSV, 25 entries) · planted exceptions */
/* ------------------------------------------------------------------ */

const JE_HEAD = ["je_number", "posting_date", "posting_time", "amount_chf", "entered_by", "approver_1", "approver_1_role", "approved_1_at", "approver_2", "approver_2_role", "approved_2_at", "workflow_status"];
const preparers = ["ACC_MEIER", "ACC_ROTH", "ACC_KUNZ"];
const ams = ["AM_GASSER", "AM_FREI"];
const amounts = [
  "18,420.00", "245,000.00", "12,980.50", "1,412,500.00", "33,750.00", "61,200.00", "10,450.00", "1,000,000.00", "27,300.00", "2,350,000.00",
  "86,300.00", "14,999.90", "402,180.00", "19,875.00", "73,640.00", "1,180,400.00", "11,210.00", "58,000.00", "125,900.00", "22,460.00",
  "39,990.00", "16,700.00", "940,000.00", "45,320.00", "13,050.00",
];
const jeRows: string[][] = amounts.map((amt, i) => {
  const no = String(100021 + i * 4);
  const m = 1 + Math.floor((i * 11) / 25);
  const d = 3 + ((i * 7) % 24);
  const date = `2026-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const post = `${String(11 + (i % 6)).padStart(2, "0")}:${String((i * 13) % 60).padStart(2, "0")}`;
  const ap = `${String(9 + (i % 2)).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}`;
  const big = Number(amt.replace(/,/g, "")) > 1_000_000;
  return [no, date, post, amt, preparers[i % 3], ams[i % 2], "Accounting Manager", `${date} ${ap}`, big ? "GC_LEHMANN" : "", big ? "Group Controller" : "", big ? `${date} 10:${String(30 + i).slice(-2)}` : "", "Approved · Posted"];
});
// Planted exception 1: > CHF 1m without Group Controller approval.
jeRows[3][8] = jeRows[3][9] = jeRows[3][10] = "";
// Planted exception 2: Accounting Manager approval after posting (posted 11:32, approved 16:05 the same day).
jeRows[10][2] = "11:32";
jeRows[10][7] = `${jeRows[10][1]} 16:05`;

const R2R01: DemoEvidence = {
  control_id: "R2R-01",
  samples: jeRows.map((r) => r[0]),
  docs: [
    { kind: "csv", name: "SAP-JE-workflow-history-FY2026-sample.csv", rows: [JE_HEAD, ...jeRows] },
    {
      kind: "csv",
      name: "SAP-JE-workflow-configuration-extract.csv",
      rows: [
        ["setting", "value", "last_changed", "change_reference"],
        ["Manual JE approval threshold", "CHF 10,000", "2025-11-03", "CHG0041877"],
        ["Approver group (level 1)", "Accounting Manager", "2025-11-03", "CHG0041877"],
        ["Self-approval check (approver must differ from entered_by)", "Active — hard stop", "2025-11-03", "CHG0041877"],
        ["Second approval threshold (Group Controller)", "above CHF 1,000,000", "2025-11-03", "CHG0041877"],
        ["Changes to these settings in FY2026", "None (change log extract 2026-11-10)", "", ""],
      ],
    },
  ],
  exceptions: [
    { sample_id: jeRows[3][0], attribute_id: "D", file: 0, find: [jeRows[3][3]], why: "entry of CHF 1,412,500 above CHF 1m has no Group Controller approval" },
    { sample_id: jeRows[10][0], attribute_id: "A", file: 0, find: [`${jeRows[10][1]} 16:05`, "11:32"], why: "Accounting Manager approval at 16:05, after posting at 11:32" },
  ],
};

/* ------------------------------------------------------------------ */
/* ITG-05 — monthly firefighter log review (CSV, 2 sampled months)     */
/* ------------------------------------------------------------------ */

const FF_HEAD = ["session_id", "firefighter_id", "user", "start", "end", "reason", "ticket", "ticket_status", "review_result", "escalated_to_cio_on"];
const ITG05: DemoEvidence = {
  control_id: "ITG-05",
  samples: ["2026-05", "2026-10"],
  docs: [
    {
      kind: "csv",
      name: "FF-session-review-2026-05.csv",
      rows: [
        FF_HEAD,
        ["FF-0526-01", "FF_BASIS_01", "B.HUBER", "2026-05-04 21:10", "2026-05-04 22:02", "Kernel patch", "CHG0052210", "Approved", "Matched to approved ticket", ""],
        ["FF-0526-02", "FF_FI_01", "C.WYSS", "2026-05-12 08:15", "2026-05-12 08:41", "Period reopen", "INC0098812", "Approved", "Matched to approved ticket", ""],
        ["FF-0526-03", "FF_BASIS_01", "B.HUBER", "2026-05-19 19:30", "2026-05-19 20:05", "Job repair", "INC0099140", "Approved", "Matched to approved ticket", ""],
        ["FF-0526-04", "FF_SEC_01", "A.STEINER", "2026-05-27 17:02", "2026-05-27 17:20", "Role fix", "CHG0052399", "Approved", "Matched to approved ticket", ""],
        [],
        ["COMPLETENESS", "Sessions in SAP firefighter log for May 2026: 4", "Sessions reviewed: 4", "", "", "", "", "", "", ""],
        ["REVIEW SIGN-OFF", "IT Security Officer P. Zürcher", "signed 2026-06-08", "stored in ServiceNow RITM0072214", "", "", "", "", "", ""],
      ],
    },
    {
      kind: "csv",
      name: "FF-session-review-2026-10.csv",
      rows: [
        FF_HEAD,
        ["FF-1026-01", "FF_BASIS_01", "B.HUBER", "2026-10-02 22:00", "2026-10-02 23:15", "Support package", "CHG0055931", "Approved", "Matched to approved ticket", ""],
        ["FF-1026-02", "FF_FI_01", "C.WYSS", "2026-10-07 07:50", "2026-10-07 08:10", "Posting period", "INC0104410", "Approved", "Matched to approved ticket", ""],
        ["FF-1026-03", "FF_MM_01", "D.ODERMATT", "2026-10-15 14:22", "2026-10-15 14:58", "Stuck IDocs", "INC0104987", "Approved", "Matched to approved ticket", ""],
        // Near-miss: no ticket, but escalated to the CIO 1 business day after the review (within 2).
        ["FF-1026-04", "FF_BASIS_01", "E.KELLER", "2026-10-21 18:40", "2026-10-21 18:52", "Not stated", "", "", "No ticket — escalated", "2026-11-09"],
        ["FF-1026-05", "FF_SEC_01", "A.STEINER", "2026-10-28 16:05", "2026-10-28 16:31", "Role fix", "CHG0056102", "Approved", "Matched to approved ticket", ""],
        [],
        ["COMPLETENESS", "Sessions in SAP firefighter log for October 2026: 5", "Sessions reviewed: 5", "", "", "", "", "", "", ""],
        ["REVIEW SIGN-OFF", "IT Security Officer P. Zürcher", "signed 2026-11-06", "stored in ServiceNow RITM0075530", "", "", "", "", "", ""],
      ],
    },
  ],
  exceptions: [],
};

/* ------------------------------------------------------------------ */
/* ITG-06 — password parameters (screenshot)                           */
/* ------------------------------------------------------------------ */

const ITG06: DemoEvidence = {
  control_id: "ITG-06",
  samples: ["PARAM-2026-05-18"],
  docs: [
    {
      kind: "image",
      name: "password-parameters-2026-05-18.png",
      pages: [
        `<div class="screen">
  <div class="bar"><span>System parameter display — S4P / client 100</span><span>Extract 2026-05-18 09:12</span></div>
  ${SYN}
  <div class="scr-body">
    <div class="scr-title">Active profile parameters — password and logon (applied at every logon)</div>
    <table class="grid scr"><thead><tr><th>Parameter</th><th>Description</th><th>Active value</th><th>Status</th></tr></thead><tbody>
      <tr><td>login/min_password_lng</td><td>Minimum password length</td><td class="num">12</td><td>Active</td></tr>
      <tr><td>login/min_password_letters</td><td>Minimum letters</td><td class="num">1</td><td>Active</td></tr>
      <tr><td>login/min_password_digits</td><td>Minimum digits</td><td class="num">1</td><td>Active</td></tr>
      <tr><td>login/min_password_specials</td><td>Minimum special characters</td><td class="num">1</td><td>Active</td></tr>
      <tr><td>login/password_expiration_time</td><td>Password expiry (days)</td><td class="num">90</td><td>Active</td></tr>
      <tr><td>login/fails_to_user_lock</td><td>Failed logons before lock</td><td class="num">5</td><td>Active</td></tr>
    </tbody></table>
    <div class="scr-note"><span>Stored in ITGC configuration baseline: S4P / 2026-05-18 / password-parameters</span></div>
    <div class="scr-note"><span>Post-upgrade comparison to Security Standard ISS-07 v3.1 (upgrade 2026-05-16): no differences</span></div>
    <div class="scr-note"><span>Compared and signed off by IT Security Officer P. Zürcher on 2026-05-19</span></div>
  </div>
</div>`,
      ],
    },
  ],
  exceptions: [],
};

export const DEMO_EVIDENCE: DemoEvidence[] = [P2P05, TRE01, R2R01, ITG05, ITG06];

export const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #1d232b; background: #fff; }
.page { width: 794px; height: 1123px; overflow: hidden; page-break-after: always; break-after: page; padding: 56px 60px; position: relative; }
.syn { font-size: 10px; letter-spacing: .08em; color: #9a3b1b; border: 1px solid #e3b9a8; background: #fbefe9; display: inline-block; padding: 3px 8px; margin-bottom: 18px; }
.hdr { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1d232b; padding-bottom: 10px; margin-bottom: 22px; }
.co { font-weight: 700; font-size: 17px; }
.sub { font-size: 12px; color: #5c6670; }
h1 { font-size: 21px; margin-bottom: 16px; }
h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: #3c4650; margin: 22px 0 10px; }
p { font-size: 13px; line-height: 1.5; }
.small { font-size: 11.5px; color: #5c6670; margin-top: 8px; }
table { border-collapse: collapse; }
.kv td { font-size: 13px; padding: 4px 18px 4px 0; vertical-align: top; }
.kv td:first-child { color: #5c6670; width: 210px; }
.grid { width: 100%; margin-top: 18px; }
.grid th { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; text-align: left; background: #eef1f4; padding: 7px 8px; border-bottom: 1px solid #c9d0d6; }
.grid td { font-size: 12.5px; padding: 7px 8px; border-bottom: 1px solid #e3e7eb; vertical-align: top; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.sign { display: flex; gap: 60px; margin-top: 28px; }
.sign > div { min-width: 240px; border-top: 1px solid #9aa4ad; padding-top: 6px; }
.sig { font-family: "Snell Roundhand", "Brush Script MT", cursive; font-size: 30px; color: #1b3f8f; margin: 4px 0 2px; }
.lbl { font-size: 12px; color: #3c4650; }
.foot { position: absolute; left: 60px; right: 60px; bottom: 44px; border-top: 1px solid #c9d0d6; padding-top: 8px; font-size: 11.5px; color: #5c6670; }
.screen { width: 1280px; height: 720px; background: #f4f6f8; font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; }
.screen .syn { margin: 14px 24px 0; }
.bar { height: 40px; background: #2d3e50; color: #fff; display: flex; justify-content: space-between; align-items: center; padding: 0 18px; font-size: 14px; }
.scr-body { padding: 12px 24px; }
.scr-title { font-size: 18px; font-weight: 600; margin: 6px 0 4px; }
.scr { background: #fff; }
.scr td { font-size: 14px; padding: 9px 10px; }
.scr th { font-size: 12px; }
.scr-note { font-size: 14px; margin-top: 12px; color: #26323d; }
`;
