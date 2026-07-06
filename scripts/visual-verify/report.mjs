import { writeFileSync } from "node:fs";

export function writeReport({ result, reportPath }) {
  const icon = result.status === "pass" ? "✅" : result.status === "conditional" ? "⚠️" : "❌";
  const topRegions = result.regions
    .filter((region) => region.severity !== "none")
    .slice(0, 12);

  const lines = [
    `# verify.md — ${result.name}`,
    "",
    "> 딸깍 verify 단계 리포트. LLM 판단 없이 screenshot 기반 visual diff로 생성.",
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
    `- 기준값: pass ≥ ${(result.thresholds.pass * 100).toFixed(1)}%, conditional ≥ ${(result.thresholds.conditional * 100).toFixed(1)}%, pixelmatch threshold ${result.thresholds.pixelmatch}`,
    "",
    "## 영역별 불일치",
    topRegions.length
      ? "| 영역 | 타입 | bbox | mismatch | severity |\n|---|---:|---:|---:|---|"
      : "- 유의미한 영역별 불일치 없음"
  ];

  for (const region of topRegions) {
    lines.push(`| ${escapeCell(region.id)} | ${region.type} | [${region.bbox.join(", ")}] | ${(region.mismatchRatio * 100).toFixed(3)}% | ${region.severity} |`);
  }

  lines.push(
    "",
    "## 다음 단계",
    result.status === "pass"
      ? "- finalize 진행 가능."
      : "- diff 이미지와 영역별 mismatch가 큰 노드를 기준으로 수정 후 재검증."
  );

  writeFileSync(reportPath, `${lines.join("\n")}\n`);
}

function statusLabel(status) {
  if (status === "pass") return "통과";
  if (status === "conditional") return "조건부 통과";
  return "실패";
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|");
}
