#!/usr/bin/env node
// MCP 캡처 골든 픽스처를 점검/조회한다. (record/replay — figma-extraction-rules.md §10)
//
// 사용법:
//   node scripts/mcp-cache.mjs list                    # fixtures/figma/ 아래 캡처 목록
//   node scripts/mcp-cache.mjs check <capture-dir>     # 매니페스트 vs 실제 파일 완결성 검사
//   node scripts/mcp-cache.mjs fingerprint <capture-dir>  # 캐시 지문(sha1) — 브릿지 스킵 판정용 (rules §10)

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const [cmd, arg] = process.argv.slice(2);

function listCaptures(root = "fixtures/figma") {
  if (!existsSync(root)) return console.log(`(없음) ${root} 폴더가 아직 없습니다.`);
  const dirs = readdirSync(root).filter((d) => {
    const p = join(root, d);
    return statSync(p).isDirectory() && existsSync(join(p, "manifest.json"));
  });
  if (!dirs.length) return console.log(`(없음) ${root} 아래 캡처가 없습니다.`);
  console.log(`캡처 ${dirs.length}개:`);
  for (const d of dirs) {
    const m = JSON.parse(readFileSync(join(root, d, "manifest.json"), "utf8"));
    console.log(`  - ${d}  (섹션 ${m.sections?.length ?? 0}, 콜 ${m.calls?.length ?? 0}, page="${m.source?.page ?? "?"}")`);
  }
}

function checkCapture(dir) {
  if (!dir) {
    console.error("사용법: node scripts/mcp-cache.mjs check <capture-dir>");
    process.exit(1);
  }
  const manifestPath = join(dir, "manifest.json");
  if (!existsSync(manifestPath)) {
    console.error(`❌ ${manifestPath} 없음`);
    process.exit(1);
  }
  const m = JSON.parse(readFileSync(manifestPath, "utf8"));
  const errors = [];
  const warnings = [];

  const calls = m.calls ?? [];
  if (!calls.length) errors.push("calls[] 비어있음 — 기록된 MCP 응답이 없음");

  // 콜 로그가 가리키는 파일이 실제로 존재하는지
  const tools = new Set();
  for (const c of calls) {
    tools.add(c.tool);
    if (!c.file) { errors.push(`콜(${c.tool}/${c.scope})에 file 없음`); continue; }
    if (!existsSync(join(dir, c.file))) errors.push(`파일 누락: ${c.file} (${c.tool}/${c.scope})`);
  }

  // 4개 핵심 도구가 최소 1회씩 캡처됐는지
  for (const t of ["get_metadata", "get_variable_defs", "get_design_context", "get_screenshot"]) {
    if (!tools.has(t)) warnings.push(`${t} 캡처 없음 — 이 도구는 재생 시 비게 됨`);
  }

  // 섹션별 커버리지 (스크린샷/컨텍스트가 섹션 수만큼 있는지)
  for (const s of m.sections ?? []) {
    const hasShot = calls.some((c) => c.scope === `section:${s.slug}` && c.tool === "get_screenshot") ||
      calls.some((c) => c.scope === "page" && c.tool === "get_screenshot");
    if (!hasShot) warnings.push(`섹션 '${s.slug}' 스크린샷 커버 안 됨 (교차검증 §8 불가)`);

    const sectionContext = calls.find((c) => c.scope === `section:${s.slug}` && c.tool === "get_design_context");
    if (sectionContext?.file && existsSync(join(dir, sectionContext.file))) {
      const context = JSON.parse(readFileSync(join(dir, sectionContext.file), "utf8"));
      if (!context.code && context.codeSummary) {
        const metadataCall = calls.find((c) => c.tool === "get_metadata" && (c.scope === `section:${s.slug}` || c.scope === "page"));
        if (!metadataCall?.file || !existsSync(join(dir, metadataCall.file))) {
          errors.push(`섹션 '${s.slug}'가 codeSummary 응답인데 leaf 커버리지를 검사할 metadata가 없음`);
          continue;
        }
        const leaves = metadataLeaves(readFileSync(join(dir, metadataCall.file), "utf8"));
        const detailed = new Set(calls.filter((c) => c.tool === "get_design_context" && c.args?.nodeId && c.file && existsSync(join(dir, c.file)))
          .filter((c) => JSON.parse(readFileSync(join(dir, c.file), "utf8")).code)
          .map((c) => c.args.nodeId));
        const missing = leaves.filter((leaf) => !detailed.has(leaf.id));
        if (missing.length) {
          errors.push(`섹션 '${s.slug}' codeSummary leaf detail 누락 ${missing.length}개: ${missing.map((leaf) => `${leaf.name}(${leaf.id})`).join(", ")}`);
        }
      }
    }
  }

  if (errors.length) {
    console.error("❌ 캡처 불완전:\n - " + errors.join("\n - "));
    if (warnings.length) console.warn("⚠️  경고:\n - " + warnings.join("\n - "));
    process.exit(1);
  }
  if (warnings.length) console.warn("⚠️  경고:\n - " + warnings.join("\n - "));
  console.log(`✅ 캡처 완결 (${dir}): 콜 ${calls.length}, 도구 [${[...tools].join(", ")}]`);
}

function metadataLeaves(xml) {
  const leaves = [];
  for (const match of xml.matchAll(/<instance\b([^>]*?)\/>/g)) {
    const attrs = {};
    for (const attr of match[1].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[attr[1]] = attr[2];
    if (attrs.id) leaves.push({ id: attrs.id, name: attrs.name ?? "instance" });
  }
  return leaves;
}

// 캐시 지문: manifest의 콜 로그가 가리키는 모든 파일 내용의 sha1.
// 브릿지 meta.sourceFingerprint와 같으면 원시 입력이 동일 → 브릿지 재추출을 스킵할 수 있다 (rules §10).
function fingerprintCapture(dir) {
  if (!dir) {
    console.error("사용법: node scripts/mcp-cache.mjs fingerprint <capture-dir>");
    process.exit(1);
  }
  const m = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const h = createHash("sha1");
  for (const c of (m.calls ?? []).slice().sort((a, b) => (a.file ?? "").localeCompare(b.file ?? ""))) {
    if (!c.file || !existsSync(join(dir, c.file))) continue;
    h.update(c.file);
    h.update(readFileSync(join(dir, c.file)));
  }
  console.log(h.digest("hex").slice(0, 16));
}

if (cmd === "list") listCaptures(arg);
else if (cmd === "check") checkCapture(arg);
else if (cmd === "fingerprint") fingerprintCapture(arg);
else {
  console.error("사용법:\n  node scripts/mcp-cache.mjs list\n  node scripts/mcp-cache.mjs check <capture-dir>\n  node scripts/mcp-cache.mjs fingerprint <capture-dir>");
  process.exit(1);
}
