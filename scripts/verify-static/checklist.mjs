// 체크리스트 생성 — bridge 노드 트리 순회로 검사 항목 출제. (규칙 SSOT: §3)
import { normalizeHex, normalizeLineHeight, canonShadowCss, canonShadowEffect } from "./normalize.mjs";
import { ctx, resolveRef } from "./context.mjs";

function resolveExpectedColor(tokenOrHex) {
  if (typeof tokenOrHex !== "string") return null;
  if (tokenOrHex.startsWith("#")) return normalizeHex(tokenOrHex);
  if (tokenOrHex.startsWith("@")) {
    const v = resolveRef(tokenOrHex);
    return typeof v === "string" ? normalizeHex(v) : null;
  }
  return ctx.bridgeColorTokens[tokenOrHex] ?? null;
}

function emit(node, nodeId, property, expected, unit, label) {
  if (expected == null) return;
  const [, , bw, bh] = Array.isArray(node.bbox) ? node.bbox : [];
  const minSide = typeof bw === "number" && typeof bh === "number" ? Math.min(bw, bh) : null;
  ctx.checklist.push({
    nodeId, property, expected, unit, label, minSide,
    // Figma 고유 노드 id(node.id, 예: "14:2204") — 위치 경로(nodeId)와 별개의 안정적 앵커.
    // v1.1 목업 노드처럼 id가 없으면 undefined로 두고 위치경로 매칭만 사용한다(하위 호환).
    figmaId: typeof node.id === "string" ? node.id : undefined,
    lowTrust: node.source === "vision" || node.source === "inferred" ? node.source : null,
    target: {
      kind: node.type,
      mappedCodeComponent: node.mappedCodeComponent ?? null,
      suggestedComponent: node.suggestedComponent ?? null,
      componentName: node.componentName ?? null,
      content: typeof node.content === "string" ? node.content.trim() : null,
      assetRef: node.ref ?? null,
      nodeName: node.name ?? null,
    },
    node,
  });
}

// --- 1.1 (목업 스키마) ---
function walkNodeV11(node, nodeId) {
  const label = node.content ?? node.componentName ?? node.ref ?? node.type;
  const style = node.style ?? {};

  if (node.layout === "column" || node.layout === "row") emit(node, nodeId, "flexDirection", node.layout, "", label);
  if (typeof node.gap === "number") emit(node, nodeId, "gap", node.gap, "px", label);
  if (style.background != null) emit(node, nodeId, "backgroundColor", resolveExpectedColor(style.background), "hex", label);
  if (style.color != null) emit(node, nodeId, "textColor", resolveExpectedColor(style.color), "hex", label);
  if (style.border != null) emit(node, nodeId, "borderColor", resolveExpectedColor(style.border), "hex", label);
  if (typeof style.borderRadius === "number") emit(node, nodeId, "borderRadius", style.borderRadius, "px", label);
  if (typeof style.padding === "number")
    emit(node, nodeId, "padding", Array(4).fill(style.padding).join(" "), "px4", label); // 4방향 튜플로 정규화 (v2.1과 동일 표현)
  if (typeof style.height === "number") emit(node, nodeId, "height", style.height, "px", label);
  if (typeof style.shadow === "string") emit(node, nodeId, "boxShadow", canonShadowCss(style.shadow), "", label);
  if (style.token && ctx.bridgeTypeTokens[style.token]) {
    const t = ctx.bridgeTypeTokens[style.token];
    if (typeof t.size === "number") emit(node, nodeId, "fontSize", t.size, "px", label);
    if (typeof t.weight === "number") emit(node, nodeId, "fontWeight", t.weight, "", label);
    if (t.lineHeight != null) emit(node, nodeId, "lineHeight", normalizeLineHeight(t.lineHeight, t.size), "", label);
  }
  // bbox 출제 규칙 (x/y·파생 간격은 v0.2/픽셀 층으로 제외)
  if (Array.isArray(node.bbox)) {
    const [, , w, h] = node.bbox;
    const isStyledBox = node.type === "group" && Object.keys(style).length > 0;
    if (isStyledBox && typeof w === "number") emit(node, nodeId, "width", w, "px", label);
    if (node.type === "image") {
      if (typeof w === "number") emit(node, nodeId, "width", w, "px", label);
      if (typeof h === "number") emit(node, nodeId, "height", h, "px", label);
    }
  }
  (node.children ?? []).forEach((child, i) => walkNodeV11(child, `${nodeId}.children[${i}]`));
}

// --- 2.1 (figma-extractor 스키마: fills/effects/cornerRadius/layout 객체/@ref) ---
function soleSolidFill(style) {
  const fills = style?.fills;
  if (!Array.isArray(fills) || fills.length !== 1) return null; // 다중/그라디언트/이미지 fill은 정적 출제 범위 밖
  const f = fills[0];
  if (f?.type !== "solid" || f.color == null) return null;
  return resolveExpectedColor(f.color);
}

