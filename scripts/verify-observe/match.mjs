// 매칭(다리 A) — 느슨하게 짝짓고(위치는 동점 해소용), 엄격한 채점은 judge가 한다.
// 매칭 단계에서 위치를 자격 조건으로 쓰면 크게 어긋난 요소(가장 심한 버그)가
// "누락"으로 오진되므로, 위치는 후보가 여럿일 때의 동점 해소에만 쓴다.

export const contains = (a, b) => a.enter < b.enter && a.exit > b.exit;
const center = (r) => [r[0] + r[2] / 2, r[1] + r[3] / 2];
const dist = (r1, r2) => Math.hypot(center(r1)[0] - center(r2)[0], center(r1)[1] - center(r2)[1]);

// 리프 매칭: 텍스트는 내용(직속 → deepText 폴백), 이미지는 자산 파일명.
// 반복 텍스트("삭제"×3 등)는 전역 그리디 — (리프, 후보) 쌍을 거리순으로 할당한다.
export function matchLeaves(leaves, elements) {
  const pairs = [];
  for (const lf of leaves) {
    if (lf.kind === "text") {
      if (!lf.content) continue;
      let cands = elements.filter((o) => o.ownText === lf.content);
      let method = "own-text";
      if (!cands.length) {
        // Figma 텍스트 노드 하나가 코드에서 span+a 등으로 쪼개진 경우:
        // 자손 포함 텍스트가 내용을 담는 "가장 안쪽" 요소로 특정한다.
        // JSX는 요소 사이 줄바꿈 공백을 제거하므로("없나요?회원가입") 공백 무시로 비교한다.
        const key = lf.content.replaceAll(" ", "");
        const containing = elements.filter((o) => o.deepText.replaceAll(" ", "").includes(key));
        cands = containing.filter((o) => !containing.some((x) => x !== o && contains(o, x)));
        method = "deep-text";
      }
      for (const c of cands) pairs.push({ lf, el: c, d: dist(lf.abs, c.rect), method });
    } else {
      if (!lf.assetBase) continue;
      for (const c of elements.filter((o) => o.tag === "img" && o.src === lf.assetBase)) {
        pairs.push({ lf, el: c, d: dist(lf.abs, c.rect), method: "asset" });
      }
    }
  }
  pairs.sort((a, b) => a.d - b.d);
  const matched = new Map();
  const usedEl = new Set();
  for (const p of pairs) {
    if (matched.has(p.lf) || usedEl.has(p.el.i)) continue;
    matched.set(p.lf, { el: p.el, d: p.d, method: p.method });
    usedEl.add(p.el.i);
  }
  const missing = leaves.filter((l) => !matched.has(l) && (l.content || l.assetBase));
  const unmatchable = leaves.filter((l) => !l.content && !l.assetBase); // 단서 없는 리프 — 커버리지에 표기
  const stats = {};
  for (const m of matched.values()) stats[m.method] = (stats[m.method] ?? 0) + 1;
  return { matched, missing, unmatchable, stats };
}

// 컨테이너 유도: 컨테이너의 정체성은 내용물이 정의한다 — 매칭된 자손 리프를 전부 담고
// 밖의 매칭 리프는 담지 않는 후보들(중첩 사슬) 중, 기대 bbox와 IoU가 가장 큰 요소를 고른다.
// IoU 동점 해소가 없으면 래퍼 레벨 모호성으로 부모·자식이 같은 요소로 유도되는 오탐이 생긴다.
export function deriveContainers(containers, leaves, matched, elements) {
  const derived = new Map();
  for (const c of containers) {
    const inside = leaves
      .filter((l) => l.path.startsWith(c.path + ".") && matched.has(l))
      .map((l) => matched.get(l).el);
    if (inside.length < 2) continue; // 리프 1개로는 컨테이너 오특정 위험 — 미유도(커버리지에 표기)
    const outside = leaves
      .filter((l) => !l.path.startsWith(c.path + ".") && matched.has(l))
      .map((l) => matched.get(l).el);
    const enclosing = elements.filter((o) => inside.every((d) => contains(o, d)));
    const clean = enclosing.filter((o) => !outside.some((d) => contains(o, d)));
    const pool = clean.length ? clean : enclosing;
    if (!pool.length) continue;
    pool.sort((a, b) => iou(c.abs, b.rect) - iou(c.abs, a.rect));
    derived.set(c.path, { el: pool[0], exact: !!clean.length, c });
  }
  return derived;
}

function iou(a, b) {
  const x1 = Math.max(a[0], b[0]);
  const y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[0] + a[2], b[0] + b[2]);
  const y2 = Math.min(a[1] + a[3], b[1] + b[3]);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a[2] * a[3] + b[2] * b[3] - inter;
  return union > 0 ? inter / union : 0;
}

// 기하 단위: 매칭된 리프와 유도된 컨테이너를 같은 자격으로 승격한다.
// (v1 교훈 — 리프끼리만 채점하면 컨테이너 단위 시프트가 채점 목록에서 빠진다)
export function buildUnits(leaves, matched, derived) {
  const units = new Map();
  for (const lf of leaves) {
    if (!matched.has(lf)) continue;
    units.set(lf.path, {
      kind: lf.kind,
      abs: lf.abs,
      rect: matched.get(lf).el.rect,
      el: matched.get(lf).el,
      label: (lf.content ?? lf.assetBase ?? lf.name ?? "").slice(0, 18),
    });
  }
  for (const [path, d] of derived) {
    units.set(path, {
      kind: "container",
      abs: d.c.abs,
      rect: d.el.rect,
      el: d.el,
      label: `⧉${d.c.name ?? path}`.slice(0, 18),
    });
  }
  return units;
}
