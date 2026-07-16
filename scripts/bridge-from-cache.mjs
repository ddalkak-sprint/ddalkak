#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
if (!args.cache || !args.project) usage();

const startedAt = performance.now();
const cacheDir = resolve(args.cache);
const projectRoot = resolve(args.project);
assertInside(resolve("."), cacheDir, "cache");
assertInside(resolve("."), projectRoot, "project");

const manifestPath = resolve(cacheDir, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
runNode(resolve(repoRoot, "scripts", "mcp-cache.mjs"), "check", cacheDir);
const section = pickSection(manifest.sections ?? [], args.name);
const name = args.name ?? section?.slug ?? slug(section?.name ?? "screen");
const scope = section ? `section:${section.slug}` : null;
const contextCall = findCall(manifest.calls, "get_design_context", scope);
const screenshotCall = findCall(manifest.calls, "get_screenshot", scope);
if (!contextCall) throw new Error(`get_design_context cache not found for '${name}'`);
if (!screenshotCall) throw new Error(`get_screenshot cache not found for '${name}'`);

const contextPath = resolve(cacheDir, contextCall.file);
const screenshotPath = resolve(cacheDir, screenshotCall.file);
const converterPath = resolve(repoRoot, "scripts", "design-context-to-bridge.mjs");
const validatorPath = resolve(repoRoot, "scripts", "validate-bridge.mjs");

const bridgeDir = resolve(projectRoot, ".ddalkak", "bridge");
const assetDir = resolve(projectRoot, ".ddalkak", "assets", name);
mkdirSync(bridgeDir, { recursive: true });
mkdirSync(assetDir, { recursive: true });

const outputPath = resolve(bridgeDir, `${name}.bridge.json`);
const existingPath = args.existing ? resolve(args.existing) : outputPath;
const existing = existsSync(existingPath) ? JSON.parse(readFileSync(existingPath, "utf8")) : null;
const sourceFingerprint = runNode(resolve(repoRoot, "scripts", "mcp-cache.mjs"), "fingerprint", cacheDir).stdout.trim();
const extractorFingerprint = hashFiles([
  resolve(repoRoot, "shared", "bridge.schema.json"),
  resolve(repoRoot, "shared", "figma-extraction-rules.md"),
  converterPath,
  fileURLToPath(import.meta.url),
]);

if (!args.force && existingPath === outputPath && reusable(existing, projectRoot, sourceFingerprint, extractorFingerprint)) {
  const validation = runNode(validatorPath, outputPath, { allowWarnings: true });
  if (validation.status !== 0) throw new Error(`reused bridge validation failed:\n${validation.stderr}`);
  const warningCount = countWarnings(validation.stderr);
  console.log(JSON.stringify({
    output: outputPath,
    source: "cache",
    reused: true,
    mcpCalls: 0,
    elapsedMs: Math.round((performance.now() - startedAt) * 100) / 100,
    bytes: statSync(outputPath).size,
    estimatedTokens: Math.round(statSync(outputPath).size / 4),
    nodes: countNodes(existing.screens.flatMap((screen) => screen.nodes)),
    assets: existing.assets?.length ?? 0,
    validation: warningCount ? "conditional-pass" : "pass",
    warnings: warningCount,
    sourceFingerprint,
    extractorFingerprint,
  }, null, 2));
  if (validation.stderr.trim()) process.stderr.write(validation.stderr);
  process.exit(0);
}

const draft = JSON.parse(runNode(converterPath, contextPath).stdout);

const materializedAssets = [];
for (const asset of draft.assets) materializedAssets.push(await materializeAsset(asset, assetDir, projectRoot));

const screenshotId = `shot-${name}`;
const screenshotOutput = resolve(assetDir, "screenshot.png");
copyFileSync(screenshotPath, screenshotOutput);
materializedAssets.push({
  id: screenshotId,
  kind: "screenshot",
  export: posix(relative(projectRoot, screenshotOutput)),
  format: "png",
});

const supplementary = preserveLocalSupplementaryAssets(existing, projectRoot, materializedAssets);
applyExistingEmojiAssets(draft.nodes, existing);
applyDeterministicSemantics(draft.nodes);
normalizeComponentSuggestions(draft.nodes);
applyTokenRefs(draft.nodes, existing?.tokens);

const frame = draft.nodes[0]?.bbox?.slice(2, 4) ?? [draft.nodes[0]?.size?.[0], draft.nodes[0]?.size?.[1]];
const bridge = {
  meta: {
    figmaUrl: manifest.source?.figmaUrl ?? existing?.meta?.figmaUrl ?? "cache://unknown",
    mode: manifest.source?.mode ?? "section",
    schemaVersion: "2.1",
    fidelity: "lossless",
    extractedAt: new Date().toISOString(),
    sourceFingerprint,
    extractorFingerprint,
    coordinateSpace: { unit: "design-unit" },
    completeness: "full",
  },
  tokens: existing?.tokens ?? {},
  screens: [{
    name,
    frame: { w: frame[0], h: frame[1] },
    environment: { orientation: orientation(frame[0], frame[1]) },
    screenshot: screenshotId,
    reconciliation: { status: "match", discrepancies: [] },
    nodes: draft.nodes,
  }],
  assets: [...materializedAssets, ...supplementary],
};

const compact = JSON.stringify(bridge);
const tempPath = `${outputPath}.tmp`;
writeFileSync(tempPath, compact);
const validation = runNode(validatorPath, tempPath, { allowWarnings: true });
if (validation.status !== 0) {
  throw new Error(`generated bridge validation failed:\n${validation.stderr}`);
}

if (existsSync(outputPath) && !existsSync(`${outputPath}.previous.json`)) copyFileSync(outputPath, `${outputPath}.previous.json`);
copyFileSync(tempPath, outputPath);
unlinkSync(tempPath);

const elapsedMs = performance.now() - startedAt;
const warningCount = validation.stderr.split(/\r?\n/).filter((line) => line.startsWith(" - ")).length;
console.log(JSON.stringify({
  output: outputPath,
  source: "cache",
  reused: false,
  mcpCalls: 0,
  elapsedMs: Math.round(elapsedMs * 100) / 100,
  bytes: statSync(outputPath).size,
  estimatedTokens: Math.round(statSync(outputPath).size / 4),
  nodes: countNodes(draft.nodes),
  assets: bridge.assets.length,
  validation: warningCount ? "conditional-pass" : "pass",
  warnings: warningCount,
  sourceFingerprint,
  extractorFingerprint,
}, null, 2));
if (validation.stderr.trim()) process.stderr.write(validation.stderr);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    out[key] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
  }
  return out;
}

