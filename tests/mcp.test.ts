import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Starts the bundled MCP server exactly as a client would (node mcp/dist/rcm-doctor-mcp.mjs, stdio),
 * from an unrelated working directory and without an API key, then calls both tools on the demo RCM.
 * CI rebuilds the bundle and fails if it differs from the committed one.
 */
const ROOT = resolve(__dirname, "..");
let client: Client;

beforeAll(async () => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k, v]) => v !== undefined && k !== "OPENROUTER_API_KEY")) as Record<string, string>;
  const transport = new StdioClientTransport({ command: process.execPath, args: [join(ROOT, "mcp/dist/rcm-doctor-mcp.mjs")], cwd: tmpdir(), env, stderr: "ignore" });
  client = new Client({ name: "rcm-doctor-test", version: "0.0.0" });
  await client.connect(transport);
}, 20_000);
afterAll(async () => client?.close());

type ToolResult = { content: { type: string; text: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean };
const call = (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args }) as Promise<ToolResult>;

describe("rcm-doctor MCP server (stdio)", () => {
  it("lists the two tools with input schemas", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["generate_test_scripts", "review_rcm"]);
    expect(Object.keys(tools[0].inputSchema.properties ?? {})).toEqual(expect.arrayContaining(["source", "path", "csv", "control_ids"]));
  });

  it("review_rcm on the demo RCM returns the precomputed review with cited spans", async () => {
    const r = await call("review_rcm", { source: "demo" });
    expect(r.isError).toBeFalsy();
    const s = r.structuredContent as { summary: { total: number; fail: number }; reviews: { control_id: string; findings: { check: string; cited_text: string | null }[] }[] };
    expect(s.summary.total).toBe(40);
    const tre03 = s.reviews.find((x) => x.control_id === "TRE-03")!;
    expect(tre03.findings.find((f) => f.check === "sod_conflict")?.cited_text).toBe("prepares and approves");
    expect(r.content[0].text).toContain("## TRE-03 — FAIL");
    expect(r.content[0].text).toContain("“prepares and approves”");
  });

  it("review_rcm on a file path without a key runs the deterministic rules", async () => {
    const r = await call("review_rcm", { path: join(ROOT, "data/demo-rcm.csv"), control_ids: ["P2P-03", "TRE-03"] });
    const s = r.structuredContent as { mode: string; reviews: { control_id: string; status: string; findings: { check: string }[] }[] };
    expect(s.mode).toBe("rules-only");
    expect(s.reviews.map((x) => x.control_id).sort()).toEqual(["P2P-03", "TRE-03"]);
    expect(s.reviews.find((x) => x.control_id === "P2P-03")!.findings.map((f) => f.check)).toContain("key_no_evidence");
    expect(s.reviews.find((x) => x.control_id === "TRE-03")!.findings.map((f) => f.check)).toContain("sod_conflict");
  });

  it("review_rcm accepts pasted CSV", async () => {
    const csv = "Control ID,Control Description,Control Owner,Frequency,Nature,Key Control\nX-1,The Treasurer prepares and approves payments above CHF 5000 in e-banking.,Treasurer,Daily,Manual,Y";
    const r = await call("review_rcm", { csv });
    expect((r.structuredContent as { reviews: { findings: { check: string }[] }[] }).reviews[0].findings.map((f) => f.check)).toContain("sod_conflict");
  });

  it("generate_test_scripts on the demo returns sample sizes, traced attributes and blockers", async () => {
    const r = await call("generate_test_scripts", { source: "demo", control_ids: ["P2P-05", "TRE-03"] });
    const s = r.structuredContent as { scripts: { control_id: string; toe_ready: boolean; sample: { size: number }; attributes: { span: { text: string } | null }[] }[] };
    const p = s.scripts.find((x) => x.control_id === "P2P-05")!;
    expect(p.toe_ready).toBe(true);
    expect(p.sample.size).toBe(2);
    expect(p.attributes.some((a) => a.span)).toBe(true);
    expect(s.scripts.find((x) => x.control_id === "TRE-03")!.toe_ready).toBe(false);
    expect(r.content[0].text).toContain("BLOCKED: remediate the design first");
  });

  it("returns a tool error (not a crash) for bad input", async () => {
    const r = await call("review_rcm", { path: "/nope/rcm.pdf" });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/Unsupported file type/);
  });
});
