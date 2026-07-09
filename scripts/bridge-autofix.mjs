#!/usr/bin/env node
// 브릿지 bbox 자동 보정 — validate-bridge.mjs의 §9-1 수치 진실성 경고를 스크린샷 기준으로
// 실제로 고친다. 지금까지는 검증기가 "의심"만 표시하고 실제 보정(좌표 재계산)은 사람이 손으로
// 했다 — 이 스크립트가 그 손보정 절차를 기계화한다 (rules §9 자가검증 재시도 루프의 구체화).
//
// 절차:
//  1. 오토레이아웃 산술 불변식 위반(hug 축) → 계산된 기대값으로 bbox 크기를 직접 치환
//     (포뮬러 기반, 100% 결정론적. 예: header-bar 42→62)
//  2. 자체 solid fill이 있는 노드가 선언 위치에서 벗어나 있으면 → 부모 영역 안에서 같은 색의
//     연결영역(connected component)을 찾아, 크기가 declared와 비슷하고 declared 위치에 가장
//     가까운 후보로 bbox를 치환 (색상+크기 사전 매칭). 예: add-card, message-card, 칩 위치
//  3. fill이 없는(stroke만 있는) 노드는 확신 없어 손대지 않는다(발명 금지 원칙, §11 대원칙과 동일)
//  4. 고친 노드는 reconciliation.discrepancies[]에 근거를 남기고, 재조합(§8-1) 서브트리는
//     confidence(0.7)가 없으면 부여한다.
//
// 사용: node scripts/bridge-autofix.mjs <bridge.json>
//   compact로 재저장(rules §14). 실행 후 validate-bridge.mjs로 재검증할 것.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { PNG } from "pngjs";

const target = process.argv[2];
if (!target) {
  console.error("사용법: node scripts/bridge-autofix.mjs <bridge.json>");
  process.exit(1);
}

const data = JSON.parse(readFileSync(target, "utf8"));
const fixes = [];
const skipped = [];

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
function opaqueRgb(color) {
  const v = resolveValue(color);
  if (typeof v !== "string") return null;
  const m = /^#([0-9a-fA-F]{6})$/.exec(v.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function ownFillRgb(node) {
  const f = (node.style?.fills ?? []).find((f) => f?.type === "solid");
  return f ? opaqueRgb(f.color) : null;
}

// ── 1. 오토레이아웃 산술 보정 (결정론) ─────────────────────
function fixAutoLayoutArithmetic(node, path) {
  const L = node.layout;
  if (!L || !["row", "column"].includes(L.mode) || !Array.isArray(node.bbox)) return;
  const kids = (node.children ?? []).filter((c) => Array.isArray(c.bbox));
  if (!kids.length) return;
  const pad = Array.isArray(L.padding) ? L.padding : [0, 0, 0, 0];
  const gap = typeof resolveValue(L.gap) === "number" ? resolveValue(L.gap) : 0;
  const rowPrimary = L.mode === "row";
  const axes = [
    { name: "horizontal", dim: 2, padSum: pad[1] + pad[3], primary: rowPrimary },
    { name: "vertical", dim: 3, padSum: pad[0] + pad[2], primary: !rowPrimary },
  ];
  for (const ax of axes) {
    if (L.sizing?.[ax.name] !== "hug") continue;
    let expected;
    if (ax.primary) {
      if (L.primaryAxisAlign === "space-between") continue; // gap이 파생값 — 산술 판정 불가
      expected = ax.padSum + kids.reduce((s, c) => s + c.bbox[ax.dim], 0) + gap * (kids.length - 1);
    } else {
      expected = ax.padSum + Math.max(...kids.map((c) => c.bbox[ax.dim]));
    }
    const before = node.bbox[ax.dim];
    if (Math.abs(expected - before) > 2) {
      node.bbox[ax.dim] = Math.round(expected);
      fixes.push({ path, node: node.name, field: `bbox[${ax.dim}](${ax.name})`, before, after: node.bbox[ax.dim], method: "auto-layout-arithmetic" });
    }
  }
}

// ── 2. 스크린샷 색상영역 보정 ───────────────────────────────
function pixelAt(png, x, y) {
  const cx = Math.min(png.width - 1, Math.max(0, x | 0));
  const cy = Math.min(png.height - 1, Math.max(0, y | 0));
  const i = (cy * png.width + cx) * 4;
  return [png.data[i], png.data[i + 1], png.data[i + 2]];
}
function colorDelta(a, b) {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}

