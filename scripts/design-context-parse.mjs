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
//   left/top-[calc(P%±Npx)] (translate 없이, w/h 무관)   — left = 컨테이너w × P/100 ± N (퍼센트+오프셋,
//     실측: 다른 파일의 카드 그리드가 `left-[calc(66.67%-104px)]`로 이렇게 옴 — 50%-중앙정렬과는 다른 케이스)
//   className에 "contents" 포함              — 이 요소는 좌표 계산 기준(컨테이닝 블록)에서 제외
//     (display:contents는 박스를 만들지 않음 — 자식은 그 부모의 부모를 기준으로 계산)
//   루트가 "size-full"/"w-full h-full"라 px 없음 — cache.rootFrame:{w,h}(get_metadata 프레임 크기)로 대체
//
// 사용: node scripts/design-context-parse.mjs <get_design_context 캐시 파일.json>
//   캐시 파일은 { "code": "<React 코드 문자열>", "rootFrame": {"w":..,"h":..} } 형태(rules §8-1 leaf 캡처 포맷).
//   출력: [{ nodeId, name, bbox:[x,y,w,h] (부모 기준), resolved: true|false }, ...] (stdout)
//
// 알려진 한계(현재 미지원 — 필요해지면 확장): flex 흐름으로만 배치된 자식(절대좌표 클래스 없음)은
// 애초에 좌표가 없는 게 맞다(브릿지 layout 필드로 표현 — bbox 생략 대상). grid(col-N/row-N) 배치,
// calc() 안에 곱셈/중첩 등 더 복잡한 식은 아직 안 푼다.

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
function calcPercent(className, key) {
  // left-[calc(66.67%-104px)] / left-[calc(33.33%+128px)] → { percent: 66.67, sign: -1, offset: 104 }
  // (50% 중앙+translate 패턴과는 별개 — translate 없이 그 자체로 최종 좌표인 경우)
  const m = new RegExp(`${key}-\\[calc\\(([\\d.]+)%([+-])([\\d.]+)px\\)\\]`).exec(className);
  if (!m) return null;
  return { percent: parseFloat(m[1]), sign: m[2] === "-" ? -1 : 1, offset: parseFloat(m[3]) };
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

  // 대상 루트 노드(cache.nodeId)가 "size-full"/"w-full h-full"라 px 클래스가 없는 경우 —
  // cache.rootFrame(get_metadata 프레임 크기)로 대체. 헬퍼 컴포넌트 함수가 코드 앞쪽에 먼저 나올 수
  // 있어 "첫 태그"가 아니라 **nodeId로 직접 매칭**한다(실측 버그: 첫 태그로 판정했다가 엉뚱한 헬퍼
  // 아이콘 div에 루트 크기를 씌운 적이 있음).
  if (nodeId === cache.nodeId) {
    if (w == null && cache.rootFrame?.w) w = cache.rootFrame.w;
    if (h == null && cache.rootFrame?.h) h = cache.rootFrame.h;
  }

  // "left"/"top"은 먼저 translate 없는 값(anchor)을 구하고, translate-*-1/2가 있으면 그 앵커가
  // "요소의 중심"이었다는 뜻이므로 마지막에 자기 크기의 절반을 빼 최종 좌표로 보정한다(rules §8-2
  // 원칙과 동일 — 조합을 특별 취급하지 않고 앵커+보정으로 통일해 실수를 줄인다. 실측으로 발견:
  // `left-[calc(50%-6px)]` + `-translate-x-1/2`를 이전엔 보정 없이 계산해 좌표가 반요소폭만큼 밀렸었음).
  //
  // 무손실(§4·§8-3): px 환산은 "이 프레임 크기에서의 값"일 뿐이다. 앵커가 퍼센트/반대변 기준이면
  // 그 원형(반응형 의도)을 anchorX/anchorY로 함께 내보낸다 — 환산하고 원형을 버리면 부모 리사이즈
  // 시의 동작(constraints)이 사라진다. 실측: 카드 그리드 `left-[calc(66.67%-104px)]`를 px로만
  // 저장했다가 반응형 정보가 브릿지에서 통째로 증발했던 결함의 재발 방지.
  const inset0 = hasClass(className, "inset-0");
  const left = px(className, "left") ?? (hasClass(className, "left-0") || inset0 ? 0 : null);
  const right = px(className, "right") ?? (hasClass(className, "right-0") || inset0 ? 0 : null);
  let x = left;
  let anchorX = null; // 원형이 plain left px면 bbox가 이미 전부라 생략
  if (left != null && right != null && container.w != null) {
    x = left;
    w = container.w - left - right;
    anchorX = { kind: "stretch", start: left, end: right };
  } else if (x == null && right != null && w != null && container.w != null) {
    x = container.w - right - w;
    anchorX = { kind: "opposite", offset: right };
  }
  if (x == null && hasClass(className, "left-1/2") && container.w != null) {
    x = container.w / 2;
    anchorX = { kind: "percent", percent: 50, offset: 0 };
  }
  if (x == null && container.w != null) {
    const pct = calcPercent(className, "left");
    if (pct) {
      x = (container.w * pct.percent) / 100 + pct.sign * pct.offset;
      anchorX = { kind: "percent", percent: pct.percent, offset: pct.sign * pct.offset };
    }
  }
  // translate 플래그는 클래스가 있으면 무조건 기록(무손실) — 수치 보정은 w를 알 때만 가능
  if (hasClass(className, "-translate-x-1/2")) {
    if (x != null && w != null) x -= w / 2;
    if (anchorX) anchorX.translate = true;
  }

  const top = px(className, "top") ?? (hasClass(className, "top-0") || inset0 ? 0 : null);
  const bottom = px(className, "bottom") ?? (hasClass(className, "bottom-0") || inset0 ? 0 : null);
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
  if (y == null && hasClass(className, "top-1/2") && container.h != null) {
    y = container.h / 2;
    anchorY = { kind: "percent", percent: 50, offset: 0 };
  }
  if (y == null && container.h != null) {
    const pct = calcPercent(className, "top");
    if (pct) {
      y = (container.h * pct.percent) / 100 + pct.sign * pct.offset;
      anchorY = { kind: "percent", percent: pct.percent, offset: pct.sign * pct.offset };
    }
  }
  if (hasClass(className, "-translate-y-1/2")) {
    if (y != null && h != null) y -= h / 2;
    if (anchorY) anchorY.translate = true;
  }

  const resolved = nodeId != null && x != null && y != null && w != null && h != null;
  if (nodeId) {
    const constraints = toConstraints(anchorX, anchorY);
    results.push({
      nodeId, name,
      bbox: resolved ? [round2(x), round2(y), round2(w), round2(h)] : null,
      resolved,
      ...(constraints ? { constraints } : {}),
      className,
    });
  }

  const isBox = w != null && h != null && !hasClass(className, "contents");
  if (!selfClose) stack.push({ isBox, w: isBox ? w : container.w, h: isBox ? h : container.h });
}

function round2(n) { return Math.round(n * 100) / 100; }

// 앵커 원형 → bridge 스키마 constraints (rules §5 / §8-3). 축 매핑:
//   percent 50 + translate → "center" (Figma 중앙 고정)
//   그 외 percent          → "scale"  (부모 크기에 비례)
//   opposite(right/bottom) → "right"/"bottom"
//   stretch(start/end)     → "left-right"/"top-bottom"
//   plain left/top px      → 생략 (기본값, bbox가 전부)
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

console.log(JSON.stringify(results, null, 2));
const unresolved = results.filter((r) => !r.resolved);
console.error(`\n총 ${results.length}개 노드, 미해결 ${unresolved.length}개${unresolved.length ? ": " + unresolved.map((r) => r.nodeId).join(", ") : ""}`);
