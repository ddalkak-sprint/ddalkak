#!/usr/bin/env node
// get_design_context 코드 응답 → 브릿지 screen.nodes 초안 컴파일러 (rules §8-2·§8-3의 확장).
//
// 왜: 스켈레톤(get_metadata)과 좌표 파서(design-context-parse.mjs)는 기계화됐지만, 구조·스타일·텍스트·
// 에셋을 브릿지 노드로 옮기는 "병합"이 수작업(LLM 전사)으로 남아 있었다 — pc-post-edit 실측에서 결함
// 4건(아바타 스택 서브트리 통째 누락, 카드별 아바타 ref 오지정, 앵커 원형 소실, reaction gap 오류)이
// 전부 이 수작업 구간에서 났다. 이 스크립트는 그 구간을 결정론으로 바꾼다: MCP가 준 코드를 그대로
// 컴파일하므로 "받은 정보를 임의로 버리는" 일이 구조적으로 불가능하다.
//
// 하는 일:
//   1. 헬퍼 컴포넌트 함수(function Component1(...){...}) 인라인 — 호출부 className이 기본값을 덮음
//   2. 태그 트리 파싱 → 노드 트리 (data-node-id / data-name / 텍스트 content 보존)
//   3. Tailwind 클래스 → bbox(+anchorX/anchorY 원형, §8-3) / style(fills·strokes·cornerRadius·effects) /
//      layout(flex·gap·padding·align) / 텍스트 스타일(font·size·weight·lineHeight·color)
//   4. const imgX = "url" 에셋 수집 → assets[] + 노드 ref 연결
//
// 산출물은 **초안**이다: 노드 type의 instance/component 판별과 metadataLeaf 대조는 스켈레톤(§8-2)과의
// 병합에서 extractor가 마무리한다. 단 초안의 수치·구조·텍스트는 재전사하지 않는다(§8-2 원칙).
//
// 사용: node scripts/design-context-to-bridge.mjs <get_design_context 캐시.json> [--pretty]
//   입력: { code, rootFrame:{w,h}, nodeId } (rules §8-1 캡처 포맷)
//   출력: { assets: [...], nodes: [트리] } (stdout, 기본 compact — rules §14)

import { readFileSync } from "node:fs";

const target = process.argv[2];
const pretty = process.argv.includes("--pretty");
if (!target) {
  console.error("사용법: node scripts/design-context-to-bridge.mjs <get_design_context 캐시.json> [--pretty]");
  process.exit(1);
}
const cache = JSON.parse(readFileSync(target, "utf8"));
if (!cache.code) {
  console.error("입력에 'code'가 없음 — codeSummary만 반환된 캡처 (rules §8-1, leaf 개별 호출 필요)");
  process.exit(1);
}

// ── 1. 에셋 상수 수집 ────────────────────────────────────
const ASSETS = new Map(); // varName → { id, url }
for (const m of cache.code.matchAll(/^const (\w+) = "([^"]+)";/gm)) {
  const kebab = m[1]
    .replace(/^img/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Za-z])(\d+)/g, "$1-$2")
    .replace(/(\d)([A-Za-z])/g, "$1-$2")
    .toLowerCase() || "asset";
  ASSETS.set(m[1], { id: `asset-${kebab}`, url: m[2] });
}

// ── 2. 헬퍼 컴포넌트 함수 분리 ───────────────────────────
// function Name({...}) { return ( <JSX/> ); }  — 코드 앞쪽에 정의되고 본문에서 <Name ... />로 쓰임.
const sections = []; // { name|null(=본문), body }
{
  const re = /^(?:export default )?function (\w+)\([^)]*\)\s*\{/gm;
  const marks = [];
  let m;
  while ((m = re.exec(cache.code)) !== null) marks.push({ name: m[1], start: m.index, bodyStart: re.lastIndex });
  for (let i = 0; i < marks.length; i++) {
    const end = i + 1 < marks.length ? marks[i + 1].start : cache.code.length;
    sections.push({ name: marks[i].name, body: cache.code.slice(marks[i].bodyStart, end) });
  }
  if (!marks.length) sections.push({ name: null, body: cache.code });
}

