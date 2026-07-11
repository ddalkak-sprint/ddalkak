#!/usr/bin/env node
// 생성된 코드를 plan.md 기준으로 점검한다 (code 단계 결정론 게이트).
// 사용법: node scripts/validate-code.mjs <plan.md> [projectRoot]
//   projectRoot를 생략하면 `.ddalkak`를 담은 상위 디렉토리(plan 경로 기준)로 추론한다.
//
// verify(4단계, Playwright)는 무겁다. 이 스크립트는 그 앞단에서 LLM 없이 결정론적으로
// "plan을 코드로 옮길 때 새는 지점"을 잡는 저비용 게이트다. plan 단계의 validate-plan.mjs와 대칭이다.
//
//  error(구조 — 계약 위반):
//   - plan.md의 '파일 계획' 표 부재/붕괴 (검사 자체가 성립 안 함)
//   - '파일 계획' 표의 신규/수정 파일이 프로젝트에 없음 (code-rules §2 — 신규 미생성·수정 대상 부재)
//
//  warning(완결성/품질 — plan 구멍·규약 이탈):
//   - 코드의 arbitrary 시각값([Npx]/#hex/rgba/shadow)이 plan에 없음
//       = code가 §4-1로 즉석 환산했다는 신호 → 다음 plan에 흡수할 값 (code-rules §4·§11 완결성 루프)
//   - arbitrary hex가 소문자 (§4-1 대문자 규약)
//
// 부수 출력: 완결성 경고로 잡힌 "plan에 없는 값" 목록을
//   `.ddalkak/reports/<name>.code-gaps.json`으로 떨군다 — plan 재실행이 표로 흡수하는 입력.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";

const planPath = process.argv[2];
if (!planPath) {
  console.error("사용법: node scripts/validate-code.mjs <plan.md> [projectRoot]");
  process.exit(1);
}
if (!existsSync(planPath)) {
  console.error(`plan.md를 찾지 못함: ${planPath}`);
  process.exit(1);
}

const planText = readFileSync(planPath, "utf8");
const errors = [];
const warnings = [];

// ── 경로 추론 ─────────────────────────────────────────────
const posixPlan = planPath.replace(/\\/g, "/");
const projectRoot = process.argv[3] ?? inferProjectRoot(posixPlan);

