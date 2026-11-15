/**
 * Records the ~15 s demo flow at 1280×800 and converts it to docs/media/demo.mp4 + demo.gif,
 * and captures docs/media/screenshot.png (drawer view). Needs ffmpeg on PATH.
 *   npm run build && (PORT=3100 npm start &) && npm run record:demo
 *   RECORD_URL=https://<deployment> npm run record:demo   # record against production
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";

const BASE = process.env.RECORD_URL ?? "http://localhost:3100";
/** RECORD_FLOW=testscript records the Week 2 flow into docs/media/week-2-*. */
const FLOW = process.env.RECORD_FLOW ?? "review";
/** RECORD_FLOW=automation records the Week 4 flow into docs/media/week-4-*. */
const PREFIX = FLOW === "testscript" ? "week-2-" : FLOW === "automation" ? "week-4-" : "";
const OUT = join(process.cwd(), "docs/media");
const W = 1280;
const H = 800;
mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), "rcm-rec-"));

// A visible cursor, since headless video has none.
const CURSOR = `
  addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div');
    c.id = '__cursor';
    c.style.cssText = 'position:fixed;left:0;top:0;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(29,79,122,.35);border:2px solid rgba(29,79,122,.9);z-index:2147483647;pointer-events:none;transition:transform .12s ease, background .12s;transform:translate(640px,400px)';
    document.body.appendChild(c);
    addEventListener('mousemove', e => { c.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; }, true);
    addEventListener('mousedown', () => { c.style.background = 'rgba(29,79,122,.75)'; }, true);
    addEventListener('mouseup', () => { c.style.background = 'rgba(29,79,122,.35)'; }, true);
  });`;

async function moveTo(page: Page, selector: string, steps = 18) {
  await page.locator(selector).first().scrollIntoViewIfNeeded();
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps });
}
async function glideClick(page: Page, selector: string, pause = 250) {
  await moveTo(page, selector);
  await page.waitForTimeout(pause);
  await page.mouse.down();
  await page.mouse.up();
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: tmp, size: { width: W, height: H } }, acceptDownloads: true });
await ctx.addInitScript(CURSOR);
const page = await ctx.newPage();

await page.goto(BASE);
await page.waitForLoadState("networkidle");
await page.mouse.move(520, 420);
await page.waitForTimeout(1300);

// 1) Try the demo
await glideClick(page, '[data-testid="try-demo"]');
await page.getByTestId("results").waitFor();
await page.waitForTimeout(FLOW === "testscript" ? 1600 : 2400); // summary animates
const drawer = page.getByTestId("drawer");

if (FLOW === "automation") {
  // 2) Switch to the heatmap
  await glideClick(page, '[data-testid="view-automation"]', 300);
  await page.getByTestId("heatmap").waitFor();
  await page.evaluate(() => document.querySelector('[data-testid="results"]')?.scrollIntoView({ behavior: "smooth", block: "start" }));
  await page.waitForTimeout(1800);
  for (const cell of ["Procure-to-Pay|Preventive", "Treasury|Detective", "Order-to-Cash|Detective"]) {
    await moveTo(page, `[data-cell="${cell}"]`, 14);
    await page.waitForTimeout(500);
  }
  // 3) Change an assumption: daily controls take 60 minutes, not 30 — everything recalculates
  await glideClick(page, '[data-testid="assume-min-daily"]', 250);
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("60", { delay: 180 });
  await moveTo(page, '[data-testid="total-hours"]', 16);
  await page.waitForTimeout(1600);
  await glideClick(page, '[data-testid="reset-assumptions"]', 250);
  await page.waitForTimeout(900);
  // 4) Drill into a cell: Treasury detective controls and their business cases
  await glideClick(page, '[data-cell="Treasury|Detective"]', 300);
  await page.waitForTimeout(500);
  await page.locator('[data-testid="case-card"]').first().evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "center" }));
  await page.waitForTimeout(1200);
  await moveTo(page, '[data-testid="case-card"] mark.cite-test >> nth=0', 16);
  await page.waitForTimeout(1300);
  await moveTo(page, '[data-testid="case-card"] [data-testid="case-math"] >> nth=0', 16);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, `${PREFIX}screenshot-case.png`) });
} else if (FLOW === "testscript") {
  // 2) A clean monthly control: sample size + traced attributes
  await glideClick(page, '[data-id="P2P-05"]', 300);
  await drawer.waitFor();
  await page.waitForTimeout(700);
  await glideClick(page, '[data-testid="tab-test"]', 250);
  await page.getByTestId("testscript").waitFor();
  await page.waitForTimeout(1600);
  for (const n of [0, 1, 2]) {
    await moveTo(page, `[data-testid="testscript"] tbody tr >> nth=${n}`, 12);
    await page.waitForTimeout(650);
  }
  for (let y = 0; y <= 520; y += 40) {
    await drawer.evaluate((el, top) => el.scrollTo({ top }), y);
    await page.waitForTimeout(28);
  }
  await page.waitForTimeout(1600);
  await page.screenshot({ path: join(OUT, `${PREFIX}screenshot-attributes.png`) });
  // 3) A control with an SoD conflict is blocked
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await glideClick(page, '[data-id="TRE-03"]', 300);
  await drawer.waitFor();
  await page.waitForTimeout(2200);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
} else {
  // 2) Open a failing control
  await glideClick(page, '[data-id="TRE-03"]', 350);
  await drawer.waitFor();
  await page.waitForTimeout(900);
  await moveTo(page, 'mark.cite-fail >> nth=0', 20);
  await page.waitForTimeout(1200);
  await moveTo(page, '[data-testid="drawer"] li >> nth=0', 16);
  await page.waitForTimeout(1300);

  // 3) Scroll to the rewrite
  for (let y = 0; y <= 760; y += 40) {
    await drawer.evaluate((el, top) => el.scrollTo({ top }), y);
    await page.waitForTimeout(28);
  }
  await page.waitForTimeout(2200);
  await page.screenshot({ path: join(OUT, "screenshot-rewrite.png") });

  // 4) Close
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
}