// ── 3. 태그 트리 파서 ────────────────────────────────────
const TAG_RE = /<(\/?)([a-zA-Z][\w.]*)((?:"[^"]*"|\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|[^<>"{}])*?)(\/?)>/g;
const ATTR_CLASS_RE = /className=(?:"([^"]*)"|\{`([^`]*)`\}|\{[^}]*?"([^"]*)"[^}]*?\})/;
const ATTR_NODE_ID_RE = /data-node-id="([^"]+)"/;
const ATTR_NAME_RE = /data-name="([^"]+)"/;
const ATTR_SRC_RE = /src=\{(\w+)\}/;
const ATTR_ALT_RE = /alt="([^"]*)"/;

function parseTree(body) {
  const root = { children: [] };
  const stack = [{ el: root, contentStart: 0 }];
  let m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(body)) !== null) {
    const [full, closing, tag, rest, selfClose] = m;
    if (closing) {
      const frame = stack.pop();
      if (frame && frame.el !== root) {
        // 자식 태그가 없으면 여는 태그 끝 ~ 닫는 태그 시작 사이가 텍스트 콘텐츠
        if (!frame.el.children.length) {
          const inner = body.slice(frame.contentStart, m.index);
          const text = jsxText(inner);
          if (text) frame.el.text = (frame.el.text ? frame.el.text : "") + text;
          else {
            // JSX 표현식({props ? "동료" : "지인"} 등)이라 정적으로 못 푸는 텍스트 —
            // 버리지 않고 원식을 보존한다(무손실). 호출부 props(componentProps)로 해석 가능.
            const raw = inner.replace(/\s+/g, " ").trim();
            if (raw && /\{/.test(raw)) frame.el.textExpr = raw;
          }
        }
      }
      continue;
    }
    const el = {
      tag,
      className: (() => { const c = ATTR_CLASS_RE.exec(rest); return c ? (c[1] ?? c[2] ?? c[3] ?? "") : ""; })(),
      nodeId: ATTR_NODE_ID_RE.exec(rest)?.[1] ?? null,
      name: ATTR_NAME_RE.exec(rest)?.[1] ?? null,
      srcVar: ATTR_SRC_RE.exec(rest)?.[1] ?? null,
      alt: ATTR_ALT_RE.exec(rest)?.[1] ?? null,
      // 헬퍼 호출부의 문자열 props (예: <Badge badge="coworker" .../>) — 조건식 텍스트 해석의 근거로 보존
      props: (() => {
        const p = {};
        for (const a of rest.matchAll(/(?<![\w-])([a-zA-Z_]\w*)="([^"]*)"/g)) {
          if (!["className", "alt", "src", "id"].includes(a[1]) && !a[1].startsWith("data")) p[a[1]] = a[2];
        }
        return Object.keys(p).length ? p : null;
      })(),
      children: [],
    };
    stack[stack.length - 1].el.children.push(el);
    if (!selfClose) stack.push({ el, contentStart: m.index + full.length });
  }
  return root.children;
}

