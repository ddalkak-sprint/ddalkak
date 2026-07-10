// 요약·출력 — verify.json이 단일 정본, verify.md는 그것의 렌더링. (규칙 SSOT: §6)
import { existsSync } from "node:fs";
import { relative } from "node:path";
import { ctx } from "./context.mjs";

export function buildReport(items) {
  const counts = {
    total: items.length,
    pass: items.filter((i) => i.verdict === "pass").length,
    mismatch: items.filter((i) => i.verdict === "mismatch").length,
    matchFailure: items.filter((i) => i.verdict === "match_failure").length,
  };
  const matchStats = {
    dataDk: items.filter((i) => i.matchMethod === "data-dk").length,
    fallback: items.filter((i) => i.matchMethod.startsWith("fallback")).length,
    lowTrustNodes: items.filter((i) => i.lowTrust).length,
  };
  return {
    name: ctx.name,
    schemaVersion: ctx.schemaVersion,
    claim: "spec-conformance", // v0.1은 '스펙(bridge.json) 일치'만 주장. 'Figma 일치'는 v0.2(픽셀 층)부터.
    source: {
      bridge: relative(ctx.projectRoot, ctx.bridgePath),
      plan: existsSync(ctx.planPath) ? relative(ctx.projectRoot, ctx.planPath) : null,
      normalizationRules: "shared/verify-normalization-rules.md",
    },
    summary: {
      ...counts,
      score: `${counts.pass}/${counts.total}`, // 분모는 항상 전체 항목
      scoreRatio: Math.round((counts.pass / counts.total) * 1000) / 1000,
      verdict: counts.mismatch === 0 && counts.matchFailure === 0 ? "PASS" : "FAIL",
      matching: matchStats,
    },
    planDeviations: ctx.planDeviations,
    items,
  };
}

export function renderMarkdown(r) {
  const icon = { pass: "✅", mismatch: "❌", match_failure: "⚠️" };
  const lines = [];
  lines.push(`# verify.md — ${r.name}`, "");
  lines.push(`> 딸깍 verify v0.1 정적 검산 리포트. 이 문서는 \`${r.name}.verify.json\`(단일 정본)의 렌더링이다.`);
  lines.push(`> 판정 범위: **스펙(bridge.json ${r.schemaVersion}) 일치** — 'Figma 일치' 주장은 v0.2(픽셀 비교)부터.`, "");
  lines.push(`## 대조 대상`);
  lines.push(`- 스펙: \`${r.source.bridge}\``);
  lines.push(`- 주소록: \`${r.source.plan ?? "(plan 없음 — src/ 전체 스캔)"}\``);
  lines.push(`- 정규화 규칙: \`${r.source.normalizationRules}\``, "");
  lines.push(`## 결과 요약`);
  lines.push(`- 판정: ${r.summary.verdict === "PASS" ? "✅ PASS" : "❌ FAIL"} (불일치 ${r.summary.mismatch} / 매칭실패 ${r.summary.matchFailure})`);
  lines.push(`- 점수: ${r.summary.score} (분모는 전체 항목)`);
  lines.push(`- 매칭: data-dk ${r.summary.matching.dataDk} / 폴백 ${r.summary.matching.fallback}${r.summary.matching.lowTrustNodes ? ` / 저신뢰(vision·inferred) ${r.summary.matching.lowTrustNodes}` : ""}`, "");
  if (r.planDeviations.length) {
    lines.push(`## ⚠️ 계획 이탈`);
    for (const d of r.planDeviations) lines.push(`- ${d}`);
    lines.push("");
  }
  lines.push(`## 체크리스트`);
  lines.push(`| # | 대상 | 속성 | 기대 | 실제 | 위치 | 매칭 | 판정 |`);
  lines.push(`|---|------|------|------|------|------|------|------|`);
  r.items.forEach((it, i) => {
    const loc = it.filePath ? `${it.filePath}:${it.lineNumber ?? "?"}` : "—";
    const matching = it.matchMethod === "none" ? "—" : `${it.matchMethod}(${it.matchConfidence})`;
    lines.push(
      `| ${i + 1} | ${it.label} | ${it.property} | ${it.expectedValue} | ${it.actualValue ?? "—"} | ${loc} | ${matching} | ${icon[it.verdict]} |`,
    );
  });
  lines.push("");
  const problems = r.items.filter((it) => it.verdict !== "pass");
  if (problems.length) {
    lines.push(`## 불일치·매칭실패 상세`);
    problems.forEach((it) => {
      lines.push(`- **[${it.verdict}] ${it.label} — ${it.property}** (\`${it.nodeId}\`)`);
      if (it.filePath) lines.push(`  - 위치: \`${it.filePath}:${it.lineNumber ?? "?"}\``);
      if (it.actualValue) lines.push(`  - 기대 ${it.expectedValue} ≠ 실제 ${it.actualValue} (\`${it.tailwindClass}\`)`);
      if (it.suggestedFix) lines.push(`  - 제안: ${it.suggestedFix}`);
      if (it.reason) lines.push(`  - 사유: ${it.reason}`);
    });
    lines.push("");
  }
  lines.push(`## 다음 단계`);
  lines.push(
    r.summary.verdict === "PASS"
      ? `- 통과 — finalize 진행 가능 (v0.2 픽셀 검증은 별도)`
      : `- 제안 수정 반영 후 재검증 (\`node scripts/verify-static.mjs <projectRoot> ${r.name}\`)`,
  );
  return lines.join("\n") + "\n";
}