function walkNodeV21(node, nodeId) {
  const label =
    (typeof node.content === "string" && node.content.trim()) ||
    node.suggestedComponent || node.componentName || node.name || node.type;
  const style = node.style ?? {};
  const layout = node.layout ?? null;

  // 레이아웃 (오토레이아웃 컨테이너)
  if (layout?.mode === "column" || layout?.mode === "row")
    emit(node, nodeId, "flexDirection", layout.mode, "", label);
  const gap = resolveRef(layout?.gap);
  if (typeof gap === "number") emit(node, nodeId, "gap", gap, "px", label);
  if (Array.isArray(layout?.padding) && layout.padding.length === 4) {
    const p = layout.padding.map((v) => resolveRef(v));
    if (p.every((v) => typeof v === "number")) emit(node, nodeId, "padding", p.join(" "), "px4", label);
  }

  // 색 (fills — 텍스트는 글자색, 그 외는 배경색)
  const fill = soleSolidFill(style);
  if (fill && fill !== "transparent")
    emit(node, nodeId, node.type === "text" ? "textColor" : "backgroundColor", fill, "hex", label);

  // 테두리 (strokes — 단일 solid만)
  const strokes = style.strokes;
  if (Array.isArray(strokes) && strokes.length === 1 && strokes[0]?.type === "solid") {
    const sc = resolveExpectedColor(strokes[0].color);
    if (sc) emit(node, nodeId, "borderColor", sc, "hex", label);
  }

  // radius
  const radius = resolveRef(style.cornerRadius);
  if (typeof radius === "number") emit(node, nodeId, "borderRadius", radius, "px", label);

  // 그림자 (effects — drop-shadow만, 캐논 문자열로)
  if (Array.isArray(style.effects) && style.effects.length) {
    const canon = style.effects.map(canonShadowEffect).filter(Boolean).join(" , ");
    if (canon) emit(node, nodeId, "boxShadow", canon, "", label);
  }

  // 타이포 (text 노드 style.font — @type 참조 또는 인라인 객체)
  if (node.type === "text" && style.font != null) {
    const t = typeof style.font === "string" ? resolveRef(style.font) : style.font;
    if (t && typeof t === "object") {
      if (typeof t.size === "number") emit(node, nodeId, "fontSize", t.size, "px", label);
      if (typeof t.weight === "number") emit(node, nodeId, "fontWeight", t.weight, "", label);
      if (t.lineHeight != null) emit(node, nodeId, "lineHeight", normalizeLineHeight(t.lineHeight, t.size), "", label);
    }
  }

  // bbox w/h — sizing이 fixed인 축만 코드에 값이 존재한다 (hug/fill은 파생값 → 픽셀 층)
  if (Array.isArray(node.bbox)) {
    const [, , w, h] = node.bbox;
    if (layout?.sizing) {
      if (layout.sizing.horizontal === "fixed" && typeof w === "number") emit(node, nodeId, "width", w, "px", label);
      if (layout.sizing.vertical === "fixed" && typeof h === "number") emit(node, nodeId, "height", h, "px", label);
    } else if (node.type === "image" || node.type === "vector" || (node.type === "shape" && Object.keys(style).length)) {
      // 자산화/도형 노드: 고정 기하 — w/h 출제
      if (typeof w === "number") emit(node, nodeId, "width", w, "px", label);
      if (typeof h === "number") emit(node, nodeId, "height", h, "px", label);
    }
  }

  (node.children ?? []).forEach((child, i) => walkNodeV21(child, `${nodeId}.children[${i}]`));
}

// 동일 실체 다중 출현 dedup — 두 상태 화면(screens[0]/[1])의 공통 요소·반복 인스턴스를 1건으로.
// (mismatch 은닉 방지를 위해 expected까지 키에 포함: 기대값이 다르면 절대 합치지 않는다)
function dedupKey(check) {
  const t = check.target;
  const comp = t.mappedCodeComponent || t.suggestedComponent || (t.kind !== "text" ? t.componentName : null);
  if (comp) return `comp|${comp}|${check.property}|${check.expected}`;
  if (!ctx.isV21) return null; // 1.1은 기존 동작 유지 (component만 dedup)
  if (t.kind === "text" && t.content) return `text|${t.content}|${check.property}|${check.expected}`;
  if (t.assetRef) return `asset|${t.assetRef}|${check.property}|${check.expected}`;
  if (t.nodeName) return `node|${t.kind}|${t.nodeName}|${check.property}|${check.expected}`;
  return null;
}

// 체크리스트 출제 → dedup → deduped 배열 반환.
export function buildChecklist() {
  const walkNode = ctx.isV21 ? walkNodeV21 : walkNodeV11;
  (ctx.bridge.screens ?? []).forEach((screen, si) =>
    (screen.nodes ?? []).forEach((node, ni) => walkNode(node, `screens[${si}].nodes[${ni}]`)),
  );

  const deduped = [];
  const seen = new Map();
  for (const check of ctx.checklist) {
    const key = !ctx.isV21
      ? (check.target.kind === "component" && check.target.mappedCodeComponent
          ? `${check.target.mappedCodeComponent}|${check.property}|${check.expected}`
          : null)
      : dedupKey(check);
    if (key && seen.has(key)) {
      seen.get(key).instanceNodeIds.push(check.nodeId);
      continue;
    }
    check.instanceNodeIds = [check.nodeId];
    if (key) seen.set(key, check);
    deduped.push(check);
  }
  return deduped;
}