// `.ddalkak`를 담은 디렉토리 = 프로젝트 루트 (파일 계획 표의 경로가 이 기준의 상대경로)
function inferProjectRoot(p) {
  const m = p.match(/^(.*)\/\.ddalkak\/plan\//);
  return m ? m[1] || "." : ".";
}

// ── 섹션/표 파서 (validate-plan.mjs와 동일) ───────────────
function sectionBody(md, heading) {
  const lines = md.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim().replace(/\s+/g, " ").startsWith(`## ${heading}`));
  if (start === -1) return null;
  const body = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break;
    body.push(lines[i]);
  }
  return body.join("\n");
}
function tableRows(text) {
  if (!text) return [];
  const rows = [];
  let sawSeparator = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith("|")) continue;
    if (/^\|[\s:|-]+\|?$/.test(line) && line.includes("-")) { sawSeparator = true; continue; }
    if (!sawSeparator) continue;
    const cells = line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
    if (cells.some((c) => c.length)) rows.push(cells);
  }
  return rows;
}
// 표 셀 안의 인라인 코드(`...`)를 벗기고 경로만 남긴다.
function cellPath(cell) {
  const m = cell.match(/`([^`]+)`/);
  return (m ? m[1] : cell).trim();
}

// ── 1. 파일 계획 표 → 파일 존재 검사 (code-rules §2) ──────
const planFileSection = sectionBody(planText, "파일 계획");
const fileRows = tableRows(planFileSection);
if (!fileRows.length) {
  errors.push("plan '파일 계획' 표를 읽지 못함 — 표가 없거나 붕괴됨 (먼저 validate-plan.mjs 통과 필요)");
}

const plannedFiles = []; // { path, mode, abs, exists }
for (const cells of fileRows) {
  if (cells.length < 2) continue;
  const rel = cellPath(cells[0]);
  const mode = /수정/.test(cells[1]) ? "수정" : /신규/.test(cells[1]) ? "신규" : "?";
  if (!rel || rel.includes(" ") && !/[./]/.test(rel)) continue; // 경로 같지 않으면 건너뜀
  const abs = join(projectRoot, rel);
  const exists = existsSync(abs);
  plannedFiles.push({ path: rel, mode, abs, exists });
  if (!exists) {
    errors.push(`'파일 계획'의 ${mode} 파일이 프로젝트에 없음: ${rel} (code-rules §2 — ${mode === "신규" ? "미생성" : "수정 대상 부재"})`);
  }
}

// 검사 대상 소스 = 계획에 존재하는 코드/마크업 파일
const SRC_EXT = /\.(tsx?|jsx?|vue|svelte|css|scss|html)$/i;
const scanFiles = plannedFiles.filter((f) => f.exists && SRC_EXT.test(f.path));

// ── 2. arbitrary 시각값 완결성 역검출 (code-rules §4·§11) ─
// 코드에 쓰인 arbitrary 시각값 중 plan 어디에도 없는 것 = code가 즉석 환산한 값 = plan 구멍.
// `수정` 파일(tailwind.config.js 등)은 다른 화면 토큰이 누적돼 있어 이번 plan 구멍이 아니므로,
// 이번 화면 렌더용으로 새로 지은 `신규` 소스만 대상으로 한다.
const newFiles = scanFiles.filter((f) => f.mode === "신규");
const planHaystack = planText.toLowerCase().replace(/\s+/g, "");
const norm = (s) => s.toLowerCase().replace(/\s+/g, "");
// 시각 리터럴만 남기는 필터 (배열 인덱스 등 비-시각 대괄호 제외)
const isVisualLiteral = (v) => /(px|rem|em|vh|vw|%|deg|#[0-9a-f]{3,8}|rgba?\()/i.test(v) || v.includes("_");

const codeValues = new Set();
const lowercaseHex = new Set();
for (const f of newFiles) {
  const t = readFileSync(f.abs, "utf8");
  for (const m of t.matchAll(/\[([^\]\s]+)\]/g)) {         // tailwind arbitrary [..]
    if (isVisualLiteral(m[1])) codeValues.add(m[1]);
  }
  for (const m of t.matchAll(/#[0-9A-Fa-f]{3,8}\b/g)) {    // raw hex (인라인 스타일/props)
    codeValues.add(m[0]);
    if (/[a-f]/.test(m[0].slice(1))) lowercaseHex.add(m[0]);
  }
}

const missingValues = [...codeValues].filter((v) => !planHaystack.includes(norm(v))).sort();
for (const v of missingValues) {
  warnings.push(`arbitrary 값 '${v}'가 plan에 없음 — code가 §4-1로 즉석 환산한 값(plan 구멍). 다음 plan 표로 흡수 (code-rules §4·§11)`);
}
for (const v of [...lowercaseHex].sort()) {
  warnings.push(`hex '${v}'가 소문자 — §4-1 대문자 규약 위반(재실행 결정론)`);
}

// ── 부수 출력: code-gaps 리포트 (plan 흡수 입력) ──────────
if (missingValues.length) {
  const name = basename(posixPlan).replace(/\.plan\.md$/, "");
  const reportDir = join(projectRoot, ".ddalkak", "reports");
  try {
    if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });
    const out = join(reportDir, `${name}.code-gaps.json`);
    writeFileSync(out, JSON.stringify({
      name,
      note: "code가 plan에 없어 즉석 환산한 arbitrary 시각값. plan 토큰/좌표 표로 흡수 대상 (code-rules §4·§11).",
      missingValues,
    }, null, 2) + "\n");
    globalThis.__gapReport = out;
  } catch { /* 리포트 쓰기 실패는 게이트 결과에 영향 주지 않음 */ }
}

// ── 결과 ──────────────────────────────────────────────────
if (errors.length) {
  console.error("❌ code 검증 실패:\n - " + errors.join("\n - "));
  process.exit(1);
}
if (warnings.length) {
  console.warn("⚠️  완결성 경고:\n - " + warnings.join("\n - "));
}
const gap = globalThis.__gapReport ? `  gap 리포트: ${globalThis.__gapReport}` : "";
console.log(`✅ code 구조 검증 통과: ${planPath}${gap}`);
