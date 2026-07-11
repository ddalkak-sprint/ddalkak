// 매칭(다리 A) — 느슨하게 짝짓고(위치는 동점 해소용), 엄격한 채점은 judge가 한다.
// 매칭 단계에서 위치를 자격 조건으로 쓰면 크게 어긋난 요소(가장 심한 버그)가
// "누락"으로 오진되므로, 위치는 후보가 여럿일 때의 동점 해소에만 쓴다.

export const contains = (a, b) => a.enter < b.enter && a.exit > b.exit;
const center = (r) => [r[0] + r[2] / 2, r[1] + r[3] / 2];
const dist = (r1, r2) => Math.hypot(center(r1)[0] - center(r2)[0], center(r1)[1] - center(r2)[1]);

// 리프 매칭: 텍스트는 내용(직속 → placeholder → deepText 폴백), 이미지는 자산 파일명.
// 반복 텍스트("삭제"×3 등)는 전역 그리디 — (리프, 후보) 쌍을 거리순으로 할당한다.
export function matchLeaves(leaves, elements) {
  const pairs = [];
  for (const lf of leaves) {
    if (lf.kind === "text") {
      if (!lf.content) continue;
      let cands = elements.filter((o) => o.ownText === lf.content);
      let method = "own-text";
      if (!cands.length) {
        // Figma 텍스트가 DOM 텍스트 노드가 아니라 input placeholder 속성으로 렌더된 경우
        cands = elements.filter((o) => o.placeholder === lf.content);
        method = "placeholder";
      }
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

// 유도 동점 해소용 크기 유사도. IoU가 아닌 이유: IoU는 위치가 어긋나면 0이 되는데,
// 위치 어긋남은 우리가 "잡아야 할 대상"이지 매칭 자격이 아니다(매칭은 느슨하게 원칙).
// 후보들은 중첩 사슬이라 크기가 단조 증가하므로, 기대 bbox와의 치수 비교만으로 레벨이 특정된다.
function simDims(a, b) {
  const w = Math.min(a[2], b[2]) / Math.max(a[2], b[2] || 1);
  const h = Math.min(a[3], b[3]) / Math.max(a[3], b[3] || 1);
  return (w || 0) * (h || 0);
}

const srcFileOf = (o) => (o.srcLoc ? o.srcLoc.replace(/:\d+:\d+$/, "") : null);

// 컴포넌트 인스턴스 루트: data-src 파일이 해당 컴포넌트 경로인데, 부모 요소는 다른 파일 출신인 요소.
// data-src는 컴파일러가 주입한 것이라 생성 LLM의 선언과 달리 신뢰할 수 있는 단서다.
function componentRoots(comp, elements) {
  const prefixes = comp.includes("/")
    ? [comp.replace(/\/+$/, "") + "/", comp.replace(/\/+$/, "") + ".tsx"]
    : [`src/components/${comp}/`, `src/components/${comp}.tsx`];
  const inComp = (o) => {
    const f = srcFileOf(o);
    return !!f && prefixes.some((p) => (p.endsWith("/") ? f.startsWith(p) : f === p));
  };
  return elements.filter((o) => {
    if (!inComp(o)) return false;
    const parents = elements.filter((p) => contains(p, o));
    if (!parents.length) return true;
    const parent = parents.reduce((a, b) => (a.enter > b.enter ? a : b)); // 가장 안쪽 부모
    return !inComp(parent);
  });
}

// 컨테이너 유도 — 컨테이너의 정체성은 내용물이 정의한다. 3단:
//  1) 매칭된 자손 리프 2개 이상: 전부 담고 밖의 리프는 담지 않는 후보들(중첩 사슬) 중 기대 bbox와 IoU 최대
//  2) 자손 리프 1개: 그 리프의 매칭 요소 자신 + 조상 사슬 중 IoU 최대 (IoU가 래퍼 레벨 모호성을 해소)
//  3) 리프 0~1개여도 mappedCodeComponent/suggestedComponent가 있으면: data-src로 그 컴포넌트
//     파일 출신 루트 요소들을 찾아 기대 bbox와 가장 가까운 것 (검증 빌드에서만 가능)
export function deriveContainers(containers, leaves, matched, elements) {
  const derived = new Map();
  const usedCompEl = new Set();
  for (const c of containers) {
    const inside = leaves
      .filter((l) => l.path.startsWith(c.path + ".") && matched.has(l))
      .map((l) => matched.get(l).el);
    const outside = leaves
      .filter((l) => !l.path.startsWith(c.path + ".") && matched.has(l))
      .map((l) => matched.get(l).el);

    if (inside.length >= 2) {
      const enclosing = elements.filter((o) => inside.every((d) => contains(o, d)));
      const clean = enclosing.filter((o) => !outside.some((d) => contains(o, d)));
      const pool = clean.length ? clean : enclosing;
      if (pool.length) {
        pool.sort((a, b) => simDims(c.abs, b.rect) - simDims(c.abs, a.rect));
        derived.set(c.path, { el: pool[0], exact: !!clean.length, via: "leaves", c });
        continue;
      }
    } else if (inside.length === 1) {
      // 컨테이너가 리프와 같은 요소로 렌더된 경우(텍스트를 직접 담는 칩 등)가 있어 리프 자신도 후보에 넣는다
      const anchor = inside[0];
      const chain = [anchor, ...elements.filter((o) => contains(o, anchor))];
      const clean = chain.filter((o) => !outside.some((d) => contains(o, d)));
      const pool = clean.length ? clean : chain;
      pool.sort((a, b) => simDims(c.abs, b.rect) - simDims(c.abs, a.rect));
      if (pool.length && simDims(c.abs, pool[0].rect) > 0) {
        derived.set(c.path, { el: pool[0], exact: !!clean.length, via: "leaf-1", c });
        continue;
      }
    }

    if (c.comp) {
      const roots = componentRoots(c.comp, elements).filter((o) => !usedCompEl.has(o.i));
      if (roots.length) {
        roots.sort((a, b) => dist(c.abs, a.rect) - dist(c.abs, b.rect)); // 다중 인스턴스는 위치로 동점 해소
        derived.set(c.path, { el: roots[0], exact: true, via: "component", c });
        usedCompEl.add(roots[0].i);
      }
    }
  }
  return derived;
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
