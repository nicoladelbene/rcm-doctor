/**
 * Generates data/demo-rcm.xlsx, data/demo-rcm.csv, data/demo-rcm.ground-truth.json
 * and data/rcm-template.xlsx from scripts/demo-rcm-data.ts. Deterministic.
 *   npm run gen:demo
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { DEMO_HEADERS, DEMO_ROWS, rowToCells } from "./demo-rcm-data";

const DATA = join(process.cwd(), "data");
const PUBLIC = join(process.cwd(), "public");
mkdirSync(DATA, { recursive: true });

const TITLE = "Alpenfirn Industries AG — Risk & Control Matrix FY2026 (SYNTHETIC DEMO DATA — fictional company)";

function rcmSheet(rows: string[][], title: string) {
  const ws = XLSX.utils.aoa_to_sheet([[title], [], [...DEMO_HEADERS], ...rows]);
  ws["!cols"] = DEMO_HEADERS.map((h) =>
    h === "Control Description" ? { wch: 90 } : /Risk Desc|Objective/.test(h) ? { wch: 45 } : { wch: Math.max(12, h.length + 2) },
  );
  ws["!autofilter"] = { ref: `A3:O${rows.length + 3}` };
  return ws;
}

function write(wb: XLSX.WorkBook, path: string) {
  // Fixed timestamps keep the file byte-stable across runs.
  wb.Props = { Title: "rcm-doctor", Author: "rcm-doctor", CreatedDate: new Date("2026-11-15T00:00:00Z") };
  writeFileSync(path, XLSX.write(wb, { type: "buffer", bookType: "xlsx", compression: true }));
}

// Demo RCM
const demo = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(demo, rcmSheet(DEMO_ROWS.map(rowToCells), TITLE), "RCM");
XLSX.utils.book_append_sheet(
  demo,
  XLSX.utils.aoa_to_sheet([
    ["About this file"],
    ["Alpenfirn Industries AG is a fictional Swiss mid-cap. All controls are invented for demonstration and evaluation."],
    ["About a third of the controls contain planted defects; see demo-rcm.ground-truth.json in the rcm-doctor repository."],
    ["Licensed Apache-2.0 as part of rcm-doctor. Not audit advice."],
  ]),
  "About",
);
write(demo, join(DATA, "demo-rcm.xlsx"));

// CSV variant (used by tests and handy for users)
const csv = XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet([[...DEMO_HEADERS], ...DEMO_ROWS.map(rowToCells)]));
writeFileSync(join(DATA, "demo-rcm.csv"), csv + "\n");

// Ground truth
const truth = Object.fromEntries(DEMO_ROWS.map((r) => [r.id, r.defects]));
writeFileSync(join(DATA, "demo-rcm.ground-truth.json"), JSON.stringify(truth, null, 2) + "\n");

// Blank template with one gold-standard example row
const example = DEMO_ROWS.find((r) => r.id === "P2P-05")!;
const tpl = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  tpl,
  rcmSheet([rowToCells({ ...example, id: "EX-01" })], "Risk & Control Matrix — rcm-doctor template (replace the example row)"),
  "RCM",
);
XLSX.utils.book_append_sheet(
  tpl,
  XLSX.utils.aoa_to_sheet([
    ["Column", "What to enter"],
    ["Control ID", "Unique reference, e.g. P2P-01 (required)"],
    ["Control Description", "Who does what, when, how often, with which threshold, and what evidence is kept where (required)"],
    ["Control Owner", "A role, not a person's name (e.g. AP Team Lead)"],
    ["Frequency", "Continuous, Per transaction, Daily, Weekly, Monthly, Quarterly, Annually"],
    ["Control Type", "Preventive or Detective"],
    ["Nature", "Manual, Automated or IT-dependent manual"],
    ["Key Control (Y/N)", "Y or N"],
    ["Evidence", "What is retained and where"],
    ["Other columns", "Process, Sub-process, Risk ID, Risk Description, Control Objective, System(s), Assertions"],
    [],
    ["Header names are auto-mapped (e.g. 'Owner', 'Control activity', 'Periodicity' work too)."],
  ]),
  "Instructions",
);
write(tpl, join(DATA, "rcm-template.xlsx"));

// Static copies served by the web app
mkdirSync(PUBLIC, { recursive: true });
write(demo, join(PUBLIC, "demo-rcm.xlsx"));
write(tpl, join(PUBLIC, "rcm-template.xlsx"));

const defective = DEMO_ROWS.filter((r) => r.defects.length).length;
const planted = DEMO_ROWS.reduce((n, r) => n + r.defects.length, 0);
console.log(`Wrote ${DEMO_ROWS.length} controls (${defective} defective, ${planted} planted defects) to data/`);