// parentRect(px, [x,y,w,h]) 안에서 targetRgb와 비슷한 색의 연결영역들을 찾는다.
function findColorRegions(png, rect, targetRgb, tol = 10) {
  const [rx, ry, rw, rh] = rect.map((v) => Math.max(0, Math.round(v)));
  const W = Math.max(1, Math.min(rw, png.width - rx));
  const H = Math.max(1, Math.min(rh, png.height - ry));
  const visited = new Uint8Array(W * H);
  const match = (lx, ly) => colorDelta(pixelAt(png, rx + lx, ry + ly), targetRgb) <= tol;
  const regions = [];
  for (let ly = 0; ly < H; ly++) {
    for (let lx = 0; lx < W; lx++) {
      const idx = ly * W + lx;
      if (visited[idx] || !match(lx, ly)) continue;
      const stack = [[lx, ly]];
      visited[idx] = 1;
      let minX = lx, maxX = lx, minY = ly, maxY = ly, count = 0;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        count++;
        if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
        const neighbors = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const nidx = ny * W + nx;
          if (visited[nidx] || !match(nx, ny)) continue;
          visited[nidx] = 1;
          stack.push([nx, ny]);
        }
      }
      if (count >= 25) regions.push({ x: rx + minX, y: ry + minY, w: maxX - minX + 1, h: maxY - minY + 1, area: count });
    }
  }
  return regions;
}

// node의 declared bbox(부모 상대) 대신, 부모 영역 안에서 같은 색의 위치를 실측해 correction을 낸다.
// 반환: null(확신 없음/이미 일치) 또는 { newBbox, before, movedPx }
function fixByColorRegion(node, parentAbsX, parentAbsY, screenshot, ancestorFill, siblings) {
  if (!Array.isArray(node.bbox) || node.bbox[2] < 15 || node.bbox[3] < 15) return null;
  const rgb = ownFillRgb(node);
  if (!rgb) return null; // stroke만 있는 노드는 확신 없어 스킵(§3 발명 금지 원칙)

  // 가드 1: fill이 조상 배경과 구분되지 않으면(예: 흰 배경 위 흰 요소) 색상영역 탐색이 무의미하다.
  if (ancestorFill && colorDelta(rgb, ancestorFill) <= 8) return null;

  // 가드 2: 같은 색·비슷한 크기의 형제가 여러 개면(예: 카드 3장 전부 흰색·205×162) 위치만으로
  // 어느 후보가 이 노드인지 구분할 수 없다 — 잘못된 후보를 확신 있게 고르는 것보다 안 고치는 게 낫다.
  const declaredArea0 = node.bbox[2] * node.bbox[3];
  const sameClassSiblings = (siblings ?? []).filter((s) => {
    if (!Array.isArray(s.bbox)) return false;
    const sRgb = ownFillRgb(s);
    if (!sRgb || colorDelta(sRgb, rgb) > 8) return false;
    const ratio = (s.bbox[2] * s.bbox[3]) / declaredArea0;
    return ratio > 0.7 && ratio < 1.4;
  });
  if (sameClassSiblings.length > 1) return null;

  const { png, scale, parentPxRect } = screenshot;
  const declaredAbs = [parentAbsX + node.bbox[0], parentAbsY + node.bbox[1], node.bbox[2], node.bbox[3]];
  const regions = findColorRegions(png, parentPxRect, rgb);
  if (!regions.length) return null;

  const [dpx, dpy, dpw, dph] = [declaredAbs[0] * scale, declaredAbs[1] * scale, declaredAbs[2] * scale, declaredAbs[3] * scale];
  const declaredArea = dpw * dph;
  const candidates = regions.filter((r) => {
    const ratio = (r.w * r.h) / declaredArea;
    return ratio > 0.5 && ratio < 2.0;
  });
  if (!candidates.length) return null;

  const dCenterX = dpx + dpw / 2, dCenterY = dpy + dph / 2;
  candidates.sort((a, b) => {
    const da = Math.hypot(a.x + a.w / 2 - dCenterX, a.y + a.h / 2 - dCenterY);
    const db = Math.hypot(b.x + b.w / 2 - dCenterX, b.y + b.h / 2 - dCenterY);
    return da - db;
  });
  const best = candidates[0];
  const foundAbsX = best.x / scale, foundAbsY = best.y / scale, foundW = best.w / scale, foundH = best.h / scale;
  const movedPx = Math.hypot(foundAbsX - declaredAbs[0], foundAbsY - declaredAbs[1]);
  if (movedPx < 3) return null; // 이미 일치 — 손대지 않음

  return {
    newBbox: [
      Math.round(foundAbsX - parentAbsX),
      Math.round(foundAbsY - parentAbsY),
      Math.round(foundW),
      Math.round(foundH),
    ],
    before: [...node.bbox],
    movedPx: Math.round(movedPx),
  };
}