function usage() {
  console.error("usage: node scripts/bridge-from-cache.mjs --cache <dir> --project <dir> [--name <slug>] [--existing <bridge.json>]");
  process.exit(1);
}

function assertInside(base, target, label) {
  const rel = relative(base, target);
  if (rel.startsWith("..") || rel === "") {
    if (rel.startsWith("..")) throw new Error(`${label} path must stay inside workspace: ${target}`);
  }
}

function pickSection(sections, name) {
  if (!name) return sections[0] ?? null;
  return sections.find((item) => item.slug === name || item.name === name) ?? null;
}

function findCall(calls = [], tool, scope) {
  return calls.find((call) => call.tool === tool && (!scope || call.scope === scope));
}

function runNode(script, ...rest) {
  let options = {};
  if (typeof rest.at(-1) === "object") options = rest.pop();
  const result = spawnSync(process.execPath, [script, ...rest], { encoding: "utf8" });
  if (result.status !== 0 && !options.allowWarnings) throw new Error(result.stderr || `${basename(script)} failed`);
  return result;
}

async function materializeAsset(asset, targetDir, root) {
  const existing = ["svg", "png", "jpg", "webp"].map((ext) => resolve(targetDir, `${asset.id}.${ext}`)).find(existsSync);
  if (existing) return { ...asset, export: posix(relative(root, existing)), format: extension(existing) };

  const response = await fetch(asset.export);
  if (!response.ok) throw new Error(`asset download failed ${response.status}: ${asset.id}`);
  const format = formatFor(response.headers.get("content-type"));
  const target = resolve(targetDir, `${asset.id}.${format}`);
  writeFileSync(target, Buffer.from(await response.arrayBuffer()));
  return { ...asset, export: posix(relative(root, target)), format, kind: format === "svg" ? "vector" : "image" };
}

