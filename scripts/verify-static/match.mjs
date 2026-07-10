// 매칭 — 1단 data-dk(결정론) → 2단 폴백. 후보 2개 이상이면 즉시 match_failure. (규칙 SSOT: §4)
import { basename } from "node:path";
import { ctx } from "./context.mjs";
import { elementsOf } from "./jsx-scan.mjs";

function findByDataDk(nodeId, files) {
  const hits = [];
  for (const f of files) for (const el of elementsOf(f)) if (el.dkValues.includes(nodeId)) hits.push(el);
  return hits;
}

function findByContent(content, files) {
  const hits = [];
  for (const f of files) for (const el of elementsOf(f)) if (el.ownText && el.ownText.includes(content)) hits.push(el);
  return hits;
}

function findImages(files, assetBasename = null) {
  const hits = [];
  for (const f of files)
    for (const el of elementsOf(f))
      if (el.tag === "img" && (assetBasename == null || el.srcBasename === assetBasename)) hits.push(el);
  return hits;
}

function componentFilesFor(mappedOrName) {
  const prefix = mappedOrName.includes("/")
    ? mappedOrName.replace(/\/+$/, "")
    : `src/components/${mappedOrName}`;
  const files = ctx.planTsx.filter((p) => p === `${prefix}.tsx` || p.startsWith(`${prefix}/`));
  if (files.length) return files;
  return ctx.allSrcTsx.filter((p) => p === `${prefix}.tsx` || p.startsWith(`${prefix}/`));
}

// group/instance 폴백: 유일 텍스트 앵커(자손 content)들을 모두 감싸는 가장 안쪽 요소
function collectAnchors(node, acc = []) {
  for (const child of node.children ?? []) {
    if (child.type === "text" && typeof child.content === "string") acc.push(child.content.trim());
    collectAnchors(child, acc);
  }
  return acc;
}

// 앵커 하나를 deepText 포함으로 찾되, 그 앵커를 포함하는 "가장 안쪽" 요소로 특정한다.
// (부모들도 전부 포함하므로 innermost가 유일해야 결정론적)
function findAnchorInnermost(anchor, files) {
  const containing = [];
  for (const f of files)
    for (const el of elementsOf(f)) if (el.deepText && el.deepText.includes(anchor)) containing.push(el);
  if (!containing.length) return { missing: true };
  const innermost = containing.filter((el) => !containing.some((o) => o !== el && o.start >= el.openEnd && o.end <= el.closeStart));
  if (innermost.length !== 1) return { ambiguous: innermost.length };
  return { element: innermost[0] };
}

function matchGroup(check, files) {
  const anchors = [...new Set(collectAnchors(check.node))];
  if (!anchors.length) return { failure: "매칭 앵커 없음 (data-dk 필요)" };
  // 못 찾은 앵커는 건너뛴다(그 텍스트 노드 자체의 체크가 별도로 잡는다). 중복 앵커는 모호 → 실패.
  const anchorEls = [];
  const misses = [];
  for (const a of anchors) {
    const r = findAnchorInnermost(a, files);
    if (r.missing) { misses.push(a); continue; }
    if (r.ambiguous) return { failure: `앵커 "${a}" 후보 ${r.ambiguous}개 — 모호` };
    anchorEls.push(r.element);
  }
  if (!anchorEls.length)
    return { failure: `앵커 전부 미발견 (${misses.slice(0, 2).map((a) => `"${a}"`).join(", ")}${misses.length > 2 ? " 외" : ""}) — data-dk 필요` };
  // 앵커 1개로는 "그 텍스트의 가장 안쪽 래퍼"가 뽑혀 컨테이너를 오특정한다 → 2개 미만이면 미판정
  if (anchorEls.length < 2)
    return { failure: `앵커 1개(발견 ${anchorEls.length}/${anchors.length}) — 컨테이너 특정 불가, data-dk 필요` };
  const file = anchorEls[0].file;
  if (anchorEls.some((e) => e.file !== file)) return { failure: "앵커들이 여러 파일에 분산" };
  const enclosing = elementsOf(file).filter((el) =>
    anchorEls.every((a) => a !== el && a.start >= el.openEnd && a.end <= el.closeStart),
  );
  if (!enclosing.length) return { failure: "공통 조상 요소 없음" };
  enclosing.sort((a, b) => b.openEnd - a.openEnd); // 가장 안쪽
  return { element: enclosing[0] };
}

