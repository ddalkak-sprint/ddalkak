import { countRegionMismatch } from "./diff.mjs";

export function collectRegions(screen, diffContext, thresholds) {
  const regions = [];
  for (const node of screen.nodes ?? []) {
    walkNode({
      node,
      parentAbs: [0, 0],
      path: [screen.name],
      regions,
      diffContext,
      thresholds
    });
  }
  return regions
    .filter((region) => region.pixels.total > 0)
    .sort((a, b) => b.mismatchRatio - a.mismatchRatio);
}

function walkNode({ node, parentAbs, path, regions, diffContext, thresholds }) {
  const local = Array.isArray(node.bbox) ? node.bbox : null;
  const abs = local
    ? [parentAbs[0] + local[0], parentAbs[1] + local[1], local[2], local[3]]
    : [parentAbs[0], parentAbs[1], 0, 0];
  const name = node.name ?? node.semanticRole ?? node.componentName ?? node.type;
  const nextPath = [...path, name];

  if (local) {
    const pixels = countRegionMismatch({
      baseline: diffContext.baseline,
      actual: diffContext.actual,
      bbox: abs,
      threshold: thresholds.pixelmatch
    });
    regions.push({
      id: nextPath.join("/"),
      name,
      type: node.type,
      bbox: abs.map((v) => Math.round(v)),
      confidence: roundMetric(pixels.confidence),
      mismatchRatio: roundMetric(pixels.mismatchRatio),
      severity: severityFor(pixels.mismatchRatio),
      pixels: {
        total: pixels.total,
        mismatch: pixels.mismatch
      }
    });
  }

  for (const child of node.children ?? []) {
    walkNode({
      node: child,
      parentAbs: local ? [abs[0], abs[1]] : parentAbs,
      path: nextPath,
      regions,
      diffContext,
      thresholds
    });
  }
}

export function decideStatus({ confidence, regions, thresholds }) {
  const hasFailRegion = regions.some((region) => region.mismatchRatio >= 0.10);
  const hasConditionalRegion = regions.some((region) => region.mismatchRatio >= 0.03);
  if (confidence < thresholds.conditional || hasFailRegion) return "fail";
  if (confidence < thresholds.pass || hasConditionalRegion) return "conditional";
  return "pass";
}

function severityFor(mismatchRatio) {
  if (mismatchRatio >= 0.10) return "major";
  if (mismatchRatio >= 0.03) return "minor";
  return "none";
}

function roundMetric(value) {
  return Number(value.toFixed(6));
}