function preserveLocalSupplementaryAssets(existing, root, generated) {
  if (!existing) return [];
  const generatedIds = new Set(generated.map((asset) => asset.id));
  return (existing.assets ?? []).filter((asset) => {
    if (generatedIds.has(asset.id) || typeof asset.export !== "string" || /^https?:/.test(asset.export)) return false;
    return existsSync(resolve(root, asset.export));
  });
}

function applyExistingEmojiAssets(nodes, existing) {
  if (!existing) return;
  const emojiRefs = new Map();
  walk(existing.screens?.flatMap((screen) => screen.nodes) ?? [], (node) => {
    if (node.emojiAsset && node.content && node.ref) emojiRefs.set(node.content, node.ref);
  });
  walk(nodes, (node) => {
    const ref = node.type === "text" ? emojiRefs.get(node.content) : null;
    if (ref) { node.ref = ref; node.emojiAsset = true; }
  });
}

function applyDeterministicSemantics(nodes) {
  walk(nodes, (node) => {
    const name = (node.name ?? "").toLowerCase();
    if (name === "card") node.semanticRole = "card";
    else if (name === "header" || name === "header_service") node.semanticRole = "nav";
    else if (name === "logo") node.semanticRole = "logo";
    else if (name === "badge") node.semanticRole = "badge";
    else if (name.includes("avatar")) node.semanticRole = name.includes("stack") ? "avatar-stack" : "avatar";
    else if (name.includes("badge_emoji")) node.semanticRole = "reaction-chip";
  });
}

function normalizeComponentSuggestions(nodes) {
  const all = [];
  walk(nodes, (node) => all.push(node));
  for (const node of all) {
    if (/^Component\d+$/.test(node.suggestedComponent ?? "")) delete node.suggestedComponent;
  }
  const cards = all.filter((node) => node.semanticRole === "card" || node.suggestedComponent === "Card");
  if (cards.length >= 2) for (const node of cards) node.suggestedComponent = "Card";

  const counts = new Map();
  for (const node of all) {
    if (node.suggestedComponent) counts.set(node.suggestedComponent, (counts.get(node.suggestedComponent) ?? 0) + 1);
  }
  for (const node of all) {
    if (node.suggestedComponent && counts.get(node.suggestedComponent) < 2) delete node.suggestedComponent;
  }
}

function applyTokenRefs(nodes, tokens) {
  const colorRefs = new Map(Object.entries(tokens?.color ?? {}).map(([name, value]) => [normalizeColor(value), `@color.${name}`]));
  const replace = (value) => {
    if (typeof value === "string") return colorRefs.get(normalizeColor(value)) ?? value;
    if (Array.isArray(value)) return value.map(replace);
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) value[key] = replace(child);
    }
    return value;
  };
  walk(nodes, (node) => {
    if (node.style) replace(node.style);
  });
}

function normalizeColor(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : value;
}

function walk(nodes, visit) {
  for (const node of nodes ?? []) { visit(node); walk(node.children, visit); }
}

function countNodes(nodes) {
  let count = 0;
  walk(nodes, () => count++);
  return count;
}

function reusable(existing, root, sourceFingerprint, extractorFingerprint) {
  if (!existing || existing.meta?.sourceFingerprint !== sourceFingerprint || existing.meta?.extractorFingerprint !== extractorFingerprint) return false;
  return (existing.assets ?? []).every((asset) => typeof asset.export === "string" && !/^https?:/.test(asset.export) && existsSync(resolve(root, asset.export)));
}

function countWarnings(stderr) {
  return stderr.split(/\r?\n/).filter((line) => line.startsWith(" - ")).length;
}

function hashFiles(files) {
  const hash = createHash("sha256");
  for (const file of files) hash.update(readFileSync(file));
  return hash.digest("hex").slice(0, 16);
}

function orientation(w, h) { return w === h ? "square" : w > h ? "landscape" : "portrait"; }
function formatFor(contentType = "") {
  if (contentType.includes("svg")) return "svg";
  if (contentType.includes("jpeg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  return "png";
}
function extension(file) { return file.slice(file.lastIndexOf(".") + 1); }
function posix(value) { return value.split(sep).join("/"); }
function slug(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "screen"; }
