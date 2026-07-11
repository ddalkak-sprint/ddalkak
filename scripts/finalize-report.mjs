#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

class FinalizeReportError extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.name = "FinalizeReportError";
    this.exitCode = exitCode;
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) throw new FinalizeReportError(`알 수 없는 인자: ${arg}`);
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function resolveConfig(args) {
  const projectRoot = resolve(args.project ?? process.cwd());
  const configPath = resolve(projectRoot, ".ddalkak", "ddalkak.config.json");
  const config = existsSync(configPath) ? readJson(configPath) : {};
  const name = args.name ?? config.name;
  if (!name) throw new FinalizeReportError("--name 또는 .ddalkak/ddalkak.config.json.name이 필요합니다.");

  const reportsDir = resolve(projectRoot, args.output ?? ".ddalkak/reports");
  const visualPath = args.visual
    ? resolve(projectRoot, args.visual)
    : findVisualPath({ reportsDir, name, screen: args.screen });

  if (!existsSync(visualPath)) throw new FinalizeReportError(`visual.json 파일 없음: ${visualPath}`);
  return { projectRoot, name, reportsDir, visualPath };
}

function findVisualPath({ reportsDir, name, screen }) {
  if (screen) return resolve(reportsDir, `${name}.${screen}.visual.json`);
  if (!existsSync(reportsDir)) throw new FinalizeReportError(`reports 디렉토리 없음: ${reportsDir}`);

  const candidates = readdirSync(reportsDir)
    .filter((file) => file.startsWith(`${name}.`) && file.endsWith(".visual.json"))
    .sort();
  const desktop = candidates.find((file) => file === `${name}.desktop.visual.json`);
  const selected = desktop ?? candidates[0];
  if (!selected) throw new FinalizeReportError(`visual.json 파일 없음: ${resolve(reportsDir, `${name}.<screen>.visual.json`)}`);
  return resolve(reportsDir, selected);
}

function buildFinalReport({ name, visualPath, visual }) {
  const implementationRate = rateFromVisual(visual);
  const topRegions = (visual.regions ?? [])
    .filter((region) => region.severity && region.severity !== "none")
    .slice(0, 12)
    .map((region) => ({
      id: region.id,
      type: region.type,
      bbox: region.bbox,
      mismatchRate: roundRate((region.mismatchRatio ?? 0) * 100),
      severity: region.severity
    }));
  const excludedFixCandidates = collectExcludedFixCandidates(visual);

  return {
    version: "1.0",
    name,
    screen: visual.screen,
    status: visual.status,
    passed: visual.passed,
    implementationRate,
    implementationRateBasis: "pixel-confidence",
    confidence: visual.confidence,
    thresholds: visual.thresholds,
    pixels: visual.pixels,
    anchorCoverage: visual.anchors?.summary ?? null,
    topRegions,
    excludedFixCandidates,
    source: {
      visual: visual.artifacts?.visual ?? visualPath,
      report: visual.artifacts?.report ?? null,
      diff: visual.artifacts?.diff ?? null
    }
  };
}

function rateFromVisual(visual) {
  const value = visual.implementationRate ?? (visual.confidence * 100);
  return roundRate(value);
}

function roundRate(value) {
  return Number(Number(value).toFixed(3));
}

function collectExcludedFixCandidates(visual) {
  const failedChecks = (visual.checks?.items ?? []).filter((item) => item.status === "fail");
  if (!failedChecks.length) return [];

  const matchesByNodePath = new Map((visual.matches ?? []).map((match) => [match.nodePath, match]));
  return failedChecks
    .map((item) => {
      const match = matchesByNodePath.get(item.nodePath);
      if (match?.strategy === "data-dk-exact") return null;
      return {
        id: item.id,
        nodePath: item.nodePath,
        kind: item.kind,
        severity: item.severity,
        reason: match ? `strategy=${match.strategy}` : "match 없음"
      };
    })
    .filter(Boolean)
    .slice(0, 50);
}

function writeMarkdown({ finalReport, path }) {
  const icon = finalReport.status === "pass" ? "✅" : finalReport.status === "conditional" ? "⚠️" : "❌";
  const lines = [
    `# final.md — ${finalReport.name}`,
    "",
    "## 최종 결과",
    `- 판정: ${icon} ${statusLabel(finalReport.status)}`,
    `- 최종 구현율: ${finalReport.implementationRate.toFixed(3)}%`,
    `- 기준: ${finalReport.implementationRateBasis}`,
    `- 신뢰도: ${(finalReport.confidence * 100).toFixed(3)}%`,
    finalReport.anchorCoverage
      ? `- Anchors(advisory): exact ${finalReport.anchorCoverage.exact} / bridge ${finalReport.anchorCoverage.bridge}, missing ${finalReport.anchorCoverage.missing}, duplicate ${finalReport.anchorCoverage.duplicate}, unknown ${finalReport.anchorCoverage.unknown}`
      : null,
    `- 기준값: pass ≥ ${(finalReport.thresholds.pass * 100).toFixed(1)}%, conditional ≥ ${(finalReport.thresholds.conditional * 100).toFixed(1)}%, pixelmatch threshold ${finalReport.thresholds.pixelmatch}`,
    "",
    "## 주요 불일치",
    finalReport.topRegions.length
      ? "| 영역 | 타입 | bbox | mismatch | severity |\n|---|---:|---:|---:|---|"
      : "- 유의미한 영역별 불일치 없음"
  ].filter(Boolean);

  for (const region of finalReport.topRegions) {
    lines.push(`| ${escapeCell(region.id)} | ${region.type} | [${region.bbox.join(", ")}] | ${region.mismatchRate.toFixed(3)}% | ${region.severity} |`);
  }

  lines.push("", "## 자동 수정 제외 후보");
  if (finalReport.excludedFixCandidates.length) {
    lines.push("| 항목 | kind | severity | reason |", "|---|---:|---:|---|");
    for (const item of finalReport.excludedFixCandidates.slice(0, 12)) {
      lines.push(`| ${escapeCell(item.id)} | ${escapeCell(item.kind)} | ${item.severity} | ${escapeCell(item.reason)} |`);
    }
  } else {
    lines.push("- 제외 후보 없음");
  }

  writeFileSync(path, `${lines.join("\n")}\n`);
}

function statusLabel(status) {
  if (status === "pass") return "통과";
  if (status === "conditional") return "조건부 통과";
  return "실패";
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = resolveConfig(args);
  const visual = readJson(config.visualPath);
  const finalReport = buildFinalReport({ name: config.name, visualPath: config.visualPath, visual });

  mkdirSync(config.reportsDir, { recursive: true });
  const jsonPath = resolve(config.reportsDir, `${config.name}.final.json`);
  const mdPath = resolve(config.reportsDir, `${config.name}.final.md`);
  writeFileSync(jsonPath, `${JSON.stringify(finalReport, null, 2)}\n`);
  writeMarkdown({ finalReport, path: mdPath });

  console.log(`✅ finalize report: ${basename(jsonPath)}, ${basename(mdPath)} implementationRate ${finalReport.implementationRate.toFixed(3)}% (${finalReport.status})`);
}

main().catch((error) => {
  const isExpected = error instanceof FinalizeReportError;
  console.error(`${isExpected ? "❌" : "💥"} finalize error: ${error.message}`);
  if (!isExpected && error.stack) console.error(error.stack);
  process.exit(isExpected ? error.exitCode : 2);
});
