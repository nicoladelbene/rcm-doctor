import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { autoMapHeaders, loadControls, parseRcm, rowsToControls } from "@/core/parse";

describe("autoMapHeaders", () => {
  it("maps common header variants case-insensitively", () => {
    const m = autoMapHeaders([
      "Ctrl ID", "Business Process", "Sub-Process", "Risk Ref", "WCGW", "Objective",
      "Control Activity", "Owner", "Periodicity", "Preventive/Detective", "Manual/Automated",
      "Key?", "Evidence of performance", "Application", "FS Assertions",
    ]);
    expect(m).toEqual({
      control_id: "Ctrl ID", process: "Business Process", sub_process: "Sub-Process", risk_id: "Risk Ref",
      risk_description: "WCGW", control_objective: "Objective", control_description: "Control Activity",
      control_owner: "Owner", frequency: "Periodicity", control_type: "Preventive/Detective",
      nature: "Manual/Automated", key_control: "Key?", evidence: "Evidence of performance",
      systems: "Application", assertions: "FS Assertions",
    });
  });

  it("falls back to contains-matching for long headers", () => {
    const m = autoMapHeaders(["Control ID", "Control description (as performed)"]);
    expect(m.control_description).toBe("Control description (as performed)");
  });

  it("does not map the same header twice", () => {
    const m = autoMapHeaders(["ID", "Description"]);
    expect(m.control_id).toBe("ID");
    expect(m.control_description).toBe("Description");
    expect(Object.values(m)).toHaveLength(2);
  });
});

describe("parseRcm", () => {
  it("reads the demo xlsx, skipping the title row", () => {
    const controls = loadControls(readFileSync("data/demo-rcm.xlsx"), "demo-rcm.xlsx");
    expect(controls).toHaveLength(40);
    expect(controls[0].control_id).toBe("P2P-01");
    expect(controls[0].key_control).toBe(true);
    expect(controls.find((c) => c.control_id === "TRE-06")?.control_owner).toBe("Martin Keller");
  });

  it("reads CSV with the same result as xlsx", () => {
    const fromCsv = loadControls(readFileSync("data/demo-rcm.csv", "utf8"), "demo-rcm.csv");
    const fromXlsx = loadControls(readFileSync("data/demo-rcm.xlsx"), "demo-rcm.xlsx");
    expect(fromCsv).toEqual(fromXlsx);
  });

  it("reports missing required columns", () => {
    const r = parseRcm("Owner,Frequency,Nature\nAP Lead,Monthly,Manual\n", "x.csv");
    expect(r.missingRequired).toEqual(["control_id", "control_description"]);
  });

  it("normalizes key control flags and assigns ids to rows without one", () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Control ID", "Control Description", "Key Control", "Owner"],
      ["", "The AP Team Lead reviews...", "yes", "AP Team Lead"],
      ["C-2", "Another control", "N", ""],
      ["", "", "", ""],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const r = parseRcm(buf, "t.xlsx");
    const cs = rowsToControls(r.rows, r.mapping);
    expect(cs.map((c) => [c.control_id, c.key_control])).toEqual([["ROW-2", true], ["C-2", false]]);
  });
});