// ── 스크린샷 로드 ────────────────────────────────────────────
const projRoot = resolve(dirname(resolve(target)), "..", "..");
function loadScreenshot(screen) {
  const shotAsset = (data.assets ?? []).find((a) => a.id === screen.screenshot);
  if (!shotAsset?.export) return null;
  const p = [join(projRoot, shotAsset.export), resolve(shotAsset.export)].find((x) => existsSync(x));
  if (!p) return null;
  const png = PNG.sync.read(readFileSync(p));
  const scale = screen.frame?.w ? png.width / screen.frame.w : 1;
  return { png, scale };
}

// ── 재귀 순회 (부모 먼저 처리 — 자식은 항상 부모 상대좌표) ──
function walkChildren(parent, parentPath, parentAbsX, parentAbsY, shot, lowTrustParent, ancestorFill) {
  const siblings = parent.children ?? [];
  for (const [i, node] of siblings.entries()) {
    const path = `${parentPath}.children[${i}]`;
    fixAutoLayoutArithmetic(node, path);

    let absX = parentAbsX + (node.bbox?.[0] ?? 0);
    let absY = parentAbsY + (node.bbox?.[1] ?? 0);
    const isLowTrust = lowTrustParent || typeof node.confidence === "number";
    const nodeOwnFill = ownFillRgb(node);

    if (shot && Array.isArray(node.bbox) && Array.isArray(parent.bbox)) {
      const parentPxRect = [parentAbsX * shot.scale, parentAbsY * shot.scale, parent.bbox[2] * shot.scale, parent.bbox[3] * shot.scale];
      const result = fixByColorRegion(
        node, parentAbsX, parentAbsY,
        { png: shot.png, scale: shot.scale, parentPxRect },
        ancestorFill,
        siblings.filter((s) => s !== node)
      );
      if (result) {
        node.bbox = result.newBbox;
        absX = parentAbsX + node.bbox[0];
        absY = parentAbsY + node.bbox[1];
        fixes.push({ path, node: node.name, field: "bbox", before: result.before, after: node.bbox, method: "screenshot-color-region", movedPx: result.movedPx });
        if (isLowTrust && typeof node.confidence !== "number") node.confidence = 0.7;
      } else if (!nodeOwnFill) {
        skipped.push({ path, node: node.name, reason: "fill 없음(stroke만) — 확신 없어 보류" });
      }
    }

    if (node.children) walkChildren(node, path, absX, absY, shot, isLowTrust, nodeOwnFill ?? ancestorFill);
  }
}

for (const [si, screen] of (data.screens ?? []).entries()) {
  const shot = loadScreenshot(screen);
  if (!shot) { console.warn(`[screens[${si}]] 스크린샷 없음 — 오토레이아웃 산술 보정만 수행`); }
  for (const [ni, root] of (screen.nodes ?? []).entries()) {
    const path = `screens[${si}].nodes[${ni}]`;
    fixAutoLayoutArithmetic(root, path);
    walkChildren(root, path, 0, 0, shot, typeof root.confidence === "number", ownFillRgb(root));
  }
}

// ── reconciliation 기록 + 저장 ──────────────────────────────
if (fixes.length) {
  for (const screen of data.screens ?? []) {
    screen.reconciliation ??= { status: "match", discrepancies: [] };
    screen.reconciliation.discrepancies ??= [];
    screen.reconciliation.discrepancies.push({
      kind: "position-mismatch",
      detail: `bridge-autofix.mjs 자동 보정 ${fixes.length}건: ` + fixes.map((f) => `${f.node ?? f.path}.${f.field} ${JSON.stringify(f.before)}→${JSON.stringify(f.after)}(${f.method})`).join("; "),
      resolved: true,
      resolution: "re-extract",
    });
  }
  writeFileSync(target, JSON.stringify(data) + "\n"); // compact — rules §14
}

console.log(`보정 ${fixes.length}건:`);
for (const f of fixes) console.log(`  - ${f.path} '${f.node ?? ""}' .${f.field}: ${JSON.stringify(f.before)} → ${JSON.stringify(f.after)} [${f.method}]${f.movedPx ? ` (${f.movedPx}px 이동)` : ""}`);
if (!fixes.length) console.log("  (없음 — 이미 일치하거나 확신 있는 보정 대상 없음)");
if (skipped.length) {
  console.log(`\n보류 ${skipped.length}건 (확신 없어 손대지 않음 — 사람/vision 확인 필요):`);
  for (const s of skipped) console.log(`  - ${s.path} '${s.node ?? ""}' — ${s.reason}`);
}
