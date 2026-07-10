// Tailwind 테마 로딩 + 클래스 → 값 환산. (규칙 SSOT: shared/verify-normalization-rules.md §2)
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeHex } from "./normalize.mjs";
import { ctx } from "./context.mjs";

export const FONT_WEIGHT_CLASSES = {
  "font-thin": 100, "font-extralight": 200, "font-light": 300, "font-normal": 400,
  "font-medium": 500, "font-semibold": 600, "font-bold": 700, "font-extrabold": 800, "font-black": 900,
};
export const RADIUS_CLASSES = {
  "rounded-none": 0, "rounded-sm": 2, rounded: 4, "rounded-md": 6, "rounded-lg": 8,
  "rounded-xl": 12, "rounded-2xl": 16, "rounded-3xl": 24, "rounded-full": 9999,
};
const SCALE = (n) => n * 4; // Tailwind 기본 스케일: 1 = 4px

export async function loadTailwindTheme(projectRoot) {
  const configPath = join(projectRoot, "tailwind.config.js");
  if (!existsSync(configPath)) return { colors: {}, fontSize: {}, boxShadow: {} };
  const mod = await import(pathToFileURL(configPath).href);
  const extend = mod.default?.theme?.extend ?? {};
  const colors = {};
  for (const [k, v] of Object.entries(extend.colors ?? {})) colors[k] = normalizeHex(v);
  const fontSize = {};
  for (const [k, v] of Object.entries(extend.fontSize ?? {})) {
    const [size, opts] = Array.isArray(v) ? v : [v, {}];
    fontSize[k] = { size: parseFloat(size), lineHeight: opts?.lineHeight != null ? parseFloat(opts.lineHeight) : null };
  }
  const boxShadow = { ...(extend.boxShadow ?? {}) };
  return { colors, fontSize, boxShadow };
}

export function classToPx(cls, prefix) {
  // 예: h-11 → 44 / h-[400px] → 400 / h-full → null(환산 불가)
  const m = cls.match(new RegExp(`^${prefix}-(.+)$`));
  if (!m) return undefined; // 이 클래스는 해당 속성이 아님
  const raw = m[1];
  const arb = raw.match(/^\[(\d+(?:\.\d+)?)px\]$/);
  if (arb) return parseFloat(arb[1]);
  if (/^\d+(\.\d+)?$/.test(raw)) return SCALE(parseFloat(raw));
  if (raw === "px") return 1;
  return null; // h-full, h-auto 등 — 결정론 환산 불가
}

export function resolveColorClass(cls, prefix) {
  // 예: text-text-muted → #6b7280 / bg-dk-red-500 → #ff0038 / text-[#123456]
  if (!cls.startsWith(prefix + "-")) return undefined;
  const raw = cls.slice(prefix.length + 1);
  const arb = raw.match(/^\[(#[0-9a-fA-F]{3,8})\]$/);
  if (arb) return normalizeHex(arb[1]);
  if (raw === "white") return "#ffffff";
  if (raw === "black") return "#000000";
  if (raw === "transparent") return "transparent";
  if (ctx.theme.colors[raw] != null) return ctx.theme.colors[raw];
  if (ctx.bridgeColorTokens[raw] != null) return ctx.bridgeColorTokens[raw];
  return undefined; // 색 토큰이 아니면 다른 속성(fontSize 등)일 수 있음
}

export function resolveFontSizeClass(cls) {
  if (!cls.startsWith("text-")) return undefined;
  const raw = cls.slice(5);
  if (ctx.theme.fontSize[raw]) return ctx.theme.fontSize[raw];
  const arb = raw.match(/^\[(\d+(?:\.\d+)?)px\]$/);
  if (arb) return { size: parseFloat(arb[1]), lineHeight: null };
  return undefined;
}

// 기대값(hex) → 수정 제안용 클래스 역참조
export function colorClassFor(hex, prefix) {
  for (const [tok, v] of Object.entries(ctx.theme.colors)) if (v === hex) return `${prefix}-${tok}`;
  for (const [tok, v] of Object.entries(ctx.bridgeColorTokens)) if (v === hex) return `${prefix}-${tok}`;
  if (hex === "#ffffff") return `${prefix}-white`;
  if (hex === "#000000") return `${prefix}-black`;
  return `${prefix}-[${hex}]`;
}
export function pxClassFor(px, prefix) {
  return px % 4 === 0 ? `${prefix}-${px / 4}` : `${prefix}-[${px}px]`;
}
