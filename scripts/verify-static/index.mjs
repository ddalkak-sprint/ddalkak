#!/usr/bin/env node
// 딸깍 verify v0.1 — 정적 검산 스크립트 (오케스트레이터).
// bridge.json(채점 유일 기준)에서 체크리스트를 기계 생성하고, 생성된 코드의
// Tailwind 클래스를 px/hex로 환산해 오차 0으로 대조한다. 결과는 verify.json(단일 정본)과
// 그것을 렌더링한 verify.md로 출력한다.
//
// 사용법: node scripts/verify-static.mjs <projectRoot> <name>
//   예:   node scripts/verify-static.mjs sandbox login-page
//
// 규칙의 원본 문서: shared/verify-normalization-rules.md (SSOT)
//  - 판정은 3-상태: pass | mismatch | match_failure. 조용한 누락 금지.
//  - 매칭: data-dk 우선(결정론) → 폴백(mappedCodeComponent/suggestedComponent/content/asset).
//    폴백 후보 2개 이상이면 즉시 match_failure (임의 선택 금지).
//  - 점수 분모는 전체 항목. 리포트 판정은 mismatch 0 AND match_failure 0일 때만 PASS.
//  - 같은 입력 → 바이트 동일 출력 (타임스탬프 없음).
//  - 브릿지 스키마 1.1(목업)과 2.1(figma-extractor 산출)을 모두 지원. meta.schemaVersion으로 분기.
//
// 모듈 구성: context(공유 상태) / normalize / tailwind / checklist / files / jsx-scan /
//            match / extract / grade / report — 각 모듈은 규칙표(SSOT) 섹션과 대응한다.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { initContext, ctx } from "./context.mjs";
import { normalizeHex } from "./normalize.mjs";
import { loadTailwindTheme } from "./tailwind.mjs";
import { discoverFiles } from "./files.mjs";
import { buildChecklist } from "./checklist.mjs";
import { buildItems } from "./grade.mjs";
import { buildReport, renderMarkdown } from "./report.mjs";

// ---------------------------------------------------------------------------
// 0. 입력
// ---------------------------------------------------------------------------
const [projectRootArg, name] = process.argv.slice(2);
if (!projectRootArg || !name) {
  console.error("사용법: node scripts/verify-static.mjs <projectRoot> <name>");
  process.exit(1);
}
const projectRoot = resolve(projectRootArg);
const bridgePath = join(projectRoot, ".ddalkak", "bridge", `${name}.bridge.json`);
const planPath = join(projectRoot, ".ddalkak", "plan", `${name}.plan.md`);
const reportsDir = join(projectRoot, ".ddalkak", "reports");

if (!existsSync(bridgePath)) {
  console.error(`❌ 브릿지 없음: ${bridgePath}`);
  process.exit(1);
}
const bridge = JSON.parse(readFileSync(bridgePath, "utf8"));
const schemaVersion = String(bridge.meta?.schemaVersion ?? "1.1");
const isV21 = schemaVersion.startsWith("2");

// ---------------------------------------------------------------------------
// 1. 토큰/환산 테이블 (tailwind.config.js + bridge.tokens)
// ---------------------------------------------------------------------------
const theme = await loadTailwindTheme(projectRoot);
// bridge.tokens가 채점 기준이므로 기대값 해석은 bridge 우선, 클래스 환산은 config 우선
const bridgeColorTokens = Object.fromEntries(
  Object.entries(bridge.tokens?.color ?? {}).map(([k, v]) => [k, normalizeHex(v)]),
);
const bridgeTypeTokens = bridge.tokens?.type ?? {};

// 공유 컨텍스트 초기화 — 이후 모든 모듈이 ctx를 통해 상태를 읽는다.
initContext({
  projectRoot, name, bridge, schemaVersion, isV21,
  theme, bridgeColorTokens, bridgeTypeTokens,
  bridgePath, planPath,
  planDeviations: [], checklist: [],
});

// ---------------------------------------------------------------------------
// 2~7. 파이프라인 — 파일 탐색 → 체크리스트 → 채점 → 리포트
// ---------------------------------------------------------------------------
discoverFiles();
const deduped = buildChecklist();
const items = buildItems(deduped);
const report = buildReport(items);

// ---------------------------------------------------------------------------
// 8. 출력 — verify.json이 단일 정본, verify.md는 그것의 렌더링
// ---------------------------------------------------------------------------
mkdirSync(reportsDir, { recursive: true });
const jsonPath = join(reportsDir, `${name}.verify.json`);
const mdPath = join(reportsDir, `${name}.verify.md`);
writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");
writeFileSync(mdPath, renderMarkdown(report));

console.log(`검사 ${report.summary.total} / 통과 ${report.summary.pass} / 불일치 ${report.summary.mismatch} / 매칭실패 ${report.summary.matchFailure}`);
console.log(`판정: ${report.summary.verdict} (스펙 일치 기준) · 매칭 data-dk ${report.summary.matching.dataDk} / 폴백 ${report.summary.matching.fallback}`);
for (const it of items.filter((i) => i.verdict === "mismatch")) {
  console.log(` - [mismatch] ${it.label} ${it.property}: 기대 ${it.expectedValue}, 실제 ${it.actualValue ?? "—"} @ ${it.filePath ?? "?"}:${it.lineNumber ?? "?"}${it.suggestedFix ? ` → ${it.suggestedFix}` : ""}`);
}
const failures = items.filter((i) => i.verdict === "match_failure");
if (failures.length) {
  const byReason = new Map();
  for (const f of failures) byReason.set(f.reason, (byReason.get(f.reason) ?? 0) + 1);
  console.log(` - [match_failure] ${failures.length}건 — 사유별:`);
  for (const [reason, cnt] of [...byReason.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8))
    console.log(`    · ${cnt}× ${reason}`);
}
console.log(`리포트: ${relative(process.cwd(), jsonPath)}, ${relative(process.cwd(), mdPath)}`);
