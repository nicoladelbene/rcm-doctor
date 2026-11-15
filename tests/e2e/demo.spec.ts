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
  expect(wb.SheetNames).toEqual(["Review", "Findings", "Test scripts", "Automation", "Summary"]);
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

test("week 2: test script tab shows sample size, traced attributes and blockers; export has the sheet", async ({ page }) => {
  await page.goto("/?demo");
  await expect(page.getByTestId("result-row")).toHaveCount(40);
  await expect(page.getByTestId("testscript-summary")).toContainText("ready");

  await page.locator('[data-id="P2P-05"]').click();
  await page.getByTestId("tab-test").click();
  const ts = page.getByTestId("testscript");
  await expect(ts.getByTestId("sample-size")).toHaveText("2");
  await expect(ts.locator("mark.cite-test").first()).toBeVisible();
  // Tab persists while navigating; a control with an SoD conflict is blocked.
  await page.keyboard.press("Escape");
  await page.locator('[data-id="TRE-03"]').click();
  await expect(page.getByTestId("testscript")).toContainText("Blocked");
  await page.keyboard.press("Escape");

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-report").click()]);
  const wb = XLSX.read(readFileSync((await download.path())!), { type: "buffer" });
  expect(wb.SheetNames).toContain("Test scripts");
});

test("upload without a key gives deterministic test scripts", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload your RCM" }).click();
  await page.getByTestId("file-input").setInputFiles("data/demo-rcm.csv");
  await page.getByRole("button", { name: "Run rules-only review" }).click();
  await expect(page.getByTestId("testscript-summary")).toBeVisible();
  await page.locator('[data-id="P2P-08"]').click();
  await page.getByTestId("tab-test").click();
  await expect(page.getByTestId("sample-size")).toHaveText("2");
});

test("api: testscript route enforces key and limits", async ({ request }) => {
  expect((await request.post("/api/testscript", { data: { items: [] } })).status()).toBe(401);
  const bad = await request.post("/api/testscript", { headers: { "x-openrouter-key": "sk-or-v1-" + "a".repeat(40) }, data: { items: [] } });
  expect(bad.status()).toBe(400);
});

test("week 4: automation heatmap, business cases and editable assumptions", async ({ page }) => {
  await page.goto("/?demo");
  await expect(page.getByTestId("result-row")).toHaveCount(40);
  await page.getByTestId("view-automation").click();
  const auto = page.getByTestId("automation");
  await expect(auto.getByTestId("heatmap")).toBeVisible();
  await expect(auto.getByTestId("heat-cell").first()).toBeVisible();
  const cards = auto.getByTestId("case-card");
  const total = await cards.count();
  expect(total).toBeGreaterThan(5);
  // Every card cites the source text behind its approach (or says why it cannot).
  await expect(auto.locator('[data-id="TRE-08"] mark.cite-test')).toHaveText("reconciles");

  // Assumptions drive the numbers.
  const hours = page.getByTestId("total-hours");
  const before = await hours.textContent();
  await page.getByTestId("assume-min-daily").fill("60");
  await expect(hours).not.toHaveText(before!);
  const changed = await hours.textContent();
  // Survives a reload (localStorage), then reset restores the defaults.
  await page.reload();
  await page.getByTestId("view-automation").click();
  await expect(page.getByTestId("assume-min-daily")).toHaveValue("60");
  await expect(hours).toHaveText(changed!);
  await page.getByTestId("reset-assumptions").click();
  await expect(hours).toHaveText(before!);

  // Threshold 5 leaves only score-5 candidates; a cell filters the list.
  await page.getByTestId("assume-threshold").selectOption("5");
  await expect(cards).toHaveCount(0);
  await page.getByTestId("assume-threshold").selectOption("4");
  await expect(cards).toHaveCount(total);
  await auto.locator('[data-cell="Treasury|Detective"]').click();
  await expect(cards.first()).toContainText("Treasury");

  // Card ID opens the control in the review drawer.
  await cards.first().getByRole("button").first().click();
  await expect(page.getByTestId("drawer")).toBeVisible();
});
