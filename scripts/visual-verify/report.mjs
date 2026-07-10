import { writeFileSync } from "node:fs";

export function writeReport({ result, reportPath }) {
  const icon = result.status === "pass" ? "✅" : result.status === "conditional" ? "⚠️" : "❌";
  const topRegions = result.regions
    .filter((region) => region.severity !== "none")
    .slice(0, 12);
  const failedChecks = (result.checks?.items ?? [])
    .filter((item) => item.status !== "pass")
    .sort(compareCheckPriority)
    .slice(0, 12);

  const lines = [
    `# verify.md — ${result.name}`,
    "",
    "> 딸깍 verify 단계 리포트. LLM 판단 없이 screenshot diff로 판정하고 DOM/computed-style은 advisory evidence로 기록.",
    "",
    "## 대조 대상",
    `- 화면: ${result.name} (${result.screen})`,
    `- 기준 이미지: \`${result.artifacts.baseline}\``,
    `- 렌더 이미지: \`${result.artifacts.actual}\``,
    `- Diff 이미지: \`${result.artifacts.diff}\``,
    `- Raw JSON: \`${result.artifacts.visual}\``,
    "",
    "## 결과 요약",
    `- 판정: ${icon} ${statusLabel(result.status)}`,
    `- 신뢰도: ${(result.confidence * 100).toFixed(3)}%`,
    `- 픽셀 불일치: ${result.pixels.mismatch.toLocaleString()} / ${result.pixels.total.toLocaleString()} (${(result.pixels.mismatchRatio * 100).toFixed(3)}%)`,
    result.statuses ? `- 세부 판정: pixel=${result.statuses.pixel}, style(advisory)=${result.statuses.style}` : null,
    result.checks ? `- Style checks(advisory, not gate): pass ${result.checks.summary.pass}, warn ${result.checks.summary.warn}, fail ${result.checks.summary.fail}` : null,
    `- 기준값: pass ≥ ${(result.thresholds.pass * 100).toFixed(1)}%, conditional ≥ ${(result.thresholds.conditional * 100).toFixed(1)}%, pixelmatch threshold ${result.thresholds.pixelmatch}`,
    "",
    "## 영역별 불일치",
    topRegions.length
      ? "| 영역 | 타입 | bbox | mismatch | severity |\n|---|---:|---:|---:|---|"
      : "- 유의미한 영역별 불일치 없음"
  ].filter(Boolean);

  for (const region of topRegions) {
    lines.push(`| ${escapeCell(region.id)} | ${region.type} | [${region.bbox.join(", ")}] | ${(region.mismatchRatio * 100).toFixed(3)}% | ${region.severity} |`);
  }

  lines.push("", "## Style checks (advisory, not gate)");
  if (failedChecks.length) {
    lines.push("| 항목 | expected | actual | delta | status | severity |", "|---|---:|---:|---:|---:|---|");
    for (const item of failedChecks) {
      lines.push(`| ${escapeCell(item.id)} | ${escapeCell(formatValue(item.expected))} | ${escapeCell(formatValue(item.actual))} | ${formatValue(item.delta)} | ${item.status} | ${item.severity} |`);
    }
  } else {
    lines.push("- 실패 또는 경고 style check 없음");
  }

  lines.push(
    "",
    "## 다음 단계",
    result.status === "pass"
      ? "- finalize 진행 가능."
      : "- diff 이미지와 영역별 mismatch가 큰 노드를 우선 보고, style check는 수정 후보를 좁히는 보조 증거로만 사용."
  );

  writeFileSync(reportPath, `${lines.join("\n")}\n`);
}

function statusLabel(status) {
  if (status === "pass") return "통과";
  if (status === "conditional") return "조건부 통과";
  return "실패";
}

function compareCheckPriority(a, b) {
  return checkRank(a) - checkRank(b) || a.id.localeCompare(b.id);
}

function checkRank(item) {
  const statusRank = item.status === "fail" ? 0 : 10;
  const severityRank = item.severity === "major" ? 0 : 3;
  const kindRank = item.kind.startsWith("run.") ? 0
    : item.kind.includes("color") ? 1
      : item.kind.startsWith("font.") ? 2
        : item.kind.startsWith("geometry.") ? 4
          : 3;
  return statusRank + severityRank + kindRank;
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|");
}

function formatValue(value) {
  if (Array.isArray(value)) return `[${value.join(", ")}]`;
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value);
}
