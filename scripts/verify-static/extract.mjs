// 속성 추출 — 매칭 범위에서 해당 속성 클래스를 찾아 값으로 환산. (규칙 SSOT: §2, §4-4)
import { ctx } from "./context.mjs";
import { normalizeLineHeight, normalizeShadow, canonShadowCss } from "./normalize.mjs";
import { classToPx, resolveColorClass, resolveFontSizeClass, FONT_WEIGHT_CLASSES, RADIUS_CLASSES } from "./tailwind.mjs";
import { elementsOf, classLine, ancestorsOf } from "./jsx-scan.mjs";

const TEXT_PROPS = new Set(["fontSize", "fontWeight", "lineHeight", "textColor"]);
const PADDING_SIDES = { p: [0, 1, 2, 3], px: [1, 3], py: [0, 2], pt: [0], pr: [1], pb: [2], pl: [3] };

function extractPaddingTuple(classes) {
  // CSS 캐스케이드: p < px/py < pt/pr/pb/pl (Tailwind 유틸 출력 순서와 동일)
  const tuple = [0, 0, 0, 0];
  let found = false;
  for (const stage of [["p"], ["px", "py"], ["pt", "pr", "pb", "pl"]]) {
    for (const prefix of stage) {
      for (const cls of classes) {
        const v = classToPx(cls, prefix);
        if (v === undefined) continue;
        if (v === null) return { unconvertible: true, cls };
        found = true;
        for (const idx of PADDING_SIDES[prefix]) tuple[idx] = v;
      }
    }
  }
  return found ? { value: tuple.join(" "), cls: classes.find((c) => /^p[xytrbl]?-/.test(c)) ?? "p-*" } : null;
}

function extractOne(cls, property) {
  // 단일 클래스 → {value, cls} | {unconvertible, cls} | undefined(해당 없음)
  switch (property) {
    case "height": case "width": case "gap": {
      const prefix = property === "height" ? "h" : property === "width" ? "w" : "gap";
      if (property === "width" && (cls === "w-full" || cls === "w-auto" || cls === "w-screen")) return undefined;
      if (property === "height" && (cls === "h-full" || cls === "h-auto" || cls === "h-screen" || cls === "min-h-screen")) return undefined;
      const v = classToPx(cls, prefix);
      if (v !== undefined) return v === null ? { unconvertible: true, cls } : { value: v, cls };
      return undefined;
    }
    case "borderRadius": {
      if (RADIUS_CLASSES[cls] !== undefined) return { value: RADIUS_CLASSES[cls], cls };
      const arb = cls.match(/^rounded-\[(\d+(?:\.\d+)?)px\]$/);
      if (arb) return { value: parseFloat(arb[1]), cls };
      return undefined;
    }
    case "backgroundColor": {
      const v = resolveColorClass(cls, "bg");
      if (v !== undefined) return { value: v, cls };
      if (cls.startsWith("bg-") && !cls.startsWith("bg-gradient")) return { unconvertible: true, cls };
      return undefined;
    }
    case "textColor": {
      const v = resolveColorClass(cls, "text");
      if (v !== undefined) return { value: v, cls };
      return undefined; // text-*는 fontSize일 수도 있으므로 미해석 시 통과
    }
    case "borderColor": {
      const v = resolveColorClass(cls, "border");
      if (v !== undefined) return { value: v, cls };
      return undefined;
    }
    case "fontSize": {
      const v = resolveFontSizeClass(cls);
      if (v !== undefined) return { value: v.size, cls };
      return undefined;
    }
    case "lineHeight": {
      const fs = resolveFontSizeClass(cls);
      if (fs !== undefined && fs.lineHeight != null) return { value: normalizeLineHeight(fs.lineHeight, fs.size), cls };
      const lh = cls.match(/^leading-\[(\d+(?:\.\d+)?)(px)?\]$/);
      if (lh) return { value: normalizeLineHeight(lh[1] + (lh[2] ?? ""), null), cls };
      return undefined;
    }
    case "fontWeight": {
      if (FONT_WEIGHT_CLASSES[cls] !== undefined) return { value: FONT_WEIGHT_CLASSES[cls], cls };
      return undefined;
    }
    case "boxShadow": {
      const m = cls.match(/^shadow-\[(.+)\]$/);
      if (m) return { value: normalizeShadow(m[1]), cls };
      if (cls.startsWith("shadow-") && ctx.theme.boxShadow[cls.slice(7)])
        return { value: canonShadowCss(ctx.theme.boxShadow[cls.slice(7)]), cls };
      return undefined;
    }
    case "flexDirection": {
      if (cls === "flex-col") return { value: "column", cls };
      if (cls === "flex-row") return { value: "row", cls };
      return undefined;
    }
  }
  return undefined;
}

