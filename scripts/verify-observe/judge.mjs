// 판정 — 짝지어진 쌍만 엄격하게 채점한다. 절대좌표는 채점하지 않는다:
// 상위 한 곳의 시프트가 하위 전체를 "위치 오류"로 도배하는 연쇄 오탐을 막기 위해
// 관계(형제 간 간격, 부모 내 오프셋)만 본다.
// 기하 위반은 tolMinor 이하이면 minor로 강등 — 이모지 글리프 폭 등 렌더링 노이즈 가능성 표시.
import { normalizeHex } from "./bridge.mjs";

const fw = (w) => ({ normal: "400", bold: "700" })[w] ?? String(w);

export function judge({ leaves, containers, matched, missing, derived, units, tol, tolMinor }) {
  const findings = [];
  const push = (kind, severity, path, where, expected, actual, rect, rects) =>
    findings.push({ kind, severity, path, where, expected, actual, rect: rect ?? null, rects: rects ?? null });
  const geoSeverity = (delta) => (Math.abs(delta) <= tolMinor ? "minor" : "major");

  // 0. 누락 — 매칭되지 않은 리프. rect는 기대 위치(브릿지 절대좌표)를 담는다.
  for (const lf of missing) {
    push(
      "missing", "major", lf.path,
      lf.kind === "text" ? `텍스트 ${JSON.stringify(lf.content.slice(0, 20))}` : `자산 ${lf.assetBase}`,
      "존재", "미발견", lf.abs,
    );
  }

  // 1. 리프 스타일 — computed style vs 브릿지 값 (환산은 브라우저가 이미 끝냈다)
  for (const [lf, m] of matched) {
    const el = m.el;
    const where = lf.kind === "text" ? JSON.stringify(lf.content.slice(0, 16)) : String(lf.assetBase);
    if (lf.kind === "text") {
      const f = lf.font;
      if (f?.size && Math.abs(el.fontSize - f.size) > 0.5)
        push("font-size", "major", lf.path, where, `${f.size}px`, `${el.fontSize}px`, el.rect);
      if (f?.weight && String(f.weight) !== fw(el.fontWeight))
        push("font-weight", "major", lf.path, where, String(f.weight), fw(el.fontWeight), el.rect);
      if (typeof f?.lineHeight === "number") {
        // 규칙표 §1: 값이 4 이하면 unitless 배수 → fontSize를 곱해 px로 통일
        const expLh = f.lineHeight <= 4 ? f.lineHeight * (f.size ?? 0) : f.lineHeight;
        const lh = parseFloat(el.lineHeight);
        if (expLh > 0 && !Number.isNaN(lh) && Math.abs(lh - expLh) > 0.6)
          push("line-height", "major", lf.path, where, `${Math.round(expLh * 10) / 10}px`, el.lineHeight, el.rect);
      }
      if (lf.color && lf.color !== normalizeHex(el.color))
        push("color", "major", lf.path, where, lf.color, String(normalizeHex(el.color)), el.rect);
    } else {
      const dw = el.rect[2] - lf.abs[2];
      const dh = el.rect[3] - lf.abs[3];
      if (Math.abs(dw) > 1.5 || Math.abs(dh) > 1.5)
        push("img-size", "major", lf.path, where, `${lf.abs[2]}×${lf.abs[3]}`, `${el.rect[2]}×${el.rect[3]}`, el.rect);
    }
  }

  // 2. 형제 단위 간 간격 — 같은 부모의 연속 단위(리프+컨테이너)끼리, 축은 지배적 방향으로
  const cx = (r) => r[0] + r[2] / 2;
  const cy = (r) => r[1] + r[3] / 2;
  for (const c of containers) {
    const us = c.childPaths.map((p) => units.get(p)).filter(Boolean);
    for (let i = 0; i < us.length - 1; i++) {
      const A = us[i];
      const B = us[i + 1];
      if (A.el === B.el) continue; // 두 노드가 같은 요소로 병합 — 정상 재량, 간격 없음
      const horizontal = Math.abs(cx(B.abs) - cx(A.abs)) > Math.abs(cy(B.abs) - cy(A.abs));
      const expGap = horizontal ? B.abs[0] - (A.abs[0] + A.abs[2]) : B.abs[1] - (A.abs[1] + A.abs[3]);
      const actGap = horizontal ? B.rect[0] - (A.rect[0] + A.rect[2]) : B.rect[1] - (A.rect[1] + A.rect[3]);
      const delta = actGap - expGap;
      if (Math.abs(delta) > tol)
        push(
          "unit-gap", geoSeverity(delta), c.path,
          `${c.name} [${A.label} ↔ ${B.label}]`,
          `${Math.round(expGap)}px(${horizontal ? "x" : "y"})`, `${Math.round(actGap)}px`,
          null, [A.rect, B.rect],
        );
    }
  }

  // 3. 부모 내 오프셋 — 비텍스트 단위(컨테이너·이미지)만, 부모가 유도된 경우.
  //    텍스트는 폰트 메트릭 노이즈가 커서 간격 채점(2번)에 맡긴다.
  for (const c of containers) {
    const parent = derived.get(c.path);
    if (!parent) continue;
    for (const p of c.childPaths) {
      const u = units.get(p);
      if (!u || u.kind === "text") continue;
      if (u.el === parent.el) continue; // 래퍼 병합(부모·자식이 같은 요소로 유도) — 오프셋 무의미
      const dx = u.rect[0] - parent.el.rect[0] - (u.abs[0] - c.abs[0]);
      const dy = u.rect[1] - parent.el.rect[1] - (u.abs[1] - c.abs[1]);
      if (Math.abs(dx) > tol || Math.abs(dy) > tol)
        push(
          "offset-in-parent", geoSeverity(Math.max(Math.abs(dx), Math.abs(dy))), c.path,
          `${c.name} → ${u.label}`,
          `(${Math.round(u.abs[0] - c.abs[0])}, ${Math.round(u.abs[1] - c.abs[1])})`,
          `Δ(${Math.round(dx)}, ${Math.round(dy)})`,
          u.rect,
        );
    }
  }

  // 4. 컨테이너 스타일 — 배경은 유효 배경(조상 투과)으로 판정 (v1 오탐 교훈)
  for (const [path, d] of derived) {
    if (d.c.bg) {
      const actual = normalizeHex(d.el.effBg);
      if (actual !== d.c.bg)
        push("container-bg", "major", path, String(d.c.name), d.c.bg, String(actual), d.el.rect);
    }
    if (d.c.radius != null) {
      const r = parseFloat(d.el.borderRadius);
      if (Math.abs(r - d.c.radius) > 0.6)
        push("container-radius", "major", path, String(d.c.name), `${d.c.radius}px`, d.el.borderRadius, d.el.rect);
    }
  }

  return findings;
}
