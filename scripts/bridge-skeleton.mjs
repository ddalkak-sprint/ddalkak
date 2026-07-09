#!/usr/bin/env node
// 원시 get_metadata 캐시에서 bbox 트리(스켈레톤)를 결정론적으로 추출한다 (rules §8-2).
//
// 목적: 좌표·크기 수치가 LLM의 전사를 거치며 오염되는 것을 구조적으로 차단한다.
// extractor(LLM)는 이 스켈레톤의 수치를 그대로 병합하고 덮어쓰지 않는다. 스켈레톤에
// 없는 서브트리(metadataLeaf 인스턴스 내부)만 LLM이 채우며, 그 서브트리는 rules §8-1의
// confidence 마킹 대상이다.
//
// 사용: node scripts/bridge-skeleton.mjs <cacheDir> [--out <file>]
//   <cacheDir>/get_metadata.json (Figma MCP 원시 응답, XML 형식)을 읽어
//   부모 상대좌표로 변환한 JSON 트리를 stdout(또는 --out 파일)에 쓴다.
//
// 출력 형태:
//   { "source": "get_metadata", "roots": [ { id, figmaType, name, bbox:[x,y,w,h],
//       metadataLeaf?, children:[…] } ] }
//   - bbox: 루트는 [0,0,w,h], 자식은 부모 기준 상대좌표. metadata의 x/y는 이미
//     부모 상대좌표다(루트만 캔버스 좌표) — 변환 없이 그대로 쓴다. 실측 근거: pc-home의
//     Group 7 x=461(bottom 기준)을 이전 LLM 추출이 루트 좌표로 오해해 102로 "변환"한 것이
//     CTA 좌표 결함의 원인이었다. 좌표계 해석 자체를 기계에 고정하는 것이 이 스크립트의 존재 이유.
//   - metadataLeaf: 자식이 없는 instance — 내부 구조가 metadata에 없어 재조합이
//     필요한 노드. 이 목록이 곧 §8-1 저신뢰 후보다.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outFile = outIdx >= 0 ? args[outIdx + 1] : null;
const positional = args.filter((a, i) => i !== outIdx && i !== (outIdx >= 0 ? outIdx + 1 : -1));
const cacheDir = positional[0];

if (!cacheDir) {
  console.error("사용법: node scripts/bridge-skeleton.mjs <cacheDir> [--out <file>]");
  process.exit(1);
}
const metaPath = join(cacheDir, "get_metadata.json");
if (!existsSync(metaPath)) {
  console.error(`get_metadata.json 없음: ${metaPath}`);
  process.exit(1);
}
const xml = readFileSync(metaPath, "utf8");

// ── XML 파서 (metadata 형식 전용: 중첩/자기닫힘 태그 + 속성) ─
function decodeEntities(s) {
  return s
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
const TAG_RE = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[\w-]+="[^"]*")*)\s*(\/?)>/g;
const ATTR_RE = /([\w-]+)="([^"]*)"/g;

const roots = [];
const stack = [];
let m;
while ((m = TAG_RE.exec(xml)) !== null) {
  const [, closing, tag, attrText, selfClose] = m;
  if (closing) {
    stack.pop();
    continue;
  }
  const attrs = {};
  let a;
  while ((a = ATTR_RE.exec(attrText)) !== null) attrs[a[1]] = decodeEntities(a[2]);
  const node = {
    id: attrs.id,
    figmaType: tag,
    name: attrs.name,
    // metadata의 x/y는 부모 상대좌표 — 그대로 쓴다 (루트만 캔버스 좌표라 finalize에서 0으로)
    bbox: [Number(attrs.x ?? 0), Number(attrs.y ?? 0), Number(attrs.width ?? 0), Number(attrs.height ?? 0)],
    _raw: [Number(attrs.x ?? 0), Number(attrs.y ?? 0)], // group 좌표공간 보정용 원시 좌표
    children: [],
  };
  if (stack.length === 0) roots.push(node);
  else stack[stack.length - 1].children.push(node);
  if (!selfClose) stack.push(node);
}

// ── 루트 캔버스 좌표 제거 + group 좌표공간 보정 + metadataLeaf 마킹 ─
// Figma group의 자식은 group이 아니라 그 바깥 프레임 기준 좌표를 갖는다(공유 좌표공간).
// 기계 판별: 부모 상대좌표로 해석하면 부모를 크게 벗어나는데, 부모 원점을 빼면 들어맞는
// 자식은 공유 좌표공간으로 보고 변환한다. 변환한 노드에는 coordSpace를 남겨 추적 가능하게.
function fitsIn(bbox, pw, ph, tol = 4) {
  return bbox[0] >= -tol && bbox[1] >= -tol && bbox[0] + bbox[2] <= pw + tol && bbox[1] + bbox[3] <= ph + tol;
}
function finalize(node, isRoot) {
  if (isRoot) { node.bbox[0] = 0; node.bbox[1] = 0; }
  const [pw, ph] = [node.bbox[2], node.bbox[3]];
  for (const c of node.children) {
    if (!fitsIn(c.bbox, pw, ph)) {
      // group 공유 좌표공간 해석: 자식 좌표에서 부모의 원시 좌표를 뺀다
      const gx = c.bbox[0] - node._raw[0];
      const gy = c.bbox[1] - node._raw[1];
      if (fitsIn([gx, gy, c.bbox[2], c.bbox[3]], pw, ph)) {
        c.bbox[0] = gx; c.bbox[1] = gy;
        c.coordSpace = "shared-with-parent"; // Figma group 자식 — 변환 이력 표시
      }
    }
  }
  delete node._raw;
  if (node.figmaType === "instance" && node.children.length === 0) {
    node.metadataLeaf = true; // 내부가 metadata에 없음 → 재조합 필요 → §8-1 confidence 대상
  }
  if (node.children.length === 0) delete node.children;
  else for (const c of node.children) finalize(c, false);
}
for (const r of roots) finalize(r, true);

const result = { source: "get_metadata", cacheDir, roots };
const json = JSON.stringify(result, null, 2);
if (outFile) {
  writeFileSync(outFile, json + "\n");
  console.log(`스켈레톤 저장: ${outFile}`);
} else {
  console.log(json);
}

// 요약 (stderr — 파이프해도 JSON 안 섞임)
let total = 0, leaves = [];
(function count(ns) {
  for (const n of ns ?? []) { total++; if (n.metadataLeaf) leaves.push(`${n.name}(${n.id})`); count(n.children); }
})(roots);
console.error(`노드 ${total}개, 재조합 후보(metadataLeaf) ${leaves.length}개${leaves.length ? ": " + leaves.join(", ") : ""}`);
