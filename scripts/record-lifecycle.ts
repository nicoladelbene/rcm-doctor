/**
 * Launch video: the full control lifecycle in ~35 s — RCM → cited finding → test script → tick & tie with an
 * exception → automation heatmap. Two formats: 16:9 (README) and 4:5 1080×1350 (LinkedIn feed, phone).
 *   RECORD_URL=https://<preview> [RECORD_SHARE=<url with _vercel_share>] npm run record:lifecycle
 * RECORD_SHARE is opened first so the Vercel protection cookie is set; it is never written to the output.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, renameSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";

const BASE = (process.env.RECORD_URL ?? "http://localhost:3400").replace(/\/$/, "");
const OUT = join(process.cwd(), "docs/media");

const CURSOR = `
  addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div');
    c.style.cssText = 'position:fixed;left:0;top:0;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(29,79,122,.35);border:2px solid rgba(29,79,122,.9);z-index:2147483647;pointer-events:none;transition:background .12s';
    document.body.appendChild(c);
    addEventListener('mousemove', e => { c.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; }, true);
    addEventListener('mousedown', () => { c.style.background = 'rgba(29,79,122,.75)'; }, true);
    addEventListener('mouseup', () => { c.style.background = 'rgba(29,79,122,.35)'; }, true);
  });`;

async function moveTo(page: Page, sel: string, steps = 16) {
  const l = page.locator(sel).first();
  await l.scrollIntoViewIfNeeded();
  const b = await l.boundingBox();
  if (!b) throw new Error(`no box for ${sel}`);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps });
}
async function click(page: Page, sel: string, pause = 220) {
  await moveTo(page, sel);
  await page.waitForTimeout(pause);
  await page.mouse.down();
  await page.mouse.up();
}
/** A caption bar so the story reads without sound. */
async function caption(page: Page, text: string) {
  await page.evaluate((t) => {
    let el = document.getElementById("__cap");
    if (!el) {
      el = document.createElement("div");
      el.id = "__cap";
      el.style.cssText = "position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483646;background:#16191d;color:#f7f6f2;font:600 17px Inter,system-ui,sans-serif;padding:9px 18px;border-radius:8px;box-shadow:0 4px 18px rgba(0,0,0,.25);max-width:92vw;text-align:center";
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
}

async function record(name: string, viewport: { width: number; height: number }, size: { width: number; height: number }) {
  const tmp = mkdtempSync(join(tmpdir(), "rcm-life-"));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: size.width / viewport.width, recordVideo: { dir: tmp, size } });
  await ctx.addInitScript(CURSOR);
  const page = await ctx.newPage();
  if (process.env.RECORD_SHARE) await page.goto(process.env.RECORD_SHARE);
  const drawer = page.getByTestId("drawer");

  await page.goto(`${BASE}/`);
  await page.waitForLoadState("networkidle");
  await caption(page, "1 · Review: an RCM with 40 controls");
  await page.waitForTimeout(2000);
  await click(page, '[data-testid="try-demo"]');
  await page.getByTestId("result-row").first().waitFor();
  await page.waitForTimeout(1600);

  await click(page, '[data-id="TRE-03"]');
  await drawer.waitFor();
  await caption(page, "Every finding cites the exact words behind it");
  await moveTo(page, '[data-testid="drawer"] mark.cite-fail', 18);
  await page.waitForTimeout(3400);

  await caption(page, "2 · Test: sample size + attributes traced to the text");
  await page.keyboard.press("Escape");
  await click(page, '[data-id="P2P-05"]');
  await drawer.waitFor();
  await click(page, '[data-testid="tab-test"]');
  await page.getByTestId("testscript").waitFor();
  await moveTo(page, '[data-testid="sample-size"]', 14);
  await page.waitForTimeout(1800);
  await moveTo(page, '[data-testid="testscript"] mark.cite-test', 14);
  await page.waitForTimeout(2400);

  await caption(page, "3 · Evidence: tick & tie — and the exception");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await click(page, '[data-testid="open-evidence-TRE-01"]');
  await page.getByTestId("evidence").waitFor();
  await page.waitForTimeout(800);
  await click(page, '[data-testid="cell-BAR-2026-03-C"]');
  await page.waitForTimeout(900);
  await moveTo(page, '[data-testid="evidence-box"]', 18);
  await page.waitForTimeout(3400);

  await caption(page, "4 · Automate: which controls should a robot do?");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await click(page, '[data-testid="view-automation"]');
  await page.getByTestId("heatmap").waitFor();
  await page.getByTestId("automation").evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "start" }));
  await page.waitForTimeout(1500);
  await moveTo(page, '[data-cell="Treasury|Detective"]', 14);
  await page.waitForTimeout(500);
  await click(page, '[data-cell="Treasury|Detective"]');
  await page.locator('[data-testid="case-card"]').first().evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "center" }));
  await page.waitForTimeout(1000);
  await moveTo(page, '[data-testid="case-card"] [data-testid="hours-saved"]', 14);
  await caption(page, "rcm-doctor · open source · also inside Claude via MCP");
  await page.waitForTimeout(4500);

  const video = await page.video()!.path();
  await ctx.close();
  await browser.close();
  const webm = join(OUT, `${name}.webm`);
  renameSync(video, webm);
  const ff = (args: string[]) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
  ff(["-i", webm, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "21", "-preset", "slow", "-movflags", "+faststart", "-r", "30", join(OUT, `${name}.mp4`)]);
  rmSync(webm);
  rmSync(tmp, { recursive: true, force: true });
  console.log(`${name}.mp4 ${(statSync(join(OUT, `${name}.mp4`)).size / 1024 / 1024).toFixed(2)} MB`);
}

const which = process.env.RECORD_FORMAT ?? "both";
if (which !== "4x5") await record("launch-lifecycle-16x9", { width: 1280, height: 720 }, { width: 1280, height: 720 });
if (which !== "16x9") await record("launch-lifecycle-4x5", { width: 540, height: 675 }, { width: 1080, height: 1350 });
// GIF for the README from the 16:9 cut
if (which !== "4x5") {
  const src = join(OUT, "launch-lifecycle-16x9.mp4");
  const pal = join(tmpdir(), "rcm-life-pal.png");
  const vf = "fps=7,scale=860:-1:flags=lanczos";
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-vf", `${vf},palettegen=max_colors=96:stats_mode=diff`, pal]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-i", pal, "-lavfi", `${vf} [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`, join(OUT, "launch-lifecycle.gif")]);
  console.log(`launch-lifecycle.gif ${(statSync(join(OUT, "launch-lifecycle.gif")).size / 1024 / 1024).toFixed(2)} MB`);
}