function extractFromClasses(classes, property) {
  // 반환: {value, cls} | {values:[...]} | null(해당 클래스 없음) | {unconvertible, cls}
  if (property === "padding") return extractPaddingTuple(classes);
  const hits = [];
  for (const cls of classes) {
    const hit = extractOne(cls, property);
    if (hit === undefined) continue;
    if (hit.unconvertible) return hit;
    hits.push(hit);
  }
  if (!hits.length) return null;
  const distinct = [...new Map(hits.map((h) => [String(h.value), h])).values()];
  if (distinct.length === 1) return distinct[0];
  return { values: distinct }; // 조건부 클래스 집합 (상태 분기)
}

export function extractProperty(match, property) {
  // 반환: {value|values, cls, file, line} | {notFound:true} | {unconvertible:true} | {ambiguous:true}
  if (match.scope === "element") {
    const el = match.element;
    let hit = extractFromClasses(el.classes, property);
    // flexDirection: flex만 있고 방향 클래스가 없으면 row (CSS 기본값)
    if (!hit && property === "flexDirection" && el.classes.includes("flex"))
      hit = { value: "row", cls: "flex" };
    // 이미지 width/height 속성(attr) 지원
    if (!hit && el.tag === "img" && (property === "width" || property === "height")) {
      const attr = el.attrs[property];
      if (attr && /^\d+$/.test(attr)) hit = { value: parseFloat(attr), cls: `${property}={${attr}}` };
    }
    if (hit) return { ...hit, file: el.file, line: classLine(el, hit.cls ?? hit.values?.[0]?.cls) };
    // 텍스트 속성은 조상에서 상속 탐색
    if (TEXT_PROPS.has(property)) {
      for (const anc of ancestorsOf(el)) {
        const inherited = extractFromClasses(anc.classes, property);
        if (inherited) return { ...inherited, file: anc.file, line: classLine(anc, inherited.cls ?? inherited.values?.[0]?.cls), inherited: true };
      }
      if (property === "fontWeight") return { value: 400, cls: "(기본값)", file: el.file, line: el.line }; // CSS 기본
    }
    return { notFound: true, file: el.file, line: el.line };
  }
  // scope === "file": 컴포넌트 파일 전체에서 해당 속성 클래스 수집
  const hits = [];
  for (const f of match.files) {
    for (const el of elementsOf(f)) {
      let hit = extractFromClasses(el.classes, property);
      // flexDirection 암묵값: flex만 있고 방향 클래스 없으면 row (CSS 기본) — 파일 스코프에도 적용
      if (!hit && property === "flexDirection" && el.classes.includes("flex")) hit = { value: "row", cls: "flex" };
      if (!hit) continue;
      if (hit.unconvertible) return { ...hit, file: f, line: classLine(el, hit.cls) };
      if (hit.values) hits.push(...hit.values.map((h) => ({ ...h, file: f, line: classLine(el, h.cls) })));
      else hits.push({ ...hit, file: f, line: classLine(el, hit.cls) });
    }
  }
  if (hits.length === 0) {
    if (property === "fontWeight") return { value: 400, cls: "(기본값)", file: match.files[0], line: 1 };
    return { notFound: true, file: match.files[0], line: null };
  }
  const distinct = [...new Map(hits.map((h) => [String(h.value), h])).values()];
  if (distinct.length === 1) return distinct[0];
  return { values: distinct, file: distinct[0].file, line: distinct[0].line };
}

// 매칭된 요소 자신의 크기(클래스/img 속성에서 결정론 환산 가능한 것만) — radius 클램프용
export function elementMinSideOf(el) {
  const dims = [];
  for (const prop of ["width", "height"]) {
    let hit = extractFromClasses(el.classes, prop);
    if ((!hit || hit.values) && el.tag === "img") {
      const attr = el.attrs[prop];
      if (attr && /^\d+$/.test(attr)) hit = { value: parseFloat(attr) };
    }
    if (hit && !hit.values && !hit.unconvertible && typeof hit.value === "number") dims.push(hit.value);
  }
  return dims.length ? Math.min(...dims) : null;
}
