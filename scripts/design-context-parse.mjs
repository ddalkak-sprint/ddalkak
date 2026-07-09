#!/usr/bin/env node
// get_design_context가 leaf 노드 개별 호출로 반환한 "code"(React+Tailwind 문자열)에서
// data-node-id별 절대 위치/크기를 결정론적으로 파싱한다 (rules §8-1/§8-2 — bridge-skeleton.mjs와
// 같은 원칙: 코드가 있으면 LLM이 좌표를 옮겨 적지 않고 기계가 뽑는다).
//
// 실측 근거: 전체 섹션 1회 호출은 codeSummary(좌표 없음)만 주지만, leaf 노드 ID로 개별 호출하면
// 실제 좌표가 박힌 Tailwind 코드가 온다 (예: `right-[257.28px]`, `size-[31.605px]`,
// `top-[calc(50%-45.43px)]` + `-translate-y-1/2`). 이 스크립트는 그 코드에서 각 요소의
// (부모 기준) [x, y, w, h]를 계산한다.
//
// 지원 패턴(Figma MCP가 실제로 내는 관용 표기 — 더 필요하면 이 목록을 넓힐 것):
//   w-[Npx] / h-[Npx] / size-[Npx]           — 크기
//   left-[Npx] / top-[Npx]                    — 직접 좌표
//   right-[Npx]  (w 필요)                     — left = 컨테이너 w − right − w
//   bottom-[Npx] (h 필요)                     — top  = 컨테이너 h − bottom − h
//   left-1/2 + -translate-x-1/2 (w 필요)      — left = (컨테이너 w − w) / 2  (가로 중앙)
//   top-[calc(50%-Npx)] + -translate-y-1/2 (h 필요) — top = 컨테이너 h/2 − N − h/2  (세로 중앙+오프셋)
//   className에 "contents" 포함              — 이 요소는 좌표 계산 기준(컨테이닝 블록)에서 제외
//     (display:contents는 박스를 만들지 않음 — 자식은 그 부모의 부모를 기준으로 계산)
//
// 사용: node scripts/design-context-parse.mjs <get_design_context 캐시 파일.json>
//   캐시 파일은 { "code": "<React 코드 문자열>", ... } 형태(rules §8-1 leaf 캡처 포맷).
//   출력: [{ nodeId, name, bbox:[x,y,w,h] (부모 기준), resolved: true|false }, ...] (stdout)

import { readFileSync } from "node:fs";

const target = process.argv[2];
if (!target) {
  console.error("사용법: node scripts/design-context-parse.mjs <get_design_context 캐시 파일.json>");
  process.exit(1);
}
const cache = JSON.parse(readFileSync(target, "utf8"));
const code = cache.code;
if (!code) {
  console.error("입력 파일에 'code' 필드가 없음 — 이 leaf는 코드 대신 codeSummary만 반환된 것 (rules §8-1, 개별 호출 안 됨)");
  process.exit(1);
}

// ── 아주 단순한 태그 스트림 파서 (JSX 서브셋: 열림/자기닫힘/닫힘 태그) ─
const TAG_RE = /<(\/?)([a-zA-Z][\w.]*)((?:[^<>]*?))(\/?)>/g;
// className="literal" | className={`literal`} | className={expr || "literal"} (JSX prop-passthrough
// fallback, 예: 루트 컴포넌트의 `className={className || "h-[204px] w-[720px]"}`) — 마지막 형태는
// "실제 렌더되는 기본 클래스"인 따옴표 문자열을 찾는다.
const ATTR_CLASS_RE = /className=(?:"([^"]*)"|\{`([^`]*)`\}|\{[^}]*?"([^"]*)"[^}]*?\})/;
const ATTR_NODE_ID_RE = /data-node-id="([^"]+)"/;
const ATTR_NAME_RE = /data-name="([^"]+)"/;

function px(className, key) {
  const m = new RegExp(`${key}-\\[([\\d.]+)px\\]`).exec(className);
  return m ? parseFloat(m[1]) : null;
}
function hasClass(className, token) {
  return new RegExp(`(^|\\s)${token}(\\s|$)`).test(className);
}
function calcOffset(className) {
  // top-[calc(50%-45.43px)] → 45.43
  const m = /top-\[calc\(50%-([\d.]+)px\)\]/.exec(className);
  return m ? parseFloat(m[1]) : null;
}

const results = [];
const stack = []; // { isBox, w, h } — isBox=false면 'contents'(박스 없음, 좌표계 전달만)

let m;
while ((m = TAG_RE.exec(code)) !== null) {
  const [, closing, tag, rest, selfClose] = m;
  if (closing) {
    if (stack.length) stack.pop();
    continue;
  }
  if (["script", "style"].includes(tag)) continue;

  const classMatch = ATTR_CLASS_RE.exec(rest);
  const className = classMatch ? (classMatch[1] ?? classMatch[2] ?? classMatch[3] ?? "") : "";
  const nodeId = ATTR_NODE_ID_RE.exec(rest)?.[1];
  const name = ATTR_NAME_RE.exec(rest)?.[1];

  // 컨테이닝 블록: stack에서 isBox인 가장 가까운 항목
  const container = [...stack].reverse().find((f) => f.isBox) ?? { w: null, h: null };

  let w = px(className, "w") ?? px(className, "size");
  let h = px(className, "h") ?? px(className, "size");

  let x = px(className, "left");
  if (x == null && hasClass(className, "left-1/2") && hasClass(className, "-translate-x-1/2") && w != null && container.w != null) {
    x = (container.w - w) / 2;
  }
  if (x == null) {
    const right = px(className, "right");
    if (right != null && w != null && container.w != null) x = container.w - right - w;
  }

  let y = px(className, "top");
  const centerOffset = calcOffset(className);
  if (centerOffset != null && hasClass(className, "-translate-y-1/2") && h != null && container.h != null) {
    y = container.h / 2 - centerOffset - h / 2;
  }
  if (y == null) {
    const bottom = px(className, "bottom");
    if (bottom != null && h != null && container.h != null) y = container.h - bottom - h;
  }

  const resolved = nodeId != null && x != null && y != null && w != null && h != null;
  if (nodeId) {
    results.push({
      nodeId, name,
      bbox: resolved ? [round2(x), round2(y), round2(w), round2(h)] : null,
      resolved,
      className,
    });
  }

  const isBox = w != null && h != null && !hasClass(className, "contents");
  if (!selfClose) stack.push({ isBox, w: isBox ? w : container.w, h: isBox ? h : container.h });
}

function round2(n) { return Math.round(n * 100) / 100; }

console.log(JSON.stringify(results, null, 2));
const unresolved = results.filter((r) => !r.resolved);
console.error(`\n총 ${results.length}개 노드, 미해결 ${unresolved.length}개${unresolved.length ? ": " + unresolved.map((r) => r.nodeId).join(", ") : ""}`);