export function matchCheck(check) {
  const files = ctx.planTsx;
  // 1단: data-dk (모든 인스턴스 nodeId 허용).
  // 탐색 범위는 plan 파일로 한정 — 노드 경로(screens[0]...)는 브릿지마다 같은 네임스페이스라
  // 다른 화면의 파일까지 뒤지면 서로 다른 브릿지의 data-dk가 충돌한다.
  // 1단: node.id(Figma 고유 id) 우선 — 파일 전체에서 유일해 오배달이 불가능한 안정 앵커.
  // 코드(data-dk="14:2204" 등)를 결정론(high)으로 매칭한다. id 없는 노드(v1.1 목업 등)는
  // figmaId가 undefined이므로 스킵되어 아래 위치경로 폴백으로 넘어간다.
  if (check.figmaId) {
    const hits = findByDataDk(check.figmaId, files);
    if (hits.length === 1) return { scope: "element", element: hits[0], method: "data-dk", confidence: "high" };
    if (hits.length > 1) return { failure: `data-dk="${check.figmaId}" 중복 — 모호`, method: "data-dk" };
  }
  // 1단(폴백): 위치 경로(screens[0]...) — node.id 없는 노드용. 화면끼리 네임스페이스가 겹쳐
  // 오배달 위험이 있으므로, node.id가 있으면 위에서 이미 안전하게 처리된 뒤에만 여기 온다.
  for (const nid of check.instanceNodeIds) {
    const hits = findByDataDk(nid, files);
    if (hits.length === 1) return { scope: "element", element: hits[0], method: "data-dk", confidence: "high" };
    if (hits.length > 1) return { failure: `data-dk="${nid}" 중복 — 모호`, method: "data-dk" };
  }
  // 2단: 폴백
  const { kind, mappedCodeComponent, suggestedComponent, content, assetRef } = check.target;
  const comp = mappedCodeComponent || suggestedComponent;
  if (comp) {
    const compFiles = componentFilesFor(comp);
    if (!compFiles.length) return { failure: `컴포넌트 파일 미발견: ${comp}`, method: "fallback-component" };
    return { scope: "file", files: compFiles, method: "fallback-component", confidence: "low" };
  }
  if (kind === "text" && content) {
    let hits = findByContent(content, files);
    let deviated = false;
    if (hits.length === 0 && ctx.fallbackTsx.length) {
      hits = findByContent(content, ctx.fallbackTsx);
      deviated = hits.length > 0;
    }
    if (hits.length === 0) return { failure: `텍스트 "${content}" 미발견`, method: "fallback-content" };
    if (hits.length > 1) return { failure: `텍스트 "${content}" 후보 ${hits.length}개 — 모호`, method: "fallback-content" };
    if (deviated) ctx.planDeviations.push(`텍스트 "${content}"가 계획 외 파일 ${hits[0].file}에서 발견`);
    return { scope: "element", element: hits[0], method: "fallback-content", confidence: "low" };
  }
  if (kind === "image" || kind === "vector") {
    const assetBase = assetRef
      ? basename((ctx.bridge.assets ?? []).find((a) => a.id === assetRef)?.export ?? assetRef)
      : null;
    let hits = findImages(files, assetBase);
    if (hits.length === 0 && ctx.fallbackTsx.length) hits = findImages(ctx.fallbackTsx, assetBase);
    if (hits.length === 0 && assetBase == null) return { failure: "img 요소 미발견", method: "fallback-asset" };
    if (hits.length === 0) return { failure: `자산 "${assetBase}" 사용 img 미발견`, method: "fallback-asset" };
    if (hits.length > 1) return { failure: `자산 "${assetBase ?? "img"}" 후보 ${hits.length}개 — 모호`, method: "fallback-asset" };
    return { scope: "element", element: hits[0], method: "fallback-asset", confidence: "low" };
  }
  if (kind === "group" || kind === "frame" || kind === "instance" || kind === "component") {
    const res = matchGroup(check, files);
    if (res.failure) return { failure: res.failure, method: "fallback-content" };
    return { scope: "element", element: res.element, method: "fallback-content", confidence: "low" };
  }
  return { failure: "폴백 매칭 단서 없음 (data-dk 필요)", method: "none" };
}
