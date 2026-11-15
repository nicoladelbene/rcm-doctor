/**
 * Week 6: writes the "AI systems controls pack" (scripts/ai-pack-data.ts) to data/ai-pack-rcm.xlsx (+ public copy),
 * data/ai-pack.ground-truth.json and data/ai-pack.mappings.json. Deterministic.
 *   npm run gen:ai-pack
 */
import { writeFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { AI_ROWS } from "./ai-pack-data";
import { DEMO_HEADERS, rowToCells } from "./demo-rcm-data";

const REF_HEADERS = ["EU AI Act (Reg. 2024/1689)", "ISO/IEC 42001:2023 Annex A", "NIST AI RMF 1.0", "FINMA Guidance 08/2024"];
const rows = AI_ROWS.map((r) => [...rowToCells(r), r.refs.euAiAct, r.refs.iso42001, r.refs.nistAiRmf, r.refs.finma]);
const headers = [...DEMO_HEADERS, ...REF_HEADERS];
const ws = XLSX.utils.aoa_to_sheet([["AI systems controls pack — Alpenfirn Industries AG (SYNTHETIC — fictional company; references verified 2026-11-15)"], [], headers, ...rows]);
ws["!cols"] = headers.map((h) => (h === "Control Description" ? { wch: 90 } : /Risk Desc|Objective/.test(h) ? { wch: 45 } : { wch: Math.max(12, h.length + 2) }));
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "RCM");
XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.aoa_to_sheet([
    ["About this pack"],
    ["25 controls for AI systems (deployer view): inventory and classification, data quality, human oversight, monitoring, third parties, logging and incidents."],
    ["References were checked on the web on 2026-11-15; an empty cell means no verified reference fits. See docs/research/ai-governance-references.md."],
    ["EU AI Act: Regulation (EU) 2024/1689. ISO/IEC 42001:2023 Annex A control IDs. NIST AI RMF 1.0 (AI 100-1) subcategories. FINMA Guidance 08/2024 section numbers (guidance, not binding law)."],
    ["Six controls contain planted design defects for evaluation (data/ai-pack.ground-truth.json). Licensed Apache-2.0 as part of rcm-doctor. Not legal or audit advice."],
  ]),
  "About",
);
wb.Props = { Title: "rcm-doctor AI pack", Author: "rcm-doctor", CreatedDate: new Date("2026-11-15T00:00:00Z") };
const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx", compression: true });
writeFileSync("data/ai-pack-rcm.xlsx", buf);
writeFileSync("public/ai-pack-rcm.xlsx", buf);
writeFileSync("data/ai-pack.ground-truth.json", JSON.stringify(Object.fromEntries(AI_ROWS.map((r) => [r.id, r.defects])), null, 2) + "\n");
writeFileSync("data/ai-pack.mappings.json", JSON.stringify(Object.fromEntries(AI_ROWS.map((r) => [r.id, r.refs])), null, 2) + "\n");
console.log(`Wrote ${AI_ROWS.length} controls (${AI_ROWS.filter((r) => r.defects.length).length} with planted defects)`);