function jsxText(inner) {
  // 자식 태그 없는 요소의 innerText: JSX 표현식({`...`}, {"..."}) 언래핑, 공백 정리
  let t = inner.replace(/\{`([^`]*)`\}/g, "$1").replace(/\{"([^"]*)"\}/g, "$1");
  if (/[{}<>]/.test(t)) return null; // 남은 표현식/태그면 텍스트 아님
  t = t.replace(/\s+/g, " ").trim();
  return t || null;
}

const helpers = new Map(); // name → 트리 루트 el
const helperDerived = new Map(); // name → { isOther: { prop: "badge", val: "other" } } — 파생 불리언 바인딩
let mainTree = null;
for (const s of sections) {
  const tree = parseTree(s.body);
  if (!tree.length) continue;
  const isMain = tree.some((el) => el.nodeId === cache.nodeId) || s === sections[sections.length - 1];
  if (isMain && !mainTree) mainTree = tree;
  else if (s.name) {
    helpers.set(s.name, tree[0]);
    const derived = {};
    for (const dm of s.body.matchAll(/const (\w+) = (\w+) === "([^"]*)";/g)) derived[dm[1]] = { prop: dm[2], val: dm[3] };
    if (Object.keys(derived).length) helperDerived.set(s.name, derived);
  }
}
if (!mainTree) { console.error("본문 JSX 트리를 찾지 못함"); process.exit(1); }

// 헬퍼 인라인: <Component1 className="override"/> → 헬퍼 트리 복제 + 루트 className 덮기
function inlineHelpers(el) {
  if (helpers.has(el.tag)) {
    const sub = structuredClone(helpers.get(el.tag));
    if (el.className) sub.className = el.className;
    sub.helperComponent = el.tag; // 반복 구조 힌트 (§12 suggestedComponent 후보)
    if (el.nodeId) sub.nodeId = el.nodeId;
    if (el.props) sub.callProps = el.props; // 호출부 props — textExpr 해석 근거
    if (helperDerived.has(el.tag)) sub.derived = helperDerived.get(el.tag);
    sub.children.forEach(inlineHelpers);
    return sub;
  }
  el.children = el.children.map(inlineHelpers);
  return el;
}
mainTree = mainTree.map(inlineHelpers);

// ── 4. 클래스 → 속성 매핑 ────────────────────────────────
function px(cls, key) {
  const m = new RegExp(`(?:^|\\s)${key}-\\[([\\d.-]+)px\\]`).exec(cls);
  return m ? parseFloat(m[1]) : null;
}
function hasClass(cls, token) { return new RegExp(`(^|\\s)${token}(\\s|$)`).test(cls); }
function calcPercent(cls, key) {
  const m = new RegExp(`${key}-\\[calc\\(([\\d.]+)%([+-])([\\d.]+)px\\)\\]`).exec(cls);
  return m ? { percent: parseFloat(m[1]), sign: m[2] === "-" ? -1 : 1, offset: parseFloat(m[3]) } : null;
}
function round2(n) { return Math.round(n * 100) / 100; }

const NAMED_COLOR = { white: "#FFFFFF", black: "#000000", transparent: "transparent" };
function color(cls, prefix) {
  let m = new RegExp(`${prefix}-\\[(#[0-9a-fA-F]{3,8}|rgba?\\([^\\]]*\\))\\]`).exec(cls);
  if (m) return m[1].toUpperCase().startsWith("#") ? normHex(m[1]) : m[1];
  m = new RegExp(`(?:^|\\s)${prefix}-(white|black|transparent)(?:\\s|$)`).exec(cls);
  return m ? NAMED_COLOR[m[1]] : null;
}
function normHex(h) {
  h = h.toUpperCase();
  if (h.length === 4) h = "#" + [...h.slice(1)].map((c) => c + c).join("");
  return h;
}
const FONT_WEIGHT = { Thin: 100, ExtraLight: 200, Light: 300, Regular: 400, Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800, Black: 900 };

// bbox+앵커: design-context-parse.mjs와 동일 로직 (§8-2·§8-3 — 앵커 원형은 항상 보존)
function resolveGeom(cls, container, isRootNode) {
  let w = px(cls, "w") ?? px(cls, "size");
  let h = px(cls, "h") ?? px(cls, "size");
  if (hasClass(cls, "w-px")) w = 1;
  if (hasClass(cls, "h-px")) h = 1;
  if (hasClass(cls, "size-full") || hasClass(cls, "w-full")) w = w ?? container.w;
  if (hasClass(cls, "size-full") || hasClass(cls, "h-full")) h = h ?? container.h;
  if (isRootNode) { w = w ?? cache.rootFrame?.w ?? null; h = h ?? cache.rootFrame?.h ?? null; }

  // inset-[t_r_b_l] / inset-0 / left-0·right-0 스트레치
  const insetM = /inset-\[([\d.]+)px_([\d.]+)px_([\d.]+)px_([\d.]+)px\]/.exec(cls);
  const inset = insetM ? insetM.slice(1, 5).map(parseFloat) : hasClass(cls, "inset-0") ? [0, 0, 0, 0] : null;

  const left = px(cls, "left") ?? (hasClass(cls, "left-0") ? 0 : null) ?? (inset ? inset[3] : null);
  const right = px(cls, "right") ?? (hasClass(cls, "right-0") ? 0 : null) ?? (inset ? inset[1] : null);
  let x = left;
  let anchorX = null;
  if (left != null && right != null && container.w != null) {
    x = left;
    w = container.w - left - right;
    anchorX = { kind: "stretch", start: left, end: right };
  } else if (x == null && right != null && w != null && container.w != null) {
    x = container.w - right - w;
    anchorX = { kind: "opposite", offset: right };
  }
  if (x == null && hasClass(cls, "left-1/2") && container.w != null) { x = container.w / 2; anchorX = { kind: "percent", percent: 50, offset: 0 }; }
  if (x == null && container.w != null) {
    const p = calcPercent(cls, "left");
    if (p) { x = (container.w * p.percent) / 100 + p.sign * p.offset; anchorX = { kind: "percent", percent: p.percent, offset: p.sign * p.offset }; }
  }
  if (hasClass(cls, "-translate-x-1/2")) { if (x != null && w != null) x -= w / 2; if (anchorX) anchorX.translate = true; }

  const top = px(cls, "top") ?? (hasClass(cls, "top-0") ? 0 : null) ?? (inset ? inset[0] : null);
  const bottom = px(cls, "bottom") ?? (hasClass(cls, "bottom-0") ? 0 : null) ?? (inset ? inset[2] : null);
  let y = top;
  let anchorY = null;
  if (top != null && bottom != null && container.h != null) {
    y = top;
    h = container.h - top - bottom;
    anchorY = { kind: "stretch", start: top, end: bottom };
  } else if (y == null && bottom != null && h != null && container.h != null) {
    y = container.h - bottom - h;
    anchorY = { kind: "opposite", offset: bottom };
  }
  if (y == null && hasClass(cls, "top-1/2") && container.h != null) { y = container.h / 2; anchorY = { kind: "percent", percent: 50, offset: 0 }; }
  if (y == null && container.h != null) {
    const p = calcPercent(cls, "top");
    if (p) { y = (container.h * p.percent) / 100 + p.sign * p.offset; anchorY = { kind: "percent", percent: p.percent, offset: p.sign * p.offset }; }
  }
  if (hasClass(cls, "-translate-y-1/2")) { if (y != null && h != null) y -= h / 2; if (anchorY) anchorY.translate = true; }

  return { x, y, w, h, anchorX, anchorY };
}

function toConstraints(anchorX, anchorY) {
  const axis = (a, oppositeName, stretchName) => {
    if (!a) return undefined;
    if (a.kind === "stretch") return stretchName;
    if (a.kind === "opposite") return oppositeName;
    if (a.percent === 50 && a.translate) return "center";
    return "scale";
  };
  const horizontal = axis(anchorX, "right", "left-right");
  const vertical = axis(anchorY, "bottom", "top-bottom");
  if (!horizontal && !vertical) return null;
  const out = {};
  if (horizontal) out.horizontal = horizontal;
  if (vertical) out.vertical = vertical;
  if (anchorX) out.anchorX = anchorX;
  if (anchorY) out.anchorY = anchorY;
  return out;
}

function toStyle(cls) {
  const style = {};
  const bg = color(cls, "bg");
  if (bg) style.fills = [{ type: "solid", color: bg }];
  const radius = px(cls, "rounded");
  if (radius != null) style.cornerRadius = radius;
  if (hasClass(cls, "border") || /border-\[/.test(cls)) {
    const bc = color(cls, "border");
    const bw = px(cls, "border") ?? 1;
    if (bc) style.strokes = [{ color: bc, weight: bw, align: "inside" }];
  }
  const shadow = /drop-shadow-\[([^\]]+)\]/.exec(cls) ?? /(?:^|\s)shadow-\[([^\]]+)\]/.exec(cls);
  if (shadow) {
    const p = /(-?[\d.]+)px_(-?[\d.]+)px_([\d.]+)px(?:_(-?[\d.]+)px)?_(rgba?\([^)]*\)|#[0-9a-fA-F]+)/.exec(shadow[1]);
    if (p) style.effects = [{ type: "drop-shadow", color: p[5], offset: [parseFloat(p[1]), parseFloat(p[2])], radius: parseFloat(p[3]), spread: p[4] ? parseFloat(p[4]) : 0 }];
  }
  if (hasClass(cls, "overflow-clip") || hasClass(cls, "overflow-hidden")) style.clipsContent = true;
  return Object.keys(style).length ? style : null;
}

function toLayout(cls) {
  if (!hasClass(cls, "flex") && !hasClass(cls, "inline-grid") && !hasClass(cls, "grid")) return null;
  if (hasClass(cls, "inline-grid") || hasClass(cls, "grid")) {
    const layout = { mode: "grid" };
    const columns = gridTracks(cls, "grid-cols");
    const rows = gridTracks(cls, "grid-rows");
    if (columns.length || rows.length) layout.grid = {};
    if (columns.length) layout.grid.columns = columns;
    if (rows.length) layout.grid.rows = rows;
    return layout; // 아바타 스택 등 겹침 grid — flow로 바꾸지 않는다
  }
  const layout = { mode: hasClass(cls, "flex-col") ? "column" : "row" };
  if (hasClass(cls, "flex-wrap")) layout.wrap = "wrap";
  else if (hasClass(cls, "flex-nowrap")) layout.wrap = "no-wrap";
  const gap = px(cls, "gap");
  if (gap != null) layout.gap = gap;
  const p = px(cls, "p"), pxx = px(cls, "px"), pyy = px(cls, "py");
  if (p != null || pxx != null || pyy != null) layout.padding = [pyy ?? p ?? 0, pxx ?? p ?? 0, pyy ?? p ?? 0, pxx ?? p ?? 0];
  if (hasClass(cls, "items-center")) layout.counterAxisAlign = "center";
  else if (hasClass(cls, "items-start")) layout.counterAxisAlign = "start";
  else if (hasClass(cls, "items-end")) layout.counterAxisAlign = "end";
  else if (hasClass(cls, "items-stretch")) layout.counterAxisAlign = "stretch";
  if (hasClass(cls, "justify-center")) layout.primaryAxisAlign = "center";
  else if (hasClass(cls, "justify-between")) layout.primaryAxisAlign = "space-between";
  else if (hasClass(cls, "justify-start")) layout.primaryAxisAlign = "start";
  else if (hasClass(cls, "justify-end")) layout.primaryAxisAlign = "end";
  return layout;
}

function gridTracks(cls, prefix) {
  const raw = new RegExp(`${prefix}-\\[([^\\]]+)\\]`).exec(cls)?.[1];
  if (!raw) return [];
  return raw.split("_").map((part) => {
    if (["max-content", "min-content", "auto"].includes(part)) return { mode: "content" };
    const fixed = /^([\d.]+)px$/.exec(part);
    if (fixed) return { mode: "fixed", value: Number(fixed[1]) };
    const fraction = /^([\d.]+)fr$/.exec(part);
    if (fraction) return { mode: "fraction", value: Number(fraction[1]) };
    return null;
  }).filter(Boolean);
}

function toSizing(cls) {
  const axis = (key, fullClass) => {
    const min = px(cls, `min-${key}`);
    const max = px(cls, `max-${key}`);
    const mode = hasClass(cls, fullClass) || hasClass(cls, "size-full") ? "fill" : null;
    if (!mode && min == null && max == null) return null;
    const out = { mode: mode ?? "content" };
    if (min != null) out.min = min;
    if (max != null) out.max = max;
    return out;
  };
  const horizontal = axis("w", "w-full");
  const vertical = axis("h", "h-full");
  const out = {};
  if (horizontal) out.horizontal = horizontal;
  if (vertical) out.vertical = vertical;
  if (hasClass(cls, "grow")) out.grow = 1;
  const hasFixedSize = px(cls, "w") != null || px(cls, "h") != null || px(cls, "size") != null;
  if (hasClass(cls, "shrink-0") && !hasFixedSize) out.shrink = 0;
  else if (hasClass(cls, "shrink")) out.shrink = 1;
  if (hasClass(cls, "aspect-square")) out.aspectRatio = 1;
  else {
    const aspect = /aspect-\[([\d.]+)\/([\d.]+)\]/.exec(cls);
    if (aspect && Number(aspect[2]) !== 0) out.aspectRatio = round2(Number(aspect[1]) / Number(aspect[2]));
  }
  return Object.keys(out).length ? out : null;
}

function toBehavior(cls) {
  const out = {};
  if (hasClass(cls, "absolute")) out.positioning = "overlay";
  if (hasClass(cls, "hidden")) out.visibility = "hidden";
  const shared = hasClass(cls, "overflow-hidden") || hasClass(cls, "overflow-clip") ? "clip"
    : hasClass(cls, "overflow-auto") ? "auto"
    : hasClass(cls, "overflow-scroll") ? "scroll" : null;
  if (shared) out.overflowX = out.overflowY = shared;
  for (const axis of ["x", "y"]) {
    for (const value of ["hidden", "clip", "auto", "scroll"]) {
      if (hasClass(cls, `overflow-${axis}-${value}`)) out[`overflow${axis.toUpperCase()}`] = value === "hidden" ? "clip" : value;
    }
  }
  return Object.keys(out).length ? out : null;
}

function toTextBehavior(cls) {
  const out = {};
  if (hasClass(cls, "whitespace-nowrap")) out.wrap = "no-wrap";
  if (hasClass(cls, "text-ellipsis") || hasClass(cls, "truncate")) out.overflow = "ellipsis";
  else if (hasClass(cls, "overflow-hidden") || hasClass(cls, "overflow-clip")) out.overflow = "clip";
  const clamp = /(?:^|\s)line-clamp-(\d+)(?:\s|$)/.exec(cls);
  if (clamp) out.maxLines = Number(clamp[1]);
  return Object.keys(out).length ? out : null;
}

function toTextStyle(cls) {
  const font = {};
  const fm = /font-\['([^:']+)(?::(\w+))?'\]/.exec(cls);
  if (fm) { font.family = fm[1]; if (fm[2] && FONT_WEIGHT[fm[2]]) font.weight = FONT_WEIGHT[fm[2]]; }
  const size = px(cls, "text");
  if (size != null) font.size = size;
  const lh = px(cls, "leading");
  if (lh != null) font.lineHeight = lh;
  const ls = px(cls, "tracking");
  if (ls != null) font.letterSpacing = ls;
  const fill = color(cls, "text");
  const style = {};
  if (Object.keys(font).length) style.font = font;
  if (fill) style.fills = [{ type: "solid", color: fill }];
  return Object.keys(style).length ? style : null;
}

