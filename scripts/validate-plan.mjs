#!/usr/bin/env node
// plan.md를 브릿지 JSON 기준으로 점검한다 (plan 단계 결정론 게이트).
// 사용법: node scripts/validate-plan.mjs <plan.md> [bridge.json]
//   bridge 인자를 생략하면 `.ddalkak/plan/<name>.plan.md` → `.ddalkak/bridge/<name>.bridge.json`로 추론한다.
//
// 검사 철학은 validate-bridge.mjs와 동일하다 — 구조/계약 위반은 error(exit 1),
// 완결성·품질 신호는 warning(exit 0)으로 나눈다.
//
//  error(구조):
//   - 필수 섹션 누락 (개요/컴포넌트 분해/파일 계획/디자인 토큰 매핑/구현 순서)
//   - 파일 계획 표 부재·형식 붕괴 (경로/신규·수정/설명 3열, 데이터행 ≥1)
//   - 디자인 토큰 매핑 표 부재
//   - 제목 `# plan.md — <name>`의 name이 브릿지 <name>과 불일치
//   - 브릿지 screen(→PascalCase 페이지)이 plan 어디에도 등장하지 않음 (커버리지 구멍)
//
//  warning(완결성 — code가 즉석 환산/발명하게 되는 지점, plan-rules §4):
//   - 브릿지가 참조한 토큰이 토큰 매핑 표에 없음
//   - 브릿지 raw 시각값(radius/gap/padding/고정 폭·높이)이 표에 없음
//   - 브릿지 raw 색(fill/stroke/effect 리터럴)이 plan에 없음 — 근접값(rgba 0.5 vs 0.54)까지 각각 (plan-rules §4)
//   - drop-shadow가 있는데 plan에 shadow 표기가 없음 (plan-rules §4·§4-1)
//   - text 노드 인라인 타이포의 lineHeight가 plan에 없음 (텍스트→토큰·색 바인딩, plan-rules §3)
//   - 겹치는 mode:"none" 서브트리(일러스트)가 있는데 plan에 절대좌표(left-[/top-[) 표가 없음 (plan-rules §2-1)
//   - 브릿지 컴포넌트(mappedCodeComponent/componentName/suggestedComponent)가 plan에 언급 없음
//   - 페이지 등록(진입점 "수정" 행) 흔적 없음 (plan-rules §1)
//   - 브릿지 미해결 불일치가 있는데 plan에 ⚠ 섹션이 없음

import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";

const planPath = process.argv[2];
if (!planPath) {
  console.error("사용법: node scripts/validate-plan.mjs <plan.md> [bridge.json]");
  process.exit(1);
}

const planText = readFileSync(planPath, "utf8");
const errors = [];
const warnings = [];

// ── 브릿지 로드 (명시 인자 → 추론 → 없으면 구조검사만) ────────
const bridgePath = process.argv[3] ?? inferBridgePath(planPath);
let bridge = null;
if (bridgePath && existsSync(bridgePath)) {
  try {
    bridge = JSON.parse(readFileSync(bridgePath, "utf8"));
  } catch (err) {
    errors.push(`브릿지 파싱 실패 (${bridgePath}): ${err.message}`);
  }
} else {
  warnings.push(`브릿지 JSON을 찾지 못해 구조 검사만 수행 (인자로 경로를 넘기면 완결성까지 검사). 추론 경로: ${bridgePath ?? "-"}`);
}

function inferBridgePath(p) {
  const m = p.replace(/\\/g, "/").match(/^(.*)\/plan\/(.+)\.plan\.md$/);
  if (!m) return null;
  return `${m[1]}/bridge/${m[2]}.bridge.json`;
}

// ── 섹션 파서 ─────────────────────────────────────────────
function sectionBody(md, heading) {
  const lines = md.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim().replace(/\s+/g, " ").startsWith(`## ${heading}`));
  if (start === -1) return null;
  const body = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break;
    body.push(lines[i]);
  }
  return body.join("\n");
}

// 마크다운 표의 데이터행(헤더·구분행 제외)을 셀 배열로 반환.
function tableRows(text) {
  if (!text) return [];
  const rows = [];
  let sawSeparator = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith("|")) continue;
    if (/^\|[\s:|-]+\|?$/.test(line) && line.includes("-")) { sawSeparator = true; continue; }
    if (!sawSeparator) continue; // 헤더행은 구분행 이전이므로 건너뜀
    const cells = line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
    if (cells.some((c) => c.length)) rows.push(cells);
  }
  return rows;
}

