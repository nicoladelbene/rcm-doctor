/**
 * Renders the Open Graph / GitHub social preview image (1280×640) to src/app/opengraph-image.png
 * (Next serves it as og:image) and docs/media/og-image.png (upload in GitHub → Settings → Social preview).
 *   npm run og
 */
import { copyFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Source+Serif+4:wght@600&family=JetBrains+Mono:wght@500&display=block" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0}body{width:1280px;height:640px;background:#f7f6f2;font-family:Inter,sans-serif;color:#16191d;display:grid;grid-template-columns:1.05fr 1fr;gap:48px;padding:64px 64px 56px}
.k{font:600 15px Inter;letter-spacing:.14em;text-transform:uppercase;color:#1d4f7a}
h1{font:600 66px/1.04 "Source Serif 4",serif;letter-spacing:-.01em;margin-top:18px}
.sub{margin-top:22px;font-size:22px;line-height:1.45;color:#3d434b;max-width:30ch}
.brand{position:absolute;left:64px;bottom:52px;display:flex;align-items:center;gap:12px;font:500 22px "JetBrains Mono",monospace}
.steps{position:absolute;left:64px;bottom:96px;font:500 16px Inter;color:#6b7079}
.card{align-self:center;background:#fff;border:1px solid #e2dfd6;border-radius:14px;padding:26px 28px;box-shadow:0 2px 0 #e2dfd6}
.meta{display:flex;justify-content:space-between;font:500 14px "JetBrains Mono",monospace;color:#6b7079}
.pill{font:600 13px Inter;color:#a3262a;background:#f8e4e3;border-radius:99px;padding:2px 10px}
.txt{margin-top:14px;font:600 21px/1.65 "Source Serif 4",serif;font-weight:500}
mark{background:#f8e4e3;color:#16191d;border-bottom:2px solid #a3262a;padding:0 2px}
mark.ok{background:#e5f0e8;border-color:#2e6b45}
ol{list-style:none;padding-left:0;margin-top:16px;border-top:1px solid #e2dfd6;padding-top:12px;font-size:16px;line-height:1.45}
li{display:grid;grid-template-columns:22px 1fr;margin-top:8px}li span{font:500 13px "JetBrains Mono";color:#a3262a;padding-top:2px}
li b{font-weight:600}
</style></head><body>
<div><div class="k">Internal controls · IKS · SOX</div>
<h1>Every finding cites the exact text behind it.</h1>
<p class="sub">Open-source AI reviewer for Risk &amp; Control Matrices — and inside Claude via MCP.</p></div>
<div class="steps">Review → Test → Evidence → Automate</div>
<div class="brand"><svg viewBox="0 0 24 24" width="30" height="30"><rect x="2.5" y="2.5" width="19" height="19" rx="3" fill="none" stroke="#16191d" stroke-width="1.6"/><path d="M2.5 9h19M9 9v12.5" stroke="#cbc6b8" stroke-width="1.2"/><path d="M11.5 15.2l2.3 2.3 4.4-5" fill="none" stroke="#1d4f7a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>rcm-doctor</div>
<div class="card"><div class="meta"><span>TRE-03 · Treasury / Payment release</span><span class="pill">× Fail</span></div>
<p class="txt">The <mark class="ok">Treasury Manager</mark> <mark>prepares and approves</mark> manual (urgent) payments <mark class="ok">above CHF 1,000</mark> outside the payment run in the e-banking portal.</p>
<ol><li><span>1</span><div><b>Segregation of duties.</b> The same role prepares and approves the payment.</div></li>
<li><span>2</span><div><b>When — timing.</b> No trigger: approval must occur before release to the bank.</div></li>
<li><span>3</span><div><b>Test script blocked.</b> Remediate the design before testing.</div></li></ol></div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 640 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const out = join(process.cwd(), "src/app/opengraph-image.png");
await page.screenshot({ path: out });
await browser.close();
copyFileSync(out, join(process.cwd(), "docs/media/og-image.png"));
console.log("wrote src/app/opengraph-image.png and docs/media/og-image.png");