// ── 5. 트리 → 브릿지 노드 ────────────────────────────────
const usedAssets = new Map(); // id → asset

// `{badge === "coworker" ? "동료" : "지인"}` + props {badge:"coworker"} → "동료"
function resolveTernary(expr, props) {
  const m = /^\{\s*(\w+)\s*===\s*"([^"]*)"\s*\?\s*"([^"]*)"\s*:\s*"([^"]*)"\s*\}$/.exec(expr);
  if (!m || !props || !(m[1] in props)) return null;
  return props[m[1]] === m[2] ? m[3] : m[4];
}

// className 템플릿의 `${isOther ? "a" : "b"}` / `${badge === "v" ? "a" : "b"}`를 props+파생 바인딩으로 확정.
// 못 푸는 세그먼트는 제거하지 않고 남긴다(하류에서 미해석으로 드러나게 — 조용한 소실 금지).
function resolveClassTemplate(cls, props, derived) {
  return cls.replace(/\$\{\s*(\w+)(?:\s*===\s*"([^"]*)")?\s*\?\s*"([^"]*)"\s*:\s*"([^"]*)"\s*\}/g, (whole, name, eq, a, b) => {
    let cond = null;
    if (eq != null && props && name in props) cond = props[name] === eq;
    else if (derived && name in derived && props && derived[name].prop in props) cond = props[derived[name].prop] === derived[name].val;
    return cond == null ? whole : cond ? a : b;
  });
}

