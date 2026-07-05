#!/usr/bin/env node
// 디자인 브릿지 JSON을 shared/bridge.schema.json (v2.0) 기준으로 검증한다.
// 사용법: node scripts/validate-bridge.mjs <path-to-bridge.json>
//
// 핵심 검사:
//  - 필수 구조 (meta/tokens/screens, schemaVersion 2.0)
//  - 노드 type enum
//  - 무손실 참조: 모든 '@token.path' 참조가 tokens 사전에서 실제 복원 가능한지 (미해결 참조 = 손실)
//  - 반응형 breakpoint/variantGroup 쌍
//  - 스크린샷 교차검증 흔적(screenshot + reconciliation) 존재 여부 (경고)

import { readFileSync } from "node:fs";

const target = process.argv[2];
if (!target) {
  console.error("사용법: node scripts/validate-bridge.mjs <bridge.json>");
  process.exit(1);
}

const data = JSON.parse(readFileSync(target, "utf8"));
const errors = [];
const warnings = [];

const NODE_TYPES = ["frame", "group", "text", "image", "vector", "shape", "line", "ellipse", "component", "instance"];

// ── 1. 필수 구조 ──────────────────────────────────────────
if (!data.meta?.figmaUrl) errors.push("meta.figmaUrl 누락");
if (!["section", "page"].includes(data.meta?.mode)) errors.push("meta.mode는 section|page");
if (data.meta?.schemaVersion !== "2.0") errors.push(`meta.schemaVersion은 "2.0" (현재: ${JSON.stringify(data.meta?.schemaVersion)})`);
if (typeof data.tokens !== "object" || data.tokens === null) errors.push("tokens 객체 누락 (무손실 참조의 원본 사전)");
if (!Array.isArray(data.screens) || data.screens.length === 0) errors.push("screens 비어있음");

// ── 2. 토큰 참조 해석기 (무손실 보장의 핵심) ──────────────
// '@color.primary' → tokens.color.primary 가 존재해야 원본 복원 가능.
function resolvesToken(ref) {
  const path = ref.slice(1).split(".");
  let cur = data.tokens;
  for (const key of path) {
    if (cur == null || typeof cur !== "object" || !(key in cur)) return false;
    cur = cur[key];
  }
  return true;
}

// 객체 전체를 훑어 '@'로 시작하는 문자열 참조를 모두 검사.
function checkRefs(value, where) {
  if (typeof value === "string") {
    if (value.startsWith("@") && !resolvesToken(value)) {
      errors.push(`[${where}] 미해결 토큰 참조 '${value}' — tokens에 없음 (무손실 위반)`);
    }
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => checkRefs(v, `${where}[${i}]`));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) checkRefs(v, `${where}.${k}`);
  }
}

// ── 3. 노드 순회 ──────────────────────────────────────────
function walkNodes(nodes, where) {
  for (const [i, node] of (nodes ?? []).entries()) {
    const at = `${where}.nodes[${i}]`;
    if (!NODE_TYPES.includes(node.type)) {
      errors.push(`[${at}] 알 수 없는 node.type '${node.type}'`);
    }
    if ((node.type === "component" || node.type === "instance") && node.isDesignSystemComponent === undefined) {
      warnings.push(`[${at}] component/instance 노드에 isDesignSystemComponent 미기입 (rules §3)`);
    }
    if (node.type === "text" && node.content === undefined && node.runs === undefined) {
      warnings.push(`[${at}] text 노드에 content/runs 둘 다 없음`);
    }
    checkRefs(node.style, `${at}.style`);
    checkRefs(node.layout, `${at}.layout`);
    if (node.children) walkNodes(node.children, at);
  }
}

// ── 4. 화면 순회 ──────────────────────────────────────────
for (const [i, screen] of (data.screens ?? []).entries()) {
  const at = `screens[${i}](${screen.name ?? "?"})`;
  if ((screen.breakpoint && !screen.variantGroup) || (!screen.breakpoint && screen.variantGroup)) {
    warnings.push(`[${at}] breakpoint/variantGroup은 함께 있어야 함 (rules §5)`);
  }
  if (!screen.screenshot) {
    warnings.push(`[${at}] screenshot 미첨부 — 교차검증(rules §8) 불가`);
  }
  if (!screen.reconciliation) {
    warnings.push(`[${at}] reconciliation 없음 — 스크린샷 교차검증 미수행 (rules §8)`);
  } else if (screen.reconciliation.status === "discrepancies") {
    const open = (screen.reconciliation.discrepancies ?? []).filter((d) => !d.resolved);
    if (open.length) warnings.push(`[${at}] 미해결 불일치 ${open.length}건 (rules §8)`);
  }
  walkNodes(screen.nodes, at);
}

// ── 결과 ──────────────────────────────────────────────────
if (errors.length) {
  console.error("❌ 검증 실패:\n - " + errors.join("\n - "));
  process.exit(1);
}
if (warnings.length) {
  console.warn("⚠️  경고:\n - " + warnings.join("\n - "));
}
console.log("✅ 브릿지 검증 통과 (v2.0):", target);
