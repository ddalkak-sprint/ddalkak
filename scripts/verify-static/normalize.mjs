// 값 정규화 — hex / lineHeight / box-shadow 캐논화. (규칙 SSOT: shared/verify-normalization-rules.md §1)
import { resolveRef } from "./context.mjs";

export function normalizeHex(value) {
  if (typeof value !== "string") return value;
  let v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(v)) v = "#" + [...v.slice(1)].map((c) => c + c).join("");
  return v;
}

export function normalizeLineHeight(value, fontSizePx) {
  // 단위 통일: px 값이면 fontSize로 나눠 unitless로, 소수 2자리 반올림
  const n = parseFloat(value);
  if (Number.isNaN(n)) return null;
  const unitless = n > 4 && fontSizePx ? n / fontSizePx : n; // 4 초과면 px로 간주
  return Math.round(unitless * 100) / 100;
}

// --- boxShadow 정규화: 어떤 표기든 "Xpx Ypx Bpx Spx rgba(r,g,b,a)"의 캐논 형태로 ---
export function hexToRgba(hex) {
  const h = normalizeHex(hex).slice(1);
  const full = h.length === 8 ? h : h + "ff";
  const [r, g, b, a] = [0, 2, 4, 6].map((i) => parseInt(full.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${Math.round((a / 255) * 100) / 100})`;
}
export function canonColor(c) {
  const s = c.trim().toLowerCase();
  if (s.startsWith("#")) return hexToRgba(s);
  const m = s.match(/^rgba?\(([^)]*)\)$/);
  if (!m) return s;
  const parts = m[1].split(",").map((p) => parseFloat(p));
  const [r, g, b, a = 1] = parts;
  return `rgba(${r},${g},${b},${Math.round(a * 100) / 100})`;
}
export function canonShadowPart(part) {
  let color = null;
  let rest = part.replace(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}/, (m) => {
    color = canonColor(m);
    return " ";
  });
  const nums = [...rest.matchAll(/-?\d*\.?\d+/g)].map((m) => parseFloat(m[0]));
  const [x = 0, y = 0, blur = 0, spread = 0] = nums;
  return `${x}px ${y}px ${blur}px ${spread}px ${color ?? "rgba(0,0,0,1)"}`;
}
export function canonShadowCss(css) {
  // 최상위 콤마로 분리(rgba 내부 콤마 보호)
  const parts = [];
  let depth = 0, cur = "";
  for (const ch of css) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { parts.push(cur); cur = ""; } else cur += ch;
  }
  parts.push(cur);
  return parts.filter((p) => p.trim()).map(canonShadowPart).join(" , ");
}
export function canonShadowEffect(eff) {
  const e = typeof eff === "string" ? resolveRef(eff) : eff;
  if (!e || typeof e !== "object") return null;
  const [x = 0, y = 0] = e.offset ?? [];
  return `${x}px ${y}px ${e.radius ?? 0}px ${e.spread ?? 0}px ${canonColor(e.color ?? "#000000")}`;
}
export function normalizeShadow(value) {
  // Tailwind 임의값 표기(shadow-[0_4px_...])의 언더스코어를 공백으로 → 캐논화
  return canonShadowCss(value.replace(/_/g, " "));
}
