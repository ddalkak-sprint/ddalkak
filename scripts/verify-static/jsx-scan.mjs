// 경량 JSX 스캐너 — 파일별 요소 트리(태그·클래스·텍스트·라인·중첩)와 data-dk 표현식 해석. (규칙 SSOT: §4)
import { readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { ctx } from "./context.mjs";

export function stripJsxComments(src) {
  // {/* ... */} 을 라인 수 보존한 채 공백으로 치환 (텍스트 매칭 오염 방지)
  return src.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, (m) => m.replace(/[^\n]/g, " "));
}

function lineOf(src, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (src[i] === "\n") line++;
  return line;
}

// 여는 태그의 끝(>)까지 인용부호·중괄호 깊이를 존중하며 스캔
function scanTagEnd(src, start) {
  let depth = 0, quote = null;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === quote && src[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (ch === ">" && depth === 0) return i;
  }
  return -1;
}

// 속성 파싱: name="str" | name={expr(중첩 허용)} | name (bare)
function parseAttrs(raw) {
  const attrs = {};
  let i = 0;
  while (i < raw.length) {
    const m = raw.slice(i).match(/^[\s/]*([\w-]+)/);
    if (!m) break;
    const nameEnd = i + m[0].length;
    const attr = m[1];
    let j = nameEnd;
    while (j < raw.length && /\s/.test(raw[j])) j++;
    if (raw[j] !== "=") { attrs[attr] = true; i = nameEnd; continue; }
    j++;
    while (j < raw.length && /\s/.test(raw[j])) j++;
    if (raw[j] === '"' || raw[j] === "'") {
      const q = raw[j];
      const end = raw.indexOf(q, j + 1);
      attrs[attr] = raw.slice(j + 1, end === -1 ? raw.length : end);
      i = (end === -1 ? raw.length : end) + 1;
    } else if (raw[j] === "{") {
      let depth = 0, quote = null, k = j;
      for (; k < raw.length; k++) {
        const ch = raw[k];
        if (quote) { if (ch === quote && raw[k - 1] !== "\\") quote = null; continue; }
        if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
        if (ch === "{") depth++;
        else if (ch === "}") { depth--; if (depth === 0) break; }
      }
      attrs[attr] = raw.slice(j + 1, k).trim();
      i = k + 1;
    } else {
      i = nameEnd;
    }
  }
  return attrs;
}

// className 값(문자열 또는 JSX 표현식)에서 클래스 후보 토큰을 전부 수집.
// 표현식이면 모든 문자열 조각(템플릿 정적부 + 삼항 분기의 인용 문자열)을 후보로 취급 —
// 상태 조건부 클래스는 "후보 집합"이 되며, 채점은 집합 규칙(§6)으로 처리한다.
function classCandidatesOf(value) {
  if (!value) return [];
  if (!/[`"'{]/.test(value)) return value.split(/\s+/).filter(Boolean);
  const out = [];
  // 템플릿 정적부: ${...}를 깊이 추적으로 제거
  for (const tpl of value.matchAll(/`((?:\\`|[^`])*)`/g)) {
    let s = "", depth = 0;
    const body = tpl[1];
    for (let i = 0; i < body.length; i++) {
      if (body[i] === "$" && body[i + 1] === "{") { depth++; i++; continue; }
      if (depth > 0) {
        if (body[i] === "{") depth++;
        else if (body[i] === "}") depth--;
        continue;
      }
      s += body[i];
    }
    out.push(...s.split(/\s+/).filter(Boolean));
  }
  for (const q of value.matchAll(/"([^"]*)"|'([^']*)'/g))
    out.push(...(q[1] ?? q[2]).split(/\s+/).filter(Boolean));
  return [...new Set(out)];
}

// data-dk 표현식 해석: 파일 상단 const 테이블로 템플릿/식별자/삼항을 정적으로 복원
function buildConstTable(src) {
  const table = {};
  for (const m of src.matchAll(/const\s+([A-Z][A-Z0-9_]*)\s*=\s*(`(?:\\`|[^`])*`|"[^"]*"|'[^']*')/g))
    table[m[1]] = m[2];
  let progress = true;
  const resolved = {};
  while (progress) {
    progress = false;
    for (const [k, raw] of Object.entries(table)) {
      if (resolved[k] != null) continue;
      const r = resolveStringExpr(raw, resolved);
      if (r != null) { resolved[k] = r; progress = true; }
    }
  }
  return resolved;
}

function resolveStringExpr(expr, table) {
  const e = expr.trim();
  const quoted = e.match(/^"([^"]*)"$|^'([^']*)'$/);
  if (quoted) return quoted[1] ?? quoted[2];
  const tpl = e.match(/^`((?:\\`|[^`])*)`$/);
  if (tpl) {
    let out = "", body = tpl[1], ok = true;
    out = body.replace(/\$\{([^}]*)\}/g, (_, inner) => {
      const v = resolveStringExpr(inner, table);
      if (v == null) ok = false;
      return v ?? "";
    });
    return ok ? out : null;
  }
  if (/^[A-Z][A-Z0-9_]*$/.test(e)) return table[e] ?? null;
  return null;
}

function resolveDkExpr(expr, table) {
  // 반환: 이 표현식이 가질 수 있는 nodeId 문자열 배열 (삼항이면 양쪽 분기 모두)
  const e = expr.trim();
  // 최상위 삼항 분기 탐지 (인용부호 밖의 ? :)
  let depth = 0, quote = null, qIdx = -1;
  for (let i = 0; i < e.length; i++) {
    const ch = e[i];
    if (quote) { if (ch === quote && e[i - 1] !== "\\") quote = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "(" || ch === "{") depth++;
    else if (ch === ")" || ch === "}") depth--;
    else if (ch === "?" && depth === 0 && e[i + 1] !== "." && e[i + 1] !== "?") { qIdx = i; break; }
  }
  if (qIdx !== -1) {
    // "cond ? A : B" — 콜론도 같은 방식으로 탐색
    const rest = e.slice(qIdx + 1);
    let d = 0, q = null;
    for (let i = 0; i < rest.length; i++) {
      const ch = rest[i];
      if (q) { if (ch === q && rest[i - 1] !== "\\") q = null; continue; }
      if (ch === '"' || ch === "'" || ch === "`") { q = ch; continue; }
      if (ch === "(" || ch === "{") d++;
      else if (ch === ")" || ch === "}") d--;
      else if (ch === ":" && d === 0)
        return [...resolveDkExpr(rest.slice(0, i), table), ...resolveDkExpr(rest.slice(i + 1), table)];
    }
  }
  const v = resolveStringExpr(e, table);
  if (v != null) return [v];
  // 평문 리터럴: parseAttrs가 따옴표를 벗겨 bare 문자열이 된다. 두 형태를 리터럴로 인식한다 —
  //  ① 노드 경로: data-dk="screens[0]..."
  //  ② figma 노드 id: data-dk="9:565" / 인스턴스 id "I9:565;9:568" (§4-3 안정 ID 형태)
  if (/^screens\[\d+\]/.test(e) || /^I?[\d:;]+$/.test(e)) return [e];
  return [];
}

