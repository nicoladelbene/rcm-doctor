import { randomBytes } from "node:crypto";
import { deflateSync } from "node:zlib";
import { expect, test } from "@playwright/test";

function noisyPng(w: number, h: number): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc((w * 3 + 1) * h);
  const noise = randomBytes(w * 3 * h);
  for (let y = 0; y < h; y++) noise.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 1 })), chunk("IEND", Buffer.alloc(0))]);
}

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

test("evidence: a large screenshot is resized and compressed in the browser before upload", async ({ page }) => {
  await page.goto("/?demo");
  await expect(page.getByTestId("evidence-summary")).toBeVisible();
  // A 3000×2200 noisy PNG (~20 MB, incompressible), written in Node.
  const png = noisyPng(3000, 2200);
  expect(png.length).toBeGreaterThan(5_000_000);
  let sent: { bytes: number; image: string } | null = null;
  await page.route("**/api/evidence", async (route) => {
    const body = route.request().postData() ?? "";
    const pack = JSON.parse(body).pack;
    sent = { bytes: Buffer.byteLength(body), image: pack.files[0].pages[0].image };
    await route.fulfill({ status: 502, json: { error: "stubbed" } });
  });
  await page.locator('[data-id="ITG-06"]').click();
  await page.getByTestId("tab-evidence").click();
  await page.getByTestId("evidence-files").setInputFiles({ name: "big.png", mimeType: "image/png", buffer: png });
  await page.getByTestId("evidence-upload").locator('input[type="password"]').fill("sk-or-v1-aaaaaaaaaaaaaaaaaaaaaaaa");
  await page.getByTestId("evidence-run").click();
  await expect(page.getByTestId("evidence-upload")).toContainText("stubbed", { timeout: 30_000 });
  expect(sent).not.toBeNull();
  expect(sent!.bytes).toBeLessThan(3_500_000);
  expect(sent!.image).toMatch(/^data:image\/(webp|jpeg);base64,/);
  const dims = await page.evaluate(async (src) => {
    const i = new Image();
    i.src = src;
    await i.decode();
    return [i.naturalWidth, i.naturalHeight];
  }, sent!.image);
  expect(Math.max(...dims)).toBeLessThanOrEqual(2000);
});
