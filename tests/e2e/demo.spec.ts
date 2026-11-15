import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import * as XLSX from "xlsx";

test("demo: results render, drawer shows cited spans, report downloads", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("try-demo").click();

  const rows = page.getByTestId("result-row");
  await expect(rows).toHaveCount(40);
  await expect(page.getByText("Controls reviewed")).toBeVisible();

  await page.locator('[data-id="TRE-03"]').click();
  const drawer = page.getByTestId("drawer");
  await expect(drawer).toBeVisible();
  await expect(drawer.locator("mark.cite-fail", { hasText: "prepares and approves" })).toBeVisible();
  await expect(drawer.getByTestId("rewrite")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-report").click()]);
  expect(download.suggestedFilename()).toMatch(/^rcm-review-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const wb = XLSX.read(readFileSync((await download.path())!), { type: "buffer" });
  expect(wb.SheetNames).toEqual(["Review", "Findings", "Summary"]);
  expect(XLSX.utils.sheet_to_json(wb.Sheets.Review)).toHaveLength(40);
});

test("upload: CSV runs rules-only without a key", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload your RCM" }).click();
  await page.getByTestId("file-input").setInputFiles("data/demo-rcm.csv");
  await expect(page.getByText("40 rows")).toBeVisible();
  await page.getByRole("button", { name: "Run rules-only review" }).click();
  await expect(page.getByTestId("result-row")).toHaveCount(40);
  await expect(page.getByText(/Rules-only review/)).toBeVisible();
  // P2P-03 fails on the deterministic rules alone (key control without evidence).
  await expect(page.locator('[data-id="P2P-03"]')).toContainText("Fail");
});

test("api: rejects requests without a key and oversized batches", async ({ request }) => {
  const noKey = await request.post("/api/review", { data: { controls: [] } });
  expect(noKey.status()).toBe(401);
  const tooMany = await request.post("/api/review", {
    headers: { "x-openrouter-key": "sk-or-v1-" + "a".repeat(40) },
    data: { controls: Array.from({ length: 11 }, (_, i) => ({ control_id: `C${i}`, control_description: "x" })) },
  });
  expect(tooMany.status()).toBe(400);
});
