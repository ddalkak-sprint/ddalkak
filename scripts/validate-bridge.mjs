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
if (!["2.0", "2.1"].includes(data.meta?.schemaVersion)) errors.push(`meta.schemaVersion은 "2.0"|"2.1" (현재: ${JSON.stringify(data.meta?.schemaVersion)})`);
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

// 소수 2자리 이상 px 값 감지 (rules §13 — 스케일 아티팩트/정규화 누락)
let fractionalCount = 0;
function isFractional(v) {
  return typeof v === "number" && v !== Math.round(v) && Math.abs(v * 10 - Math.round(v * 10)) > 1e-9;
}
function checkNumerics(obj, where, keys) {
  if (!obj || typeof obj !== "object") return;
  for (const key of keys) {
    const v = obj[key];
    if (isFractional(v)) { fractionalCount++; }
    else if (Array.isArray(v) && v.some(isFractional)) { fractionalCount++; }
  }
}

// ── 3. 노드 순회 ──────────────────────────────────────────
let visionNodes = 0;    // source:"vision" 노드 수 (rules §11 — verify 우선 확인 대상)
let semanticCount = 0;  // semanticRole 부여 수
let inferredNodes = 0;  // source:"inferred" 합성 래퍼 수 (rules §12-2)
const suggested = new Map(); // suggestedComponent → 발생 수 (rules §12-1)

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
    // 비전 보강 태깅 규약 (rules §11)
    if (node.source === "vision") {
      visionNodes++;
      if (typeof node.confidence !== "number" || node.confidence < 0 || node.confidence > 1) {
        errors.push(`[${at}] source:"vision" 노드에 confidence(0~1) 필수 (rules §11-2)`);
      }
    } else if (node.confidence !== undefined) {
      warnings.push(`[${at}] confidence는 source:"vision"일 때만 의미 있음`);
    }
    if (node.semanticRole !== undefined) {
      semanticCount++;
      if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(node.semanticRole)) {
        warnings.push(`[${at}] semanticRole '${node.semanticRole}'는 kebab-case 권장 (rules §11-1)`);
      }
    }
    // 수치 정규화 확인 (rules §13) — 소수 2자리 이상 px 값은 정규화 누락 신호
    checkNumerics(node.layout, `${at}.layout`, ["gap", "padding"]);
    checkNumerics(node.style, `${at}.style`, ["cornerRadius"]);

    // 구조 추론 규약 (rules §12)
    if (node.source === "inferred") {
      inferredNodes++;
      if (!Array.isArray(node.children) || node.children.length === 0) {
        errors.push(`[${at}] source:"inferred" 합성 노드는 자식을 감싸는 래퍼여야 함 (rules §12-2)`);
      }
    }
    if (node.suggestedComponent !== undefined) {
      suggested.set(node.suggestedComponent, (suggested.get(node.suggestedComponent) ?? 0) + 1);
      if (!/^[A-Z][A-Za-z0-9]*$/.test(node.suggestedComponent)) {
        warnings.push(`[${at}] suggestedComponent '${node.suggestedComponent}'는 PascalCase 권장 (rules §12-1)`);
      }
      if (node.componentName !== undefined) {
        errors.push(`[${at}] suggestedComponent와 componentName 동시 사용 불가 — 실제 Figma 컴포넌트면 §3, 추론이면 §12`);
      }
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
if (visionNodes > 0) {
  warnings.push(`vision 보강 노드 ${visionNodes}개 — 수치는 추정값, verify 단계에서 우선 대조 필요 (rules §11)`);
}
for (const [name, count] of suggested) {
  if (count < 2) warnings.push(`suggestedComponent '${name}' 발생 1회 — 반복(≥2회) 근거 필요 (rules §12-1)`);
}
if (fractionalCount > 0) {
  warnings.push(`소수점 px 값 ${fractionalCount}건 (gap/padding/cornerRadius) — 수치 정규화 누락, 스케일 아티팩트 의심 (rules §13)`);
}

if (errors.length) {
  console.error("❌ 검증 실패:\n - " + errors.join("\n - "));
  process.exit(1);
}
if (warnings.length) {
  console.warn("⚠️  경고:\n - " + warnings.join("\n - "));
}
const extra = [];
if (semanticCount) extra.push(`semanticRole ${semanticCount}개`);
if (visionNodes) extra.push(`vision 노드 ${visionNodes}개`);
if (inferredNodes) extra.push(`inferred 그룹 ${inferredNodes}개`);
if (suggested.size) extra.push(`suggestedComponent ${[...suggested.keys()].join("/")}`);
console.log(`✅ 브릿지 검증 통과 (v${data.meta.schemaVersion}): ${target}${extra.length ? "  [" + extra.join(", ") + "]" : ""}`);
