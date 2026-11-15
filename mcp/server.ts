#!/usr/bin/env node
/**
 * rcm-doctor MCP server (stdio). Exposes review_rcm and generate_test_scripts over src/core.
 *   npx rcm-doctor-mcp                 # from a clone, after npm ci (bundled: mcp/dist/rcm-doctor-mcp.mjs)
 *   npx tsx mcp/server.ts              # from source
 * Optional env: OPENROUTER_API_KEY (enables the AI step), RCM_DOCTOR_MODEL. The key is never logged or returned.
 * stdout is the protocol channel: diagnostics go to stderr only.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { generateTestScriptsTool, MAX_CONTROLS, reviewRcm, ToolInputError, type Env, type SourceArgs } from "./tools";

/** Repo root = nearest parent with the rcm-doctor package.json (works from mcp/ and mcp/dist/). */
function findRoot(): string {
  if (process.env.RCM_DOCTOR_ROOT) return process.env.RCM_DOCTOR_ROOT;
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const pkg = join(dir, "package.json");
    if (existsSync(pkg) && JSON.parse(readFileSync(pkg, "utf8")).name === "rcm-doctor") return dir;
    dir = dirname(dir);
  }
  return process.cwd();
}

const root = findRoot();
process.env.RCM_DOCTOR_ROOT = root; // prompts are loaded from <root>/src/core/prompts
const env: Env = {
  root,
  apiKey: process.env.OPENROUTER_API_KEY || undefined,
  model: process.env.RCM_DOCTOR_MODEL || undefined,
  cwd: process.cwd(),
};

const sourceShape = {
  source: z
    .enum(["demo", "file", "csv"])
    .optional()
    .describe('"demo" = the built-in synthetic RCM (40 controls, precomputed AI results, no key needed); "file" = an .xlsx/.xls/.csv path; "csv" = CSV text in `csv`. Default: file if path is given, csv if csv is given, else demo.'),
  path: z.string().optional().describe("Path to the RCM file (.xlsx, .xls or .csv). Absolute, or relative to the server's working directory."),
  csv: z.string().optional().describe("RCM as CSV text with a header row (Control ID, Process, Control Description, Control Owner, Frequency, Nature, Key Control, Evidence, …)."),
  control_ids: z.array(z.string()).optional().describe("Only these control IDs (e.g. [\"TRE-03\"])."),
  rules_only: z.boolean().optional().describe("Skip the AI step even if a key is configured."),
};

const server = new McpServer({ name: "rcm-doctor", version: "0.5.0" });

server.registerTool(
  "review_rcm",
  {
    title: "Review a Risk & Control Matrix",
    description:
      `Review internal controls in a Risk & Control Matrix (RCM / IKS / SOX). For each control: status (pass/weak/fail), findings on who/what/when/frequency/evidence/precision plus six deterministic consistency rules (frequency mismatch, nature mismatch, owner not a role, segregation of duties, risk link, key control without evidence), each citing the exact source text; automation score 0–5 and a suggested rewrite. Up to ${MAX_CONTROLS} controls. Use source="demo" to try it without a file.`,
    inputSchema: sourceShape,
    annotations: { readOnlyHint: true, openWorldHint: !!env.apiKey },
  },
  async (args) => run(() => reviewRcm(args as SourceArgs, env)),
);

server.registerTool(
  "generate_test_scripts",
  {
    title: "Generate audit test scripts",
    description:
      "Draft audit test scripts for the controls of an RCM: test of design (walkthrough steps) and test of operating effectiveness (sample size from the frequency, population, test attributes that each cite the phrase they test, exception definition). Controls with high-severity design findings are marked 'blocked: remediate the design first' instead of being tested.",
    inputSchema: sourceShape,
    annotations: { readOnlyHint: true, openWorldHint: !!env.apiKey },
  },
  async (args) => run(() => generateTestScriptsTool(args as SourceArgs, env)),
);

async function run(fn: () => Promise<{ text: string; structured: Record<string, unknown> }>) {
  try {
    const { text, structured } = await fn();
    return { content: [{ type: "text" as const, text }], structuredContent: structured };
  } catch (e) {
    const msg = e instanceof ToolInputError ? e.message : `rcm-doctor failed: ${(e as Error).message}`;
    // Never echo the key, even if an upstream error message contained it.
    const safe = env.apiKey ? msg.split(env.apiKey).join("[redacted]") : msg;
    return { content: [{ type: "text" as const, text: safe }], isError: true };
  }
}

await server.connect(new StdioServerTransport());
console.error(`rcm-doctor MCP server ready (stdio) · AI step: ${env.apiKey ? "on" : "off (rules-only / demo)"} · root ${root}`);