// ── 1. 필수 섹션 ─────────────────────────────────────────
const REQUIRED = ["개요", "컴포넌트 분해", "파일 계획", "디자인 토큰 매핑", "구현 순서"];
const sections = {};
for (const h of REQUIRED) {
  const body = sectionBody(planText, h);
  sections[h] = body;
  if (body === null) errors.push(`필수 섹션 '## ${h}' 누락 (plan-rules §10)`);
}

// ── 2. 제목의 <name> ↔ 브릿지 <name> ─────────────────────
const titleMatch = planText.match(/^#\s*plan\.md\s*[—\-]\s*(.+?)\s*$/m);
const planName = titleMatch ? titleMatch[1].trim() : null;
if (!planName) {
  errors.push("제목 '# plan.md — <name>' 형식이 아님");
}
if (bridge && planName) {
  const bridgeName = basename(bridgePath).replace(/\.bridge\.json$/, "");
  if (planName !== bridgeName) {
    errors.push(`제목 name '${planName}'이 브릿지 <name> '${bridgeName}'과 불일치 (plan-rules §1)`);
  }
}

// ── 3. 파일 계획 표 ──────────────────────────────────────
const fileRows = tableRows(sections["파일 계획"]);
if (sections["파일 계획"] !== null) {
  if (!fileRows.length) {
    errors.push("파일 계획 표에 데이터 행이 없음");
  } else {
    fileRows.forEach((cells, i) => {
      if (cells.length < 3) {
        errors.push(`파일 계획 ${i + 1}행 열 부족(경로/신규·수정/설명 3열 필요): ${cells.join(" | ")}`);
        return;
      }
      if (!/신규|수정/.test(cells[1])) {
        errors.push(`파일 계획 ${i + 1}행 2열은 '신규' 또는 '수정'이어야 함: '${cells[1]}'`);
      }
    });
    if (!fileRows.some((c) => /수정/.test(c[1] ?? ""))) {
      warnings.push("파일 계획에 '수정' 행이 없음 — 페이지를 앱 진입점에 등록하는 파일이 빠졌을 수 있음 (plan-rules §1)");
    }
  }
}

// ── 4. 디자인 토큰 매핑 표 ───────────────────────────────
const tokenSection = sections["디자인 토큰 매핑"];
const tokenRows = tableRows(tokenSection);
if (tokenSection !== null && !tokenRows.length) {
  errors.push("디자인 토큰 매핑 표에 데이터 행이 없음 (plan-rules §4 — 값→코드표현 확정이 code 결정론의 핵심)");
}
// 토큰표 원문(소문자)을 완결성 검사용 건초더미로 삼는다. 파일 계획 설명도 폭 값 등을 담을 수 있어 함께 포함.
const haystack = `${tokenSection ?? ""}\n${sections["파일 계획"] ?? ""}`.toLowerCase();

function numberPresent(n) {
  return new RegExp(`(^|[^0-9.])${n}([^0-9]|$)`).test(haystack);
}
function tokenPresent(dottedPath, resolvedValue) {
  if (haystack.includes(dottedPath.toLowerCase())) return true;
  if (typeof resolvedValue === "string" && resolvedValue.startsWith("#")) {
    return haystack.includes(resolvedValue.toLowerCase());
  }
  if (typeof resolvedValue === "number") return numberPresent(resolvedValue);
  if (resolvedValue && typeof resolvedValue === "object" && typeof resolvedValue.size === "number") {
    return numberPresent(resolvedValue.size); // 타이포 토큰은 size로 표에 등장
  }
  return false;
}

// ── 5. 브릿지 소비 (완결성 + 커버리지) ───────────────────
if (bridge) {
  const referencedTokens = new Set();   // '@a.b.c' 참조 경로
  const rawValues = new Set();           // radius/gap/padding/고정 폭·높이 raw 리터럴
  const rawColors = new Set();           // fill/stroke/effect의 raw 색 리터럴(#hex·rgba)
  const shadows = [];                    // drop-shadow effect 원본(그림자 표기 완결성용)
  const inlineLineHeights = new Set();   // text 노드 인라인 타이포의 lineHeight(바인딩 완결성용)
  const illustrations = new Set();       // 자식 bbox가 겹치는 mode:"none" 서브트리 이름(절대배치)
  const components = new Set();           // 컴포넌트 이름 후보
  const pageNames = new Set();            // screen → PascalCase 페이지명 (variantGroup 중복 제거)

  const isColorLiteral = (v) => typeof v === "string" && /^(#[0-9a-fA-F]{3,8}|rgba?\()/.test(v.trim());
  function collectColors(value) {
    if (isColorLiteral(value)) rawColors.add(value.trim());
    else if (Array.isArray(value)) value.forEach(collectColors);
    else if (value && typeof value === "object") Object.values(value).forEach(collectColors);
  }
  // 두 노드 bbox([x,y,w,h])가 실제 면적으로 겹치는지 (일러스트 절대배치 판정, plan-rules §2-1).
  function overlaps(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length < 4 || b.length < 4) return false;
    const [ax, ay, aw, ah] = a, [bx, by, bw, bh] = b;
    return ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;
  }
  function childrenOverlap(children) {
    const boxes = (children ?? []).map((c) => c.bbox).filter(Boolean);
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++)
        if (overlaps(boxes[i], boxes[j])) return true;
    return false;
  }

  function pascal(name) {
    return String(name ?? "")
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join("");
  }
  function collectRefs(value) {
    if (typeof value === "string" && value.startsWith("@")) referencedTokens.add(value.slice(1));
    else if (Array.isArray(value)) value.forEach(collectRefs);
    else if (value && typeof value === "object") Object.values(value).forEach(collectRefs);
  }
  function addRaw(v) {
    if (typeof v === "number" && Number.isFinite(v) && Math.abs(v) > 0) rawValues.add(Math.round(v));
  }
  function walk(nodes) {
    for (const node of nodes ?? []) {
      collectRefs(node.style);
      collectRefs(node.layout);
      collectColors(node.style);
      // raw 리터럴(비-@ref) 시각값
      addRaw(node.style?.cornerRadius);
      addRaw(node.layout?.gap);
      for (const p of node.layout?.padding ?? []) addRaw(p);
      // 명시적으로 고정 크기인 축의 bbox 치수만 (폭/높이 확정 필요값)
      if (node.layout?.sizing?.horizontal === "fixed") addRaw(node.bbox?.[2]);
      if (node.layout?.sizing?.vertical === "fixed") addRaw(node.bbox?.[3]);
      // 그림자(effects) — 표기 완결성 (plan-rules §4·§4-1)
      for (const e of node.style?.effects ?? []) {
        if (e?.type === "drop-shadow" || e?.type === "inner-shadow") shadows.push(e);
      }
      // text 노드 인라인 타이포의 lineHeight — 토큰이 아닌 raw 타이포 바인딩 (plan-rules §3)
      const font = node.style?.font;
      if (font && typeof font === "object" && typeof font.lineHeight === "number") {
        inlineLineHeights.add(Math.round(font.lineHeight));
      }
      // 겹치는 mode:"none" 서브트리 = 일러스트 절대배치 (plan-rules §2-1)
      if (node.layout?.mode === "none" && (node.children?.length ?? 0) >= 2 && childrenOverlap(node.children)) {
        illustrations.add(node.name || node.type || "(unnamed)");
      }
      // 컴포넌트 이름 후보
      if (node.mappedCodeComponent) components.add(basename(node.mappedCodeComponent));
      if (node.componentName) components.add(node.componentName.split("/")[0]);
      if (node.suggestedComponent) components.add(node.suggestedComponent);
      if (node.children) walk(node.children);
    }
  }
  for (const screen of bridge.screens ?? []) {
    if (screen.name) pageNames.add(pascal(screen.name));
    walk(screen.nodes);
    // 브릿지 미해결 불일치 → plan ⚠ 섹션 존재해야 함
    const open = (screen.reconciliation?.discrepancies ?? []).filter((d) => !d.resolved);
    if (open.length && sectionBody(planText, "가정 및 미해결") === null && !/##.*⚠/.test(planText)) {
      warnings.push(`브릿지 screen '${screen.name}'에 미해결 불일치 ${open.length}건이 있으나 plan에 ⚠(가정 및 미해결) 섹션 없음`);
    }
  }

  function resolveToken(path) {
    let cur = bridge.tokens;
    for (const key of path.split(".")) {
      if (cur == null || typeof cur !== "object" || !(key in cur)) return undefined;
      cur = cur[key];
    }
    return cur;
  }

  // 5-1. 참조 토큰 완결성
  const missingTokens = [...referencedTokens]
    .filter((path) => !tokenPresent(path, resolveToken(path)))
    .sort();
  for (const t of missingTokens) {
    warnings.push(`참조 토큰 '@${t}'가 토큰 매핑 표에 없음 — code가 원값을 즉석 환산하게 됨 (plan-rules §4)`);
  }

  // 5-2. raw 시각값 완결성
  const missingRaw = [...rawValues].filter((v) => !numberPresent(v)).sort((a, b) => a - b);
  for (const v of missingRaw) {
    warnings.push(`raw 시각값 ${v}(radius/gap/padding/고정폭 중 하나)가 토큰 매핑 표에 없음 — 값→클래스 환산이 plan에 확정되지 않음 (plan-rules §4)`);
  }

  // 공백을 제거한 plan 전문 — 색·좌표·그림자는 토큰 표 밖(바인딩 섹션 등)에도 나오므로 전문에서 찾고,
  // rgba(0, 0, 0, 0.5) ↔ rgba(0,0,0,0.5) 같은 공백차를 흡수한다.
  const normColor = (s) => s.toLowerCase().replace(/\s+/g, "");
  const planNoSpace = normColor(planText);

  // 등록 토큰과 같은 값의 raw 색은 그 토큰 클래스로 표현될 수 있으므로(§4) 예외 처리한다.
  const resolvedColorTokens = new Map(); // 정규화색 → 토큰 경로
  (function flattenColors(obj, path) {
    if (isColorLiteral(obj)) resolvedColorTokens.set(normColor(obj), path);
    else if (obj && typeof obj === "object")
      for (const [k, v] of Object.entries(obj)) flattenColors(v, path ? `${path}.${k}` : k);
  })(bridge.tokens?.color, "color");

  // 5-2a. raw 색 완결성 (근접값도 각각 — rgba 0.5 vs 0.54)
  const missingColors = [...rawColors].filter((c) => {
    if (planNoSpace.includes(normColor(c))) return false;
    const tok = resolvedColorTokens.get(normColor(c)); // 동일값 토큰이 plan에 있으면 그 클래스로 표현된 것
    return !(tok && tokenPresent(tok, resolveToken(tok.replace(/^tokens?\./, ""))));
  }).sort();
  for (const c of missingColors) {
    warnings.push(`raw 색 '${c}'(fill/stroke/effect)가 plan에 없음 — code가 색을 브릿지에서 다시 읽게 됨 (plan-rules §4). 근접값은 하나로 뭉개지 않는다`);
  }

  // 5-2b. 그림자 표기 완결성
  if (shadows.length && !/shadow|box-shadow/.test(planNoSpace)) {
    warnings.push(`drop/inner-shadow ${shadows.length}건이 있으나 plan에 그림자 표기(shadow-[…])가 없음 — code가 그림자를 브릿지에서 다시 읽음 (plan-rules §4·§4-1: x_y_blur_spread_color 4성분)`);
  }

  // 5-2c. 인라인 타이포 lineHeight 바인딩 완결성 (등록 토큰이 아닌 raw 폰트)
  const missingLh = [...inlineLineHeights].filter((v) => !numberPresent(v)).sort((a, b) => a - b);
  for (const v of missingLh) {
    warnings.push(`인라인 타이포 lineHeight ${v}가 plan에 없음 — 텍스트→토큰·색 바인딩이 확정되지 않아 code가 브릿지를 다시 읽음 (plan-rules §3)`);
  }

  // 5-2d. 일러스트 절대배치 좌표 표 완결성
  if (illustrations.size && !/left-\[|top-\[/.test(planNoSpace)) {
    warnings.push(`겹치는 일러스트 서브트리(${[...illustrations].join(", ")})가 있으나 plan에 절대좌표 표(left-[…]/top-[…])가 없음 — code가 서브트리 좌표마다 브릿지를 다시 연다 (plan-rules §2-1)`);
  }

  // 5-3. 컴포넌트 커버리지
  const planLower = planText.toLowerCase();
  const missingComponents = [...components].filter((c) => c && !planLower.includes(c.toLowerCase())).sort();
  for (const c of missingComponents) {
    warnings.push(`브릿지 컴포넌트 '${c}'가 plan에 언급 없음 (컴포넌트 분해/파일 계획 확인)`);
  }

  // 5-4. 화면 커버리지 (구조 — error)
  for (const page of pageNames) {
    if (!planText.includes(page)) {
      errors.push(`브릿지 screen에 대응하는 페이지 '${page}'가 plan 어디에도 없음 (plan-rules §1 — 화면 커버리지 구멍)`);
    }
  }
}

// ── 결과 ──────────────────────────────────────────────────
if (errors.length) {
  console.error("❌ plan 검증 실패:\n - " + errors.join("\n - "));
  process.exit(1);
}
if (warnings.length) {
  console.warn("⚠️  완결성 경고:\n - " + warnings.join("\n - "));
}
console.log(`✅ plan 구조 검증 통과: ${planPath}${bridge ? "" : "  (구조만 — 브릿지 미연결)"}`);