// Export
await page.evaluate(() => document.querySelector('[data-testid="results"]')?.scrollIntoView({ behavior: "smooth", block: "start" }));
await page.waitForTimeout(700);
const dl = page.waitForEvent("download");
await glideClick(page, '[data-testid="download-report"]', 300);
await dl;
await page.waitForTimeout(2200);

const videoPath = await page.video()!.path();
await ctx.close();

// Hi-DPI still of the drawer for README / social preview
const still = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const sp = await still.newPage();
await sp.goto(`${BASE}/?demo${FLOW === "automation" ? "&view=automation" : ""}`);
await sp.getByTestId("results").waitFor();
await sp.waitForTimeout(1500);
if (FLOW === "automation") {
  await sp.evaluate(() => document.querySelector('[data-testid="results"]')?.scrollIntoView({ block: "start" }));
  await sp.waitForTimeout(400);
  await sp.screenshot({ path: join(OUT, `${PREFIX}screenshot.png`) });
  await still.close();
  await browser.close();
} else {
await sp.locator(`[data-id="${FLOW === "testscript" ? "P2P-05" : "TRE-03"}"]`).click();
await sp.getByTestId("drawer").waitFor();
if (FLOW === "testscript") await sp.getByTestId("tab-test").click();
await sp.waitForTimeout(600);
await sp.screenshot({ path: join(OUT, `${PREFIX}screenshot.png`) });
await sp.getByTestId("drawer").evaluate((el) => el.scrollTo({ top: 0 }));
await sp.keyboard.press("Escape");
await sp.waitForTimeout(400);
await sp.screenshot({ path: join(OUT, `${PREFIX}screenshot-results.png`) });
await still.close();
await browser.close();
}

const webm = join(OUT, `${PREFIX}demo.webm`);
renameSync(videoPath, webm);
const ff = (args: string[]) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
ff(["-i", webm, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "slow", "-movflags", "+faststart", "-r", "30", join(OUT, `${PREFIX}demo.mp4`)]);
const palette = join(tmp, "palette.png");
const vf = FLOW !== "review" ? "fps=8,scale=900:-1:flags=lanczos" : "fps=10,scale=960:-1:flags=lanczos"; // keeps GIFs under 8 MB
ff(["-i", webm, "-vf", `${vf},palettegen=max_colors=128:stats_mode=diff`, palette]);
ff(["-i", webm, "-i", palette, "-lavfi", `${vf} [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`, join(OUT, `${PREFIX}demo.gif`)]);
rmSync(webm);
rmSync(tmp, { recursive: true, force: true });

for (const f of readdirSync(OUT)) console.log(`${f.padEnd(26)} ${(statSync(join(OUT, f)).size / 1024 / 1024).toFixed(2)} MB`);
