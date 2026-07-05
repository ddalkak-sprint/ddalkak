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

if (!data.meta?.figmaUrl) errors.push("meta.figmaUrl 누락");
if (!["section", "page"].includes(data.meta?.mode)) errors.push("meta.mode는 section|page");
if (!Array.isArray(data.screens) || data.screens.length === 0) errors.push("screens 비어있음");

if (errors.length) {
  console.error("❌ 검증 실패:\n - " + errors.join("\n - "));
  process.exit(1);
}
console.log("✅ 브릿지 기본 검증 통과:", target);
