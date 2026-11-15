import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildReportXlsx, REVIEW_COLUMNS } from "@/core/export";
import { loadControls } from "@/core/parse";
import { reviewControls } from "@/core/review";

describe("export", () => {
  it("writes original columns + review columns, a findings sheet and a summary", async () => {
    const controls = loadControls(readFileSync("data/demo-rcm.xlsx"), "demo-rcm.xlsx");
    const reviews = await reviewControls(controls);
    const wb = XLSX.read(buildReportXlsx(controls, reviews, { source: "demo" }), { type: "array" });
    expect(wb.SheetNames).toEqual(["Review", "Findings", "Summary"]);

    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets.Review);
    expect(rows).toHaveLength(40);
    for (const col of ["Control ID", "Control Description", ...REVIEW_COLUMNS]) expect(Object.keys(rows[2]), col).toContain(col);
    const p2p03 = rows.find((r) => r["Control ID"] === "P2P-03")!;
    expect(p2p03["Review Status"]).toBe("fail");
    expect(p2p03["Findings"]).toMatch(/Key control without evidence/);

    const findings = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets.Findings);
    expect(findings.length).toBe(reviews.reduce((n, r) => n + r.findings.length, 0));
    expect(findings.find((f) => f["Control ID"] === "TRE-03")?.["Cited text"]).toBe("prepares and approves");
    const summary = XLSX.utils.sheet_to_json<string[]>(wb.Sheets.Summary, { header: 1 });
    expect(summary.find((r) => r[0] === "Controls reviewed")?.[1]).toBe(40);
  });
});
