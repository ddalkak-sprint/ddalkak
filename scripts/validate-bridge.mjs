#!/usr/bin/env node
// 디자인 브릿지 JSON을 shared/bridge.schema.json 으로 검증한다.
// 사용법: node scripts/validate-bridge.mjs <path-to-bridge.json>
// TODO: ajv 등으로 정식 JSON Schema 검증 구현. 지금은 최소 필드 체크만.

import { readFileSync } from "node:fs";

const target = process.argv[2];
if (!target) {
  console.error("사용법: node scripts/validate-bridge.mjs <bridge.json>");
  process.exit(1);
}

const data = JSON.parse(readFileSync(target, "utf8"));
const errors = [];
const warnings = [];

if (!data.meta?.figmaUrl) errors.push("meta.figmaUrl 누락");
if (!["section", "page"].includes(data.meta?.mode)) errors.push("meta.mode는 section|page");
if (!Array.isArray(data.screens) || data.screens.length === 0) errors.push("screens 비어있음");
if (!data.meta?.schemaVersion) warnings.push("meta.schemaVersion 누락 (1.0으로 취급됨)");

function walkNodes(nodes, screenName) {
  for (const node of nodes ?? []) {
    if (node.type === "component" && node.isDesignSystemComponent === undefined) {
      warnings.push(`[${screenName}] component 노드에 isDesignSystemComponent 미기입 (rules §3 확인)`);
    }
    if (node.children) walkNodes(node.children, screenName);
  }
}

for (const screen of data.screens ?? []) {
  if ((screen.breakpoint && !screen.variantGroup) || (!screen.breakpoint && screen.variantGroup)) {
    warnings.push(`[${screen.name}] breakpoint/variantGroup은 함께 있어야 함 (rules §5)`);
  }
  walkNodes(screen.nodes, screen.name);
}

if (errors.length) {
  console.error("❌ 검증 실패:\n - " + errors.join("\n - "));
  process.exit(1);
}
if (warnings.length) {
  console.warn("⚠️  경고:\n - " + warnings.join("\n - "));
}
console.log("✅ 브릿지 기본 검증 통과:", target);
