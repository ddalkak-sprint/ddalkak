import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { captureRender } from "./capture.mjs";
import { resolveRunConfig, toProjectRelative } from "./config.mjs";
import { diffImages } from "./diff.mjs";
import { assertExactImageSize, normalizePng } from "./image.mjs";
import { matchBridgeToDom } from "./match.mjs";
import { collectRegions, decideStatus } from "./regions.mjs";
import { writeReport } from "./report.mjs";
import { collectStyleChecks, statusFromChecks } from "./style-checks.mjs";

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

  const capture = await captureRender({
    url: run.url,
    selector: run.selector,
    viewport: run.viewport,
    timeoutMs: run.timeoutMs,
    outputPath: actualArtifact,
    target: run.target
  });
  await assertExactImageSize(actualArtifact, run.viewport, "actual");

  const diff = diffImages({
    baselinePath: baselineArtifact,
    actualPath: actualArtifact,
    diffPath: diffArtifact,
    threshold: run.thresholds.pixelmatch
  });
  const confidence = roundMetric(diff.confidence);
  const implementationRate = roundRate(confidence * 100);
  const regions = collectRegions(run.screen, diff, run.thresholds);
  const pixelStatus = decideStatus({ confidence, regions, thresholds: run.thresholds });
  // DOM-based matching and style checks need a DOM snapshot. Canvas platforms (Flutter Web) have
  // none, so we skip them and let the pixel gate stand alone — style is reported as "n/a", never as
  // a silent pass. The final verdict (status = pixelStatus) is unchanged.
  const hasDom = capture.domSnapshot != null;
  const { matches } = hasDom
    ? matchBridgeToDom({ screen: run.screen, domSnapshot: capture.domSnapshot })
    : { matches: [] };
  const checks = hasDom
    ? collectStyleChecks({ bridge: run.bridge, screen: run.screen, matches, domSnapshot: capture.domSnapshot })
    : { gating: false, applicable: false, summary: { total: 0, pass: 0, warn: 0, fail: 0 }, items: [] };
  const styleStatus = hasDom ? statusFromChecks(checks) : "n/a";
  const status = pixelStatus;

  const result = {
    version: "2.0",
    name: run.name,
    screen: run.breakpoint,
    status,
    passed: status === "pass",
    confidence,
    implementationRate,
    statuses: {
      pixel: pixelStatus,
      style: styleStatus
    },
    thresholds: run.thresholds,
    pixels: {
      total: diff.total,
      mismatch: diff.mismatch,
      mismatchRatio: roundMetric(diff.mismatchRatio)
    },
    viewport: run.viewport,
    target: run.target,
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
      selector: run.selector,
      target: run.target?.id,
      platform: run.target?.platform,
      screenshotProvider: run.target?.screenshotProvider
    },
    regions,
    matches: matches.map(stripInternalMatchFields),
    checks
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

function roundRate(value) {
  return Number(value.toFixed(3));
}

function stripInternalMatchFields(match) {
  return {
    nodeId: match.nodeId,
    nodePath: match.nodePath,
    dkPath: match.dkPath,
    nodeName: match.nodeName,
    nodeType: match.nodeType,
    matched: match.matched,
    domId: match.domId,
    domKind: match.domKind,
    tag: match.tag,
    text: match.text,
    bbox: match.bbox,
    confidence: match.confidence,
    strategy: match.strategy
  };
}
