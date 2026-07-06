import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { captureRender } from "./capture.mjs";
import { resolveRunConfig, toProjectRelative } from "./config.mjs";
import { diffImages } from "./diff.mjs";
import { assertExactImageSize, normalizePng } from "./image.mjs";
import { collectRegions, decideStatus } from "./regions.mjs";
import { writeReport } from "./report.mjs";

export async function runVisualVerify(args = {}) {
  const run = resolveRunConfig(args);
  mkdirSync(run.outputDir, { recursive: true });

  const stem = `${run.name}.${run.breakpoint}`;
  const baselineArtifact = resolve(run.outputDir, `${stem}.baseline.png`);
  const actualArtifact = resolve(run.outputDir, `${stem}.render.png`);
  const diffArtifact = resolve(run.outputDir, `${stem}.diff.png`);
  const visualArtifact = resolve(run.outputDir, `${stem}.visual.json`);
  const reportArtifact = resolve(run.outputDir, `${run.name}.verify.md`);

  await normalizePng({
    source: run.baseline.path,
    dest: baselineArtifact,
    expected: run.viewport,
    label: "baseline"
  });

  await captureRender({
    url: run.url,
    selector: run.selector,
    viewport: run.viewport,
    timeoutMs: run.timeoutMs,
    outputPath: actualArtifact
  });
  await assertExactImageSize(actualArtifact, run.viewport, "actual");

  const diff = diffImages({
    baselinePath: baselineArtifact,
    actualPath: actualArtifact,
    diffPath: diffArtifact,
    threshold: run.thresholds.pixelmatch
  });
  const confidence = roundMetric(diff.confidence);
  const regions = collectRegions(run.screen, diff, run.thresholds);
  const status = decideStatus({ confidence, regions, thresholds: run.thresholds });

  const result = {
    name: run.name,
    screen: run.breakpoint,
    status,
    passed: status === "pass",
    confidence,
    thresholds: run.thresholds,
    pixels: {
      total: diff.total,
      mismatch: diff.mismatch,
      mismatchRatio: roundMetric(diff.mismatchRatio)
    },
    viewport: run.viewport,
    artifacts: {
      baseline: toProjectRelative(run.projectRoot, baselineArtifact),
      actual: toProjectRelative(run.projectRoot, actualArtifact),
      diff: toProjectRelative(run.projectRoot, diffArtifact),
      visual: toProjectRelative(run.projectRoot, visualArtifact),
      report: toProjectRelative(run.projectRoot, reportArtifact)
    },
    source: {
      bridge: toProjectRelative(run.projectRoot, run.bridgePath),
      baseline: toProjectRelative(run.projectRoot, run.baseline.path),
      url: run.url,
      selector: run.selector
    },
    regions
  };

  writeFileSync(visualArtifact, `${JSON.stringify(result, null, 2)}\n`);
  writeReport({ result, reportPath: reportArtifact });
  return result;
}

export function exitCodeForResult(result) {
  return result.status === "pass" ? 0 : 1;
}

function roundMetric(value) {
  return Number(value.toFixed(6));
}
