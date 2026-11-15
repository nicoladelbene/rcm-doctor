import * as XLSX from "xlsx";
import { CONTROL_FIELDS, ControlSchema, type Control, type ControlField } from "./schema";

/** Header synonyms (normalized: lowercase, alphanumerics only). */
const SYNONYMS: Record<ControlField, string[]> = {
  control_id: ["controlid", "controlref", "controlreference", "controlno", "controlnumber", "ctrlid", "id", "ref", "controlcode"],
  process: ["process", "businessprocess", "mainprocess", "cycle", "processarea"],
  sub_process: ["subprocess", "subprocessname", "subcycle", "activity"],
  risk_id: ["riskid", "riskref", "riskreference", "riskno", "risknumber", "riskcode"],
  risk_description: ["riskdescription", "risk", "riskstatement", "whatcouldgowrong", "wcgw"],
  control_objective: ["controlobjective", "objective", "controlobjectives"],
  control_description: ["controldescription", "control", "description", "controlactivity", "controlactivities", "controlnarrative"],
  control_owner: ["controlowner", "owner", "responsible", "performer", "controlperformer", "responsibleperson", "responsiblerole"],
  frequency: ["frequency", "controlfrequency", "periodicity", "timing"],
  control_type: ["controltype", "type", "preventivedetective", "preventiveordetective"],
  nature: ["nature", "controlnature", "manualautomated", "automation", "manualorautomated", "executiontype"],
  key_control: ["keycontrol", "key", "iskey", "keycontrolyn", "keyyn"],
  evidence: ["evidence", "controlevidence", "documentation", "evidenceofperformance", "evidenceretained", "proof"],
  systems: ["systems", "system", "application", "applications", "itsystem", "itsystems", "tool"],
  assertions: ["assertions", "assertion", "financialassertions", "fsassertions"],
};

export const REQUIRED_FIELDS: ControlField[] = ["control_id", "control_description"];

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

export type ColumnMapping = Partial<Record<ControlField, string>>;

/** Map raw headers to canonical fields: exact synonym first, then prefix/contains. */
export function autoMapHeaders(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  const normed = headers.map((h) => ({ raw: h, n: norm(h) }));

  for (const field of CONTROL_FIELDS) {
    const hit = normed.find((h) => !used.has(h.raw) && (h.n === norm(field) || SYNONYMS[field].includes(h.n)));
    if (hit) {
      mapping[field] = hit.raw;
      used.add(hit.raw);
    }
  }
  // Loose pass: header contains a long synonym (e.g. "Control description (as performed)").
  for (const field of CONTROL_FIELDS) {
    if (mapping[field]) continue;
    const hit = normed.find(
      (h) => !used.has(h.raw) && SYNONYMS[field].some((s) => s.length >= 6 && h.n.includes(s)),
    );
    if (hit) {
      mapping[field] = hit.raw;
      used.add(hit.raw);
    }
  }
  return mapping;
}

export interface ParseResult {
  headers: string[];
  rows: Record<string, string>[];
  mapping: ColumnMapping;
  missingRequired: ControlField[];
}

/** Read the first sheet of an xlsx/xls/csv buffer into raw string rows. */
export function readTable(data: ArrayBuffer | Uint8Array | string, fileName = "rcm.xlsx"): { headers: string[]; rows: Record<string, string>[] } {
  const isCsv = /\.(csv|txt)$/i.test(fileName) || typeof data === "string";
  const wb = isCsv
    ? XLSX.read(typeof data === "string" ? data : new TextDecoder().decode(data), { type: "string", raw: true })
    : XLSX.read(data, { type: "array" });
  const sheetName = pickSheet(wb);
  const sheet = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false, blankrows: false });
  // Header row = first row with at least 3 non-empty cells (RCMs often have a title row).
  const headerIdx = aoa.findIndex((r) => r.filter((c) => String(c).trim() !== "").length >= 3);
  if (headerIdx < 0) return { headers: [], rows: [] };
  const headers = aoa[headerIdx].map((h) => String(h).trim());
  const rows = aoa
    .slice(headerIdx + 1)
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, String(r[i] ?? "").trim()])))
    .filter((r) => Object.values(r).some((v) => v !== ""));
  return { headers: headers.filter(Boolean), rows };
}

function pickSheet(wb: XLSX.WorkBook): string {
  return wb.SheetNames.find((n) => /rcm|control/i.test(n)) ?? wb.SheetNames[0];
}

export function parseRcm(data: ArrayBuffer | Uint8Array | string, fileName?: string): ParseResult {
  const { headers, rows } = readTable(data, fileName);
  const mapping = autoMapHeaders(headers);
  const missingRequired = REQUIRED_FIELDS.filter((f) => !mapping[f]);
  return { headers, rows, mapping, missingRequired };
}

export function toBool(v: string): boolean {
  return /^(y|yes|true|1|x|key|ja|oui|si|sì)$/i.test(v.trim());
}

/** Apply a (possibly user-confirmed) mapping to raw rows. Rows without id and description are dropped. */
export function rowsToControls(rows: Record<string, string>[], mapping: ColumnMapping): Control[] {
  const out: Control[] = [];
  rows.forEach((row, i) => {
    const get = (f: ControlField) => (mapping[f] ? (row[mapping[f]!] ?? "").trim() : "");
    const description = get("control_description");
    if (!description && !get("control_id")) return;
    const record: Record<string, unknown> = {};
    for (const f of CONTROL_FIELDS) record[f] = f === "key_control" ? toBool(get(f)) : get(f);
    if (!record.control_id) record.control_id = `ROW-${i + 2}`;
    out.push(ControlSchema.parse(record));
  });
  return out;
}

/** Convenience: parse + map in one go (used by scripts and tests). */
export function loadControls(data: ArrayBuffer | Uint8Array | string, fileName?: string): Control[] {
  const r = parseRcm(data, fileName);
  if (r.missingRequired.length) throw new Error(`Missing required columns: ${r.missingRequired.join(", ")}`);
  return rowsToControls(r.rows, r.mapping);
}