function buildImportMap(src) {
  const map = {};
  for (const m of src.matchAll(/import\s+(\w+)\s+from\s+["']([^"']+)["']/g)) map[m[1]] = basename(m[2]);
  return map;
}

function buildElementTree(filePath) {
  const src = stripJsxComments(readFileSync(join(ctx.projectRoot, filePath), "utf8"));
  const constTable = buildConstTable(src);
  const importMap = buildImportMap(src);
  const elements = [];
  const stack = [];
  const openRe = /<(\/?)([A-Za-z][\w.]*)/g;
  let m;
  while ((m = openRe.exec(src)) !== null) {
    const closing = m[1] === "/";
    const tag = m[2];
    const tagEnd = scanTagEnd(src, m.index + m[0].length);
    if (tagEnd === -1) continue;
    if (closing) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tag) {
          const el = stack[i];
          el.closeStart = m.index;
          el.end = tagEnd + 1;
          stack.length = i;
          break;
        }
      }
      openRe.lastIndex = tagEnd + 1;
      continue;
    }
    const rawAttrs = src.slice(m.index + m[0].length, tagEnd);
    const selfClose = /\/\s*$/.test(rawAttrs);
    const el = {
      tag,
      attrs: parseAttrs(rawAttrs.replace(/\/\s*$/, "")),
      start: m.index,
      openEnd: tagEnd + 1,
      closeStart: tagEnd + 1,
      end: tagEnd + 1,
      line: lineOf(src, m.index),
      parent: stack[stack.length - 1] ?? null,
      file: filePath,
    };
    el.classes = classCandidatesOf(el.attrs.className);
    const dkRaw = el.attrs["data-dk"] ?? el.attrs["dataDk"];
    el.dkValues = typeof dkRaw === "string" ? resolveDkExpr(dkRaw, constTable) : [];
    if (el.tag === "img" && typeof el.attrs.src === "string") {
      el.srcBasename = /["'`/]/.test(el.attrs.src) ? basename(el.attrs.src.replace(/["'`]/g, "")) : importMap[el.attrs.src] ?? null;
    }
    elements.push(el);
    if (!selfClose) stack.push(el);
    openRe.lastIndex = tagEnd + 1;
  }
  // 요소 자신의 텍스트(자식 요소 내부 제외, JSX 표현식 제외)
  for (const el of elements) {
    const kids = elements.filter((e) => e.parent === el);
    let text = "";
    let cursor = el.openEnd;
    for (const k of kids.sort((a, b) => a.start - b.start)) {
      text += src.slice(cursor, Math.max(cursor, k.start));
      cursor = k.end;
    }
    text += src.slice(Math.max(cursor, el.openEnd), Math.max(cursor, el.closeStart));
    el.ownText = text.replace(/\{[^{}]*\}/g, " ").replace(/\s+/g, " ").trim();
    // 자손 포함 전체 텍스트 — Figma에서 한 text 노드가 코드에선 span+a로 쪼개진 경우의 앵커 매칭용
    el.deepText = src
      .slice(el.openEnd, el.closeStart)
      .replace(/<[^>]*>/g, " ")
      .replace(/\{[^{}]*\}/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return elements;
}

export function elementsOf(filePath) {
  if (!ctx.treeCache.has(filePath)) {
    ctx.srcCache.set(filePath, stripJsxComments(readFileSync(join(ctx.projectRoot, filePath), "utf8")));
    ctx.treeCache.set(filePath, buildElementTree(filePath));
  }
  return ctx.treeCache.get(filePath);
}

// 클래스 토큰이 실제로 위치한 줄 (요소 시작줄이 아니라 해당 클래스의 줄 — 검증 시점 재계산)
export function classLine(el, cls) {
  const src = ctx.srcCache.get(el.file);
  if (!src || !cls || cls.startsWith("(")) return el.line;
  const openTag = src.slice(el.start, el.openEnd);
  const idx = openTag.indexOf(cls);
  return idx === -1 ? el.line : lineOf(src, el.start + idx);
}

export function ancestorsOf(el) {
  const out = [];
  for (let p = el.parent; p; p = p.parent) out.push(p);
  return out;
}
