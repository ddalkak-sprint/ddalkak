#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = resolve(root, "fixtures", "figma", "untitled-1-858", "sections", "pc-post-edit", "get_design_context.json");
const converter = resolve(root, "scripts", "design-context-to-bridge.mjs");
const coordinateParser = resolve(root, "scripts", "design-context-parse.mjs");
const cacheChecker = resolve(root, "scripts", "mcp-cache.mjs");
const schema = JSON.parse(readFileSync(resolve(root, "shared", "bridge.schema.json"), "utf8"));

function run(script) {
  const result = spawnSync(process.execPath, [script, fixture], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || `${script} failed`);
  return result.stdout;
}

const first = run(converter);
const second = run(converter);
assert.equal(
  createHash("sha256").update(first).digest("hex"),
  createHash("sha256").update(second).digest("hex"),
  "cached conversion must be deterministic",
);

const draft = JSON.parse(first);
const nodes = [];
function walk(node) {
  nodes.push(node);
  for (const child of node.children ?? []) walk(child);
}
for (const node of draft.nodes) walk(node);

assert.equal(nodes.length, 204, "fixture node count changed");
assert.equal(draft.assets.length, 10, "fixture asset count changed");
assert.ok(nodes.some((node) => node.layout?.mode === "grid"), "grid layout was lost");
assert.ok(nodes.some((node) => node.constraints?.anchorX?.kind === "stretch"), "stretch anchor was lost");
assert.ok(nodes.some((node) => node.behavior?.overflowX === "clip"), "overflow behavior was lost");
assert.ok(nodes.some((node) => node.textBehavior?.wrap === "no-wrap"), "text wrapping behavior was lost");
assert.ok(nodes.some((node) => node.assetFit === "cover"), "asset fit behavior was lost");

const fullBridge = {
  meta: {
    figmaUrl: "cache://untitled-1-858",
    mode: "section",
    schemaVersion: "2.1",
    coordinateSpace: { unit: "design-unit" },
    completeness: "full",
  },
  tokens: {},
  assets: draft.assets,
  screens: [{
    name: "pc-post-edit",
    frame: { w: 1920, h: 1080 },
    adaptive: {
      group: "pc-post-edit",
      variant: "desktop",
      source: "observed",
      conditions: { orientation: "landscape" },
    },
    nodes: draft.nodes,
  }],
};
const ajv = new Ajv({ allErrors: true, strict: false });
assert.equal(ajv.validate(schema, fullBridge), true, JSON.stringify(ajv.errors, null, 2));

const parsedCoordinates = JSON.parse(run(coordinateParser));
assert.ok(
  parsedCoordinates.some((node) => node.constraints?.anchorX?.kind === "stretch" || node.constraints?.anchorY?.kind === "stretch"),
  "coordinate parser lost stretch anchors",
);

const incompleteCache = spawnSync(
  process.execPath,
  [cacheChecker, "check", resolve(root, "fixtures", "figma", "main")],
  { encoding: "utf8" },
);
assert.notEqual(incompleteCache.status, 0, "codeSummary cache with missing leaf details must be rejected");
assert.match(
  `${incompleteCache.stdout}\n${incompleteCache.stderr}`,
  /codeSummary leaf detail 누락 3개/,
  "cache check must report the missing leaf detail count",
);

console.log(`bridge cache regression passed: ${nodes.length} nodes, ${draft.assets.length} assets`);