// 텍스트 스타일 상속: Figma 코드는 부모 <div>에 폰트, 자식 <p>에 텍스트를 두기도 한다
function compile(el, container, inheritedText, propsCtx, derivedCtx) {
  const props = el.callProps ?? propsCtx;
  const derived = el.derived ?? derivedCtx;
  const cls = resolveClassTemplate(el.className, props, derived);
  const isRootNode = el.nodeId === cache.nodeId;
  const geom = resolveGeom(cls, container, isRootNode);
  const ownText = toTextStyle(cls);
  const textStyle = ownText || inheritedText ? { ...(inheritedText || {}), ...(ownText || {}), font: { ...(inheritedText?.font || {}), ...(ownText?.font || {}) } } : null;

  // display:contents / 래핑 전용 div(클래스에 박스 정보 없음)는 자식을 그대로 올린다? — 무손실을 위해 유지하되 표시
  const node = {};
  if (el.srcVar) {
    node.type = "image";
    const a = ASSETS.get(el.srcVar);
    if (a) { node.ref = a.id; usedAssets.set(a.id, a); }
  } else if (el.text != null) {
    node.type = "text";
    node.content = el.text;
  } else if (el.textExpr) {
    node.type = "text";
    // 단순 삼항식(`{prop === "v" ? "a" : "b"}`)은 호출부 props로 결정론 해석. 못 풀면 원식 보존(무손실)
    const resolved = resolveTernary(el.textExpr, props);
    if (resolved != null) node.content = resolved;
    else node.contentExpr = el.textExpr;
  } else {
    node.type = "frame";
  }
  if (el.name) node.name = el.name;
  if (el.nodeId) node.nodeId = el.nodeId;
  if (el.helperComponent) node.suggestedComponent = el.helperComponent;
  if (el.callProps) node.componentProps = el.callProps;
  if (node.type === "text" && textStyle) {
    node.style = {};
    if (textStyle.font && Object.keys(textStyle.font).length) node.style.font = textStyle.font;
    if (textStyle.fills) node.style.fills = textStyle.fills;
    if (!Object.keys(node.style).length) delete node.style;
  } else {
    const style = toStyle(cls);
    if (style) node.style = style;
  }
  const layout = toLayout(cls);
  if (layout) node.layout = layout;
  const sizing = toSizing(cls);
  if (sizing) node.sizing = sizing;
  const behavior = toBehavior(cls);
  if (behavior) node.behavior = behavior;
  if (node.type === "text") {
    const textBehavior = toTextBehavior(cls);
    if (textBehavior) node.textBehavior = textBehavior;
  }
  if (node.type === "image") {
    if (hasClass(cls, "object-cover")) node.assetFit = "cover";
    else if (hasClass(cls, "object-contain")) node.assetFit = "contain";
    else if (hasClass(cls, "object-fill")) node.assetFit = "fill";
    else if (hasClass(cls, "object-none")) node.assetFit = "none";
  }
  if (geom.x != null && geom.y != null && geom.w != null && geom.h != null) {
    node.bbox = [round2(geom.x), round2(geom.y), round2(geom.w), round2(geom.h)];
  } else if (geom.w != null && geom.h != null) {
    node.size = [round2(geom.w), round2(geom.h)]; // flex 흐름 자식: 위치는 layout이 결정, 크기만 기록
  }
  const constraints = toConstraints(geom.anchorX, geom.anchorY);
  if (constraints) node.constraints = constraints;

  const childContainer = { w: geom.w ?? container.w, h: geom.h ?? container.h };
  const childInherited = node.type === "text" ? null : textStyle;
  // 헬퍼 서브트리 안에서는 그 호출부 props/파생 바인딩이 유효
  const children = el.children.map((c) => compile(c, childContainer, childInherited, props, derived)).filter(Boolean);
  if (children.length) node.children = children;

  // 정보 없는 순수 래퍼(이름·id·스타일·레이아웃·좌표 전무 + 자식 1)는 접기 (rules §2 무손실 접기)
  if (!el.name && !el.nodeId && !node.style && !node.layout && !node.sizing && !node.behavior && !node.bbox && !node.constraints && node.type === "frame" && children.length === 1) {
    return children[0];
  }
  return node;
}

const rootEl = findRoot(mainTree) ?? mainTree[0];
function findRoot(tree) {
  for (const el of tree) {
    if (el.nodeId === cache.nodeId) return el;
    const sub = findRoot(el.children);
    if (sub) return sub;
  }
  return null;
}

const rootNode = compile(rootEl, { w: cache.rootFrame?.w ?? null, h: cache.rootFrame?.h ?? null }, null, null, null);
const out = {
  meta: { source: "design-context-to-bridge", input: target, nodeId: cache.nodeId ?? null },
  assets: [...usedAssets.values()].map((a) => ({
    id: a.id, kind: /\.svg|vector/i.test(a.id) ? "vector" : "image",
    export: a.url, format: "png",
  })),
  nodes: [rootNode],
};

console.log(pretty ? JSON.stringify(out, null, 2) : JSON.stringify(out));
const count = (n) => 1 + (n.children ?? []).reduce((s, c) => s + count(c), 0);
console.error(`노드 ${count(rootNode)}개, 에셋 ${out.assets.length}개, constraints ${JSON.stringify(out).match(/"constraints"/g)?.length ?? 0}개`);
