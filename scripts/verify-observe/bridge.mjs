// bridge.json → 채점 기준 평탄화. 채점 기준은 끝까지 bridge 단독 (verify-static과 동일 원칙).
// bbox는 부모 상대 좌표이므로 절대좌표로 누적하고, @color/@type 토큰 참조를 해석한다.
import { basename } from "node:path";

export const normText = (s) => (s ?? "").replace(/\s+/g, " ").trim();

export function normalizeHex(s) {
  if (!s) return null;
  s = String(s).trim().toLowerCase();
  if (s.startsWith("#")) {
    if (s.length === 4) s = "#" + [...s.slice(1)].map((c) => c + c).join("");
    return s.slice(0, 7);
  }
  const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return null;
  if (m[4] !== undefined && parseFloat(m[4]) === 0) return "transparent";
  return "#" + [m[1], m[2], m[3]].map((v) => (+v).toString(16).padStart(2, "0")).join("");
}

export function flattenBridge(bridge, screen) {
  const tokens = bridge.tokens ?? {};
  const resolveColor = (v) => {
    if (typeof v !== "string") return null;
    if (v.startsWith("@color.")) return normalizeHex(tokens.color?.[v.slice(7)] ?? null);
    return normalizeHex(v);
  };
  const resolveFont = (f) =>
    typeof f === "string" && f.startsWith("@type.") ? tokens.type?.[f.slice(6)] ?? null : f ?? null;
  const solidFill = (style) => {
    const fills = style?.fills;
    if (Array.isArray(fills) && fills.length === 1 && fills[0].type === "solid") {
      return resolveColor(fills[0].color);
    }
    return null;
  };
  const assets = Object.fromEntries(
    (bridge.assets ?? []).map((a) => [a.id, basename(a.export ?? "")]),
  );
  const resolveNum = (v) => {
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.startsWith("@spacing.")) return tokens.spacing?.[v.slice(9)] ?? 0;
    return 0;
  };

  const leaves = [];
  const containers = [];
  function walk(n, ox, oy, path) {
    const b = n.bbox ?? [0, 0, 0, 0];
    const abs = [ox + b[0], oy + b[1], b[2], b[3]];
    const st = n.style ?? {};
    if (n.type === "text") {
      leaves.push({
        kind: "text",
        path,
        name: n.name,
        content: normText(n.content),
        abs,
        font: resolveFont(st.font),
        color: solidFill(st),
      });
    } else if (n.type === "image" || n.type === "vector") {
      leaves.push({ kind: "image", path, name: n.name, assetBase: assets[n.ref] ?? null, abs });
    } else {
      containers.push({
        path,
        name: n.name,
        type: n.type,
        abs,
        bg: solidFill(st),
        radius: typeof st.cornerRadius === "number" ? st.cornerRadius : null,
        // 인스턴스의 코드 컴포넌트 단서 — data-src 기반 유도(match.mjs)에 쓴다
        comp: n.mappedCodeComponent ?? n.suggestedComponent ?? null,
        childPaths: (n.children ?? []).map((_, i) => `${path}.${i}`),
      });
    }
    // 자식 좌표는 content-box 기준 — layout.padding[t,r,b,l]이 선언된 컨테이너는
    // 자식 원점을 (left, top)만큼 안쪽으로 옮긴다. (login·pc-home 브릿지 실측으로 확인:
    // emoji-picker-panel padding 30 + 자식 rel (0,0) = 렌더 +31(테두리 1 포함) 등)
    // 자식 좌표 기준(content-box/border-box)이 브릿지 파일·노드마다 혼재한다(추출기 이슈로 등록).
    // 스키마 버전으로 판별이 불가능하므로 컨테이너 단위로 자동 감지한다:
    // 오토레이아웃에서 자식은 패딩 안쪽에 놓일 수 없으므로, 자식 좌표가 패딩보다
    // 안쪽(작음)이면 content-box 기준 — 그때만 자식 원점을 패딩만큼 옮긴다.
    const pad = n.layout?.padding;
    let cox = abs[0];
    let coy = abs[1];
    if (Array.isArray(pad) && pad.length === 4 && (n.children ?? []).length) {
      const padT = resolveNum(pad[0]);
      const padL = resolveNum(pad[3]);
      const contentBox = n.children.some((c) => (c.bbox?.[0] ?? 0) < padL || (c.bbox?.[1] ?? 0) < padT);
      if (contentBox) {
        cox += padL;
        coy += padT;
      }
    }
    (n.children ?? []).forEach((c, i) => walk(c, cox, coy, `${path}.${i}`));
  }
  screen.nodes.forEach((n, i) => walk(n, 0, 0, `${i}`));
  return { leaves, containers };
}
