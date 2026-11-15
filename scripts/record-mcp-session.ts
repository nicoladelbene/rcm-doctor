/**
 * Week 5 video: replays a REAL Claude Code session (docs/media/week-5-session.json, captured with `claude -p`
 * + the rcm-doctor MCP server and skill) in a terminal-style page, and records it to docs/media/week-5-demo.{mp4,gif}.
 * The replay is sped up; text and tool calls are exactly those of the session. Needs ffmpeg on PATH.
 *   npm run record:mcp
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const OUT = join(process.cwd(), "docs/media");
const session = JSON.parse(readFileSync(join(OUT, "week-5-session.json"), "utf8")) as {
  prompt: string;
  duration_s: number;
  steps: { tool: string; input: Record<string, unknown>; summary?: string }[];
  answer: string;
};
const W = 1280;
const H = 800;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s: string) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\*"(.+?)"\*/g, '<span class="q">“$1”</span>')
    .replace(/\*(.+?)\*/g, "<i>$1</i>")
    .replace(/`(.+?)`/g, "<code>$1</code>");

/** Minimal Markdown → HTML for the answer (headings, tables, lists, quotes, paragraphs). */
function md(src: string): string[] {
  const blocks: string[] = [];
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim()) continue;
    if (l.startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(lines[i++]);
      i--;
      const cells = (r: string) => r.split("|").slice(1, -1).map((c) => c.trim());
      const body = rows.filter((r) => !/^\|[\s|:-]+\|$/.test(r));
      blocks.push(`<table>${body.map((r, k) => `<tr>${cells(r).map((c) => (k ? `<td>${inline(c)}</td>` : `<th>${inline(c)}</th>`)).join("")}</tr>`).join("")}</table>`);
    } else if (/^#{1,3} /.test(l)) blocks.push(`<h3>${inline(l.replace(/^#+ /, ""))}</h3>`);
    else if (l.startsWith("> ")) blocks.push(`<blockquote>${inline(l.slice(2))}</blockquote>`);
    else if (/^(-|\d+\.) /.test(l)) blocks.push(`<div class="li">• ${inline(l.replace(/^(-|\d+\.) /, ""))}</div>`);
    else blocks.push(`<p>${inline(l)}</p>`);
  }
  return blocks;
}

const toolLine = (s: (typeof session.steps)[number]) => {
  const name = s.tool.replace("mcp__rcm-doctor__", "rcm-doctor · ");
  const args = Object.entries(s.input).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ");
  return `<div class="tool"><span class="dot">⏺</span> <b>${esc(name)}</b>(${esc(args)})${s.summary ? `<div class="res">⎿ ${esc(s.summary)}</div>` : ""}</div>`;
};

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
:root{--bg:#14161a;--fg:#e6e3da;--mut:#8a8f98;--acc:#d8a25a;--blue:#7fb0e0;--rule:#2a2e35}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}
.bar{height:34px;background:#1d2026;border-bottom:1px solid var(--rule);display:flex;align-items:center;padding:0 14px;gap:8px;color:var(--mut);font-size:12.5px}
.bar i{width:11px;height:11px;border-radius:50%;background:#3a3e46;display:inline-block}
.cap{margin-left:auto}
#log{height:${H - 34}px;overflow:hidden;padding:22px 34px 60px}
.user{color:var(--fg);margin:0 0 18px}.user .p{color:var(--acc)}
.tool{margin:8px 0;color:var(--fg)}.dot{color:#6fbf73}.res{color:var(--mut);margin-left:22px}
.ans{margin-top:16px;font-family:-apple-system,BlinkMacSystemFont,Inter,sans-serif;font-size:15.5px}
h3{font-size:17px;margin:16px 0 6px;color:#fff}p{margin:6px 0}.li{margin:3px 0 3px 8px}
b{color:#fff}.q{color:var(--acc)}code{color:var(--blue)}
table{border-collapse:collapse;margin:8px 0;font-size:14px}td,th{border:1px solid var(--rule);padding:4px 10px;text-align:left}th{color:var(--mut);font-weight:600}
blockquote{border-left:3px solid var(--acc);margin:8px 0;padding:4px 12px;color:#d6d2c7}
.hide{display:none}.cursor::after{content:"▋";color:var(--acc);animation:b 1s steps(1) infinite}@keyframes b{50%{opacity:0}}
</style></head><body>
<div class="bar"><i></i><i></i><i></i><span>~/my-project — claude</span><span class="cap">real Claude Code session (${session.duration_s} s), sped up</span></div>
<div id="log">
<div class="user"><span class="p">&gt;</span> <span id="prompt" class="cursor"></span></div>
${session.steps.map((s, i) => `<div class="hide step" data-i="${i}">${toolLine(s)}</div>`).join("")}
<div class="ans">${md(session.answer).map((b) => `<div class="hide blk">${b}</div>`).join("")}</div>
</div></body></html>`;

const tmp = mkdtempSync(join(tmpdir(), "rcm-mcp-rec-"));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: tmp, size: { width: W, height: H } } });
const page = await ctx.newPage();
await page.setContent(html);
await page.waitForTimeout(600);
// Plain string script: tsx would inject helpers (__name) into a function passed to evaluate.
await page.evaluate(`(async (prompt) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const el = document.getElementById("prompt");
  for (const ch of prompt) { el.textContent += ch; await sleep(38); }
  await sleep(700);
  el.classList.remove("cursor");
  const log = document.getElementById("log");
  const follow = () => log.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  for (const s of document.querySelectorAll(".step")) { s.classList.remove("hide"); follow(); await sleep(1100); }
  await sleep(900);
  for (const b of document.querySelectorAll(".blk")) { b.classList.remove("hide"); follow(); await sleep(Math.min(1500, 260 + b.textContent.length * 4.5)); }
  await sleep(2500);
})(${JSON.stringify(session.prompt)})`);
const video = await page.video()!.path();
await ctx.close();
await browser.close();

const webm = join(OUT, "week-5-demo.webm");
renameSync(video, webm);
const ff = (args: string[]) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
ff(["-i", webm, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "slow", "-movflags", "+faststart", "-r", "30", join(OUT, "week-5-demo.mp4")]);
const palette = join(tmp, "palette.png");
const vf = "fps=6,scale=800:-1:flags=lanczos"; // keeps the GIF under ~8 MB
ff(["-i", webm, "-vf", `${vf},palettegen=max_colors=64:stats_mode=diff`, palette]);
ff(["-i", webm, "-i", palette, "-lavfi", `${vf} [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`, join(OUT, "week-5-demo.gif")]);
rmSync(webm);
rmSync(tmp, { recursive: true, force: true });
for (const f of ["week-5-demo.mp4", "week-5-demo.gif"]) console.log(`${f.padEnd(20)} ${(statSync(join(OUT, f)).size / 1024 / 1024).toFixed(2)} MB`);
