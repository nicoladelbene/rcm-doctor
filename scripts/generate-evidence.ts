/**
 * Renders the synthetic demo evidence (scripts/evidence-demo-data.ts) with Playwright:
 *   PDFs + page images + an exact text layer (DOM boxes) · screenshots · CSVs.
 * Writes public/demo-evidence/<control>/…, data/evidence/packs.json and data/evidence/ground-truth.json.
 *   npm run gen:evidence
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { csvToFile, EvidencePackSchema, type EvidenceFile, type EvidenceGroundTruth, type EvidencePack, type Token } from "../src/core/evidence";
import { CSS, DEMO_EVIDENCE } from "./evidence-demo-data";

const PUB = join(process.cwd(), "public/demo-evidence");
const DATA = join(process.cwd(), "data/evidence");
rmSync(PUB, { recursive: true, force: true });
mkdirSync(PUB, { recursive: true });
mkdirSync(DATA, { recursive: true });

const csvCell = (c: string) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);

const browser = await chromium.launch();
const packs: EvidencePack[] = [];
const truth: EvidenceGroundTruth = {};

for (const ev of DEMO_EVIDENCE) {
  const dir = join(PUB, ev.control_id);
  mkdirSync(dir, { recursive: true });
  const files: EvidenceFile[] = [];

  for (const [fi, doc] of ev.docs.entries()) {
    const file_id = `F${fi + 1}`;
    const url = `/demo-evidence/${ev.control_id}/${doc.name}`;
    if (doc.kind === "csv") {
      const csv = doc.rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
      writeFileSync(join(dir, doc.name), csv);
      files.push(csvToFile(file_id, doc.name, csv, url));
      continue;
    }
    const isPdf = doc.kind === "pdf";
    const W = isPdf ? 794 : 1280;
    const H = isPdf ? 1123 : 720;
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: isPdf ? 1.5 : 1.25 });
    const body = doc.pages.map((p) => (isPdf ? `<section class="page">${p}</section>` : `<section class="shot">${p}</section>`)).join("");
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS} @page { size: ${W}px ${H}px; margin: 0; }</style></head><body>${body}</body></html>`);
    // Text layer: every leaf element with text, boxes normalised to its page.
    const raw = await page.evaluate(() => {
      const out: { text: string; page: number; box: [number, number, number, number] }[] = [];
      document.querySelectorAll("section").forEach((sec, pi) => {
        const pr = sec.getBoundingClientRect();
        sec.querySelectorAll("*").forEach((el) => {
          if (el.children.length || !el.textContent?.trim()) return;
          const r = el.getBoundingClientRect();
          // Tight box around the text itself, not the cell.
          const range = document.createRange();
          range.selectNodeContents(el);
          const t = range.getBoundingClientRect();
          const b = t.width ? t : r;
          out.push({ text: el.textContent.trim().replace(/\s+/g, " "), page: pi, box: [(b.x - pr.x) / pr.width, (b.y - pr.y) / pr.height, b.width / pr.width, b.height / pr.height] });
        });
      });
      return out;
    });
    const tokens: Token[] = raw.map((t, i) => ({ id: `${file_id}-t${i + 1}`, text: t.text, page: t.page, box: t.box.map((v) => Math.round(v * 10000) / 10000) as Token["box"] & {}, cell: null }));
    const pages: EvidenceFile["pages"] = [];
    const secs = page.locator("section");
    for (let p = 0; p < doc.pages.length; p++) {
      const img = isPdf ? doc.name.replace(/\.pdf$/, `.p${p + 1}.png`) : doc.name;
      await secs.nth(p).screenshot({ path: join(dir, img) });
      pages.push({ image: `/demo-evidence/${ev.control_id}/${img}`, aspect: H / W });
    }
    if (isPdf) await page.pdf({ path: join(dir, doc.name), width: `${W}px`, height: `${H}px`, printBackground: true, margin: { top: "0", bottom: "0", left: "0", right: "0" } });
    await page.close();
    files.push({ file_id, name: doc.name, kind: doc.kind, src: url, pages, tokens, layer: "generator" });
  }

  const pack = EvidencePackSchema.parse({ control_id: ev.control_id, samples: ev.samples, files });
  packs.push(pack);
  truth[ev.control_id] = {
    samples: ev.samples,
    exceptions: ev.exceptions.map((x) => {
      const f = files[x.file];
      const tokens = f.tokens.filter((t) => x.find.includes(t.text)).map((t) => t.id);
      // CSV: restrict to the sample's row; PDF: to the sample's page.
      const row = f.kind === "csv" ? f.tokens.find((t) => t.text === x.sample_id)?.cell?.[0] : undefined;
      const pageNo = f.kind === "pdf" ? f.tokens.find((t) => t.text === x.sample_id)?.page : undefined;
      const scoped = f.tokens.filter((t) => tokens.includes(t.id) && (row === undefined || t.cell?.[0] === row) && (pageNo === undefined || t.page === pageNo)).map((t) => t.id);
      if (!scoped.length) throw new Error(`ground truth tokens not found for ${ev.control_id} ${x.sample_id}`);
      return { sample_id: x.sample_id, attribute_id: x.attribute_id, tokens: scoped, why: x.why };
    }),
  };
  console.log(`${ev.control_id}: ${files.length} files, ${files.reduce((n, f) => n + f.tokens.length, 0)} tokens, ${ev.samples.length} samples, ${ev.exceptions.length} planted exceptions`);
}
await browser.close();

writeFileSync(join(DATA, "packs.json"), JSON.stringify(packs, null, 1) + "\n");
writeFileSync(join(DATA, "ground-truth.json"), JSON.stringify(truth, null, 2) + "\n");
console.log("wrote data/evidence/packs.json, data/evidence/ground-truth.json, public/demo-evidence/");
