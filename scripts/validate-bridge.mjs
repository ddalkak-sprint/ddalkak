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
//  - 수치 진실성 (rules §9-1, 경고):
//    · 오토레이아웃 산술 불변식 — hug 축에서 padding+Σ자식+gap ≈ bbox
//    · 포함 관계 불변식 — 자식 bbox가 부모를 벗어나지 않음
//    · 선언 레이아웃 겹침 불변식 — row/column 자식이 주축에서 겹치지 않음
//    · bbox↔스크린샷 edge 대조 — 선언된 경계 위치에 실제 색 전이가 있는지 표본 검사

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";

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
let lowTrustNodes = 0;  // confidence 마킹된 비-vision 노드 수 (rules §8-1 재조합 서브트리)
const suggested = new Map(); // suggestedComponent → 발생 수 (rules §12-1)

// 수치 진실성 검사용 수집 (rules §9-1) — 순회하며 모으고 화면 순회 후 판정
const pixelCheckNodes = []; // { at, node, absX, absY, ancestorFill }

// 토큰 참조를 실제 값으로 복원 (색·gap 해석용). 실패 시 undefined.
function resolveValue(ref) {
  if (typeof ref !== "string" || !ref.startsWith("@")) return ref;
  const path = ref.slice(1).split(".");
  let cur = data.tokens;
  for (const key of path) {
    if (cur == null || typeof cur !== "object" || !(key in cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

// '#RRGGBB' 불투명 hex만 [r,g,b]로. 그 외(알파·rgba·토큰 미해석)는 null.
function opaqueRgb(color) {
  const v = resolveValue(color);
  if (typeof v !== "string") return null;
  const m = /^#([0-9a-fA-F]{6})$/.exec(v.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// rules §9-1 불변식 1 — 오토레이아웃 산술 (hug 축)
function checkAutoLayoutArithmetic(node, at) {
  const L = node.layout;
  if (!L || !["row", "column"].includes(L.mode) || !Array.isArray(node.bbox)) return;
  const kids = (node.children ?? []).filter((c) => Array.isArray(c.bbox));
  if (!kids.length) return;
  const pad = Array.isArray(L.padding) ? L.padding : [0, 0, 0, 0]; // [t,r,b,l]
  const gap = typeof resolveValue(L.gap) === "number" ? resolveValue(L.gap) : 0;
  const horizontalIsPrimary = L.mode === "row";
  const TOL = 2;

  const axes = [
    { name: "horizontal", size: node.bbox[2], padSum: pad[1] + pad[3], dim: 2, primary: horizontalIsPrimary },
    { name: "vertical",   size: node.bbox[3], padSum: pad[0] + pad[2], dim: 3, primary: !horizontalIsPrimary },
  ];
  for (const ax of axes) {
    if (L.sizing?.[ax.name] !== "hug") continue;
    let expected;
    if (ax.primary) {
      if (L.primaryAxisAlign === "space-between") continue; // gap이 파생값 — 주축 검사 무의미
      expected = ax.padSum + kids.reduce((s, c) => s + c.bbox[ax.dim], 0) + gap * (kids.length - 1);
    } else {
      expected = ax.padSum + Math.max(...kids.map((c) => c.bbox[ax.dim]));
    }
    if (Math.abs(expected - ax.size) > TOL) {
      warnings.push(
        `[${at}] 오토레이아웃 산술 불일치(${ax.name}): padding+자식+gap=${expected} ≠ bbox ${ax.size} — bbox 또는 padding이 원본과 다름 의심 (rules §9-1)`
      );
    }
  }
}

// rules §9-1 불변식 2·3 — 포함 관계 + 선언 레이아웃 겹침
function checkContainmentAndOverlap(node, at) {
  if (!Array.isArray(node.bbox)) return;
  const [, , pw, ph] = node.bbox;
  const kids = (node.children ?? []).filter((c) => Array.isArray(c.bbox));
  const TOL = 4;
  for (const [ci, c] of kids.entries()) {
    const [cx, cy, cw, ch] = c.bbox;
    if (cx < -TOL || cy < -TOL || cx + cw > pw + TOL || cy + ch > ph + TOL) {
      warnings.push(`[${at}.children[${ci}]] 자식 bbox [${c.bbox}]가 부모 크기 [${pw}×${ph}]를 벗어남 (rules §9-1)`);
    }
  }
  const mode = node.layout?.mode;
  if (!["row", "column"].includes(mode) || kids.length < 2) return;
  const lo = mode === "row" ? 0 : 1, sz = mode === "row" ? 2 : 3;
  const sorted = [...kids].sort((a, b) => a.bbox[lo] - b.bbox[lo]);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1], cur = sorted[i];
    if (cur.bbox[lo] < prev.bbox[lo] + prev.bbox[sz] - 2) {
      warnings.push(
        `[${at}] layout ${mode}인데 자식 '${prev.name ?? "?"}'(${prev.bbox})와 '${cur.name ?? "?"}'(${cur.bbox})가 주축에서 겹침 — 선언 레이아웃과 bbox 모순 (rules §9-1)`
      );
    }
  }
}

function walkNodes(nodes, where, absX = 0, absY = 0, ancestorFill = null) {
  for (const [i, node] of (nodes ?? []).entries()) {
    const at = `${where}.nodes[${i}]`;
    // 수치 진실성 (rules §9-1)
    checkAutoLayoutArithmetic(node, at);
    checkContainmentAndOverlap(node, at);
    const nx = absX + (Array.isArray(node.bbox) ? node.bbox[0] : 0);
    const ny = absY + (Array.isArray(node.bbox) ? node.bbox[1] : 0);
    const ownFill = node.style?.fills?.find((f) => f?.type === "solid");
    const ownRgb = ownFill ? opaqueRgb(ownFill.color) : null;
    const hasStroke = (node.style?.strokes ?? []).some((s) => s?.color);
    if (
      Array.isArray(node.bbox) && node.bbox[2] >= 20 && node.bbox[3] >= 20 &&
      ["frame", "instance", "component", "shape", "group"].includes(node.type) &&
      (hasStroke || (ownRgb && (!ancestorFill || ownRgb.join() !== ancestorFill.join())))
    ) {
      pixelCheckNodes.push({ at, name: node.name, absX: nx, absY: ny, w: node.bbox[2], h: node.bbox[3], fillRgb: ownRgb });
    }
    if (!NODE_TYPES.includes(node.type)) {
      errors.push(`[${at}] 알 수 없는 node.type '${node.type}'`);
    }
    if ((node.type === "component" || node.type === "instance") && node.isDesignSystemComponent === undefined) {
      warnings.push(`[${at}] component/instance 노드에 isDesignSystemComponent 미기입 (rules §3)`);
    }
    if (node.type === "text" && node.content === undefined && node.runs === undefined) {
      warnings.push(`[${at}] text 노드에 content/runs 둘 다 없음`);
    }
    // 비전 보강 태깅 규약 (rules §11) + 재조합 저신뢰 마킹 (rules §8-1)
    if (node.source === "vision") {
      visionNodes++;
      if (typeof node.confidence !== "number" || node.confidence < 0 || node.confidence > 1) {
        errors.push(`[${at}] source:"vision" 노드에 confidence(0~1) 필수 (rules §11-2)`);
      }
    } else if (node.confidence !== undefined) {
      if (typeof node.confidence !== "number" || node.confidence < 0 || node.confidence > 1) {
        errors.push(`[${at}] confidence는 0~1 숫자 (rules §8-1/§11-2)`);
      } else {
        lowTrustNodes++; // 재조합(re-extract) 서브트리 루트 등 저신뢰 마킹
      }
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
    if (node.children) walkNodes(node.children, at, nx, ny, ownRgb ?? ancestorFill);
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

// ── 5. 재조합 confidence 마킹 검사 (rules §8-1) ────────────
const reExtracted = (data.screens ?? []).some((s) =>
  (s.reconciliation?.discrepancies ?? []).some((d) => d.resolved && d.resolution === "re-extract")
);
if (reExtracted && lowTrustNodes === 0) {
  warnings.push(
    "re-extract 보정이 기록돼 있는데 confidence 마킹된 서브트리가 없음 — 재조합 수치가 무표기 신뢰로 하류에 전달됨 (rules §8-1)"
  );
}

// ── 6. bbox↔스크린샷 edge 대조 (rules §9-1) ────────────────
let pixelChecked = 0;
const pixelSuspects = [];
try {
  const { PNG } = await import("pngjs");
  const projRoot = resolve(dirname(resolve(target)), "..", "..");
  for (const [si, screen] of (data.screens ?? []).entries()) {
    const shotAsset = (data.assets ?? []).find((a) => a.id === screen.screenshot);
    if (!shotAsset?.export) continue;
    const shotPath = [join(projRoot, shotAsset.export), resolve(shotAsset.export)].find((p) => existsSync(p));
    if (!shotPath) { warnings.push(`[screens[${si}]] 스크린샷 파일 없음(${shotAsset.export}) — edge 대조 생략`); continue; }
    const png = PNG.sync.read(readFileSync(shotPath));
    const scale = screen.frame?.w ? png.width / screen.frame.w : 1;
    const px = (x, y) => {
      const cx = Math.min(png.width - 1, Math.max(0, Math.round(x)));
      const cy = Math.min(png.height - 1, Math.max(0, Math.round(y)));
      const i = (cy * png.width + cx) * 4;
      return [png.data[i], png.data[i + 1], png.data[i + 2]];
    };
    const delta = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
    // 경계점에서 바깥(-3px)과 경계/안쪽(0/+3px) 표본 간 색 전이 유무
    const hasTransition = (ex, ey, dx, dy) => {
      const ox = ex - 3 * dx, oy = ey - 3 * dy;
      if (ox < 0 || oy < 0 || ox >= png.width || oy >= png.height) return true; // 화면 밖 — 판정 불가는 통과 처리
      const out = px(ox, oy);
      return delta(out, px(ex, ey)) > 8 || delta(out, px(ex + 3 * dx, ey + 3 * dy)) > 8;
    };
    for (const cand of pixelCheckNodes) {
      const m = /^screens\[(\d+)\]/.exec(cand.at);
      if (!m || Number(m[1]) !== si) continue;
      const x = cand.absX * scale, y = cand.absY * scale, w = cand.w * scale, h = cand.h * scale;
      if (w >= png.width * 0.9 && h >= png.height * 0.9) continue; // 화면 전체급 루트는 제외
      pixelChecked++;
      const edges = [
        [x, y + h / 2, 1, 0],          // left  (안쪽 = +x)
        [x + w - 1, y + h / 2, -1, 0], // right
        [x + w / 2, y, 0, 1],          // top
        [x + w / 2, y + h - 1, 0, -1], // bottom
      ];
      // 신호 1: 경계에 시각 전이(색 변화)가 없음 — 선언된 경계 자리에 실제 경계가 없다
      const noTrans = edges.filter(([ex, ey, dx, dy]) => !hasTransition(ex, ey, dx, dy)).length;
      // 신호 2: 경계 안쪽 표본이 선언된 fill 색과 다름 — 노드가 그 자리에 없다 (겹침 오검출 방지)
      const fillMiss = cand.fillRgb
        ? edges.filter(([ex, ey, dx, dy]) => delta(px(ex + 3 * dx, ey + 3 * dy), cand.fillRgb) > 6).length
        : 0;
      if (noTrans >= 2 || fillMiss >= 2) {
        const why = [noTrans >= 2 ? `4변 중 ${noTrans}변에 시각 전이 없음` : null, fillMiss >= 2 ? `4변 중 ${fillMiss}변 안쪽이 선언 fill과 다름` : null].filter(Boolean).join(", ");
        pixelSuspects.push(`[${cand.at}] '${cand.name ?? "?"}' ${why} — 선언 좌표 [${cand.absX},${cand.absY},${cand.w},${cand.h}]가 스크린샷과 불일치 의심 (rules §9-1)`);
      }
    }
  }
} catch (e) {
  warnings.push(`edge 대조 생략 (${e.message}) — pngjs 의존성/스크린샷 확인`);
}
const MAX_SUSPECTS = 12;
warnings.push(...pixelSuspects.slice(0, MAX_SUSPECTS));
if (pixelSuspects.length > MAX_SUSPECTS) warnings.push(`… bbox↔스크린샷 불일치 의심 ${pixelSuspects.length - MAX_SUSPECTS}건 더 있음`);

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
if (lowTrustNodes) extra.push(`저신뢰(재조합) 노드 ${lowTrustNodes}개`);
if (inferredNodes) extra.push(`inferred 그룹 ${inferredNodes}개`);
if (pixelChecked) extra.push(`edge 대조 ${pixelChecked}노드`);
if (suggested.size) extra.push(`suggestedComponent ${[...suggested.keys()].join("/")}`);
console.log(`✅ 브릿지 검증 통과 (v${data.meta.schemaVersion}): ${target}${extra.length ? "  [" + extra.join(", ") + "]" : ""}`);
