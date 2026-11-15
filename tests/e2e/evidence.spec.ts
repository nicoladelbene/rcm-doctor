import { expect, test } from "@playwright/test";

test("evidence: demo tick & tie shows exceptions with boxes and the source span", async ({ page }) => {
  await page.goto("/?demo");
  await expect(page.getByTestId("evidence-summary")).toContainText("5 controls tested");

  await page.getByTestId("open-evidence-TRE-01").click();
  const ev = page.getByTestId("evidence");
  await expect(ev.getByTestId("evidence-conclusion")).toContainText("Exceptions noted");
  await expect(ev.getByTestId("cell-BAR-2026-03-C")).toHaveAttribute("data-result", "exception");
  // The exception is selected by default: its box is on the PDF page and its attribute is highlighted in the description.
  await expect(ev.getByTestId("tick-detail")).toContainText("18.06.2026");
  await expect(ev.getByTestId("evidence-box")).toBeVisible();
  await expect(ev.getByTestId("tick-detail").locator("mark")).toContainText("Within 2 business days");

  // A tick on another item moves the box.
  await ev.getByTestId("cell-BAR-2026-01-B").click();
  await expect(ev.getByTestId("tick-detail")).toContainText("Tick");
  await expect(ev.getByTestId("evidence-box").first()).toBeVisible();

  // CSV evidence: the exception cell is outlined.
  await page.keyboard.press("Escape");
  await page.getByTestId("open-evidence-R2R-01").click();
  await expect(page.getByTestId("tick-matrix").locator('[data-result="exception"]')).toHaveCount(2);
  await expect(page.getByTestId("evidence-csv").locator("td.outline", { hasText: "1,412,500.00" })).toBeVisible();
});

test("evidence: upload without a key reads PDF and CSV in the browser", async ({ page }) => {
  await page.goto("/?demo");
  await page.locator('[data-id="P2P-05"]').click();
  await page.getByTestId("tab-evidence").click();
  await page.getByTestId("evidence-files").setInputFiles(["public/demo-evidence/TRE-01/bank-account-requests-2026.pdf", "public/demo-evidence/ITG-05/FF-session-review-2026-05.csv"]);
  await page.getByTestId("evidence-run").click();
  const ev = page.getByTestId("evidence");
  await expect(ev.getByText("The PDF's own text layer — boxes exact")).toBeVisible({ timeout: 20_000 });
  await expect(ev.getByTestId("evidence-pages").locator("img")).toBeVisible();
  await expect(ev.getByTestId("evidence-conclusion")).toContainText("Incomplete");
});

test("api: evidence route enforces the key and validates the body", async ({ request }) => {
  expect((await request.post("/api/evidence", { data: {} })).status()).toBe(401);
  const bad = await request.post("/api/evidence", { data: { pack: {} }, headers: { "x-openrouter-key": "sk-or-v1-aaaaaaaaaaaaaaaaaaaaaaaa" } });
  expect(bad.status()).toBe(400);
});
