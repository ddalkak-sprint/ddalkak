import { flattenBridgeNodes, iou, normalizeText } from "./match.mjs";

export const DEFAULT_TOLERANCE = {
  position: 2,
  size: 2,
  color: 3,
  fontSize: 1,
  borderRadius: 1
};
const CONTAINER_STYLE_IOU_THRESHOLD = 0.6;

export function collectStyleChecks({ bridge, screen, matches, domSnapshot }) {
  const bridgeNodes = new Map(flattenBridgeNodes(screen).map((node) => [node.path, node]));
  const items = [];

  for (const match of matches) {
    const bridgeNode = bridgeNodes.get(match.nodePath);
    if (!bridgeNode) continue;
    if (!match.matched || !match.domCandidate) {
      if (shouldWarnUnmatched(bridgeNode)) {
        items.push(checkItem({
          id: `${match.nodePath}:match`,
          nodePath: match.nodePath,
          kind: "match",
          expected: "matched DOM candidate",
          actual: "unmatched",
          status: "warn",
          severity: "minor"
        }));
      }
      continue;
    }

    if (bridgeNode.type !== "text") pushGeometryChecks(items, bridgeNode, match);
    if (bridgeNode.type === "text") {
      pushTextStyleChecks(items, bridge, bridgeNode, match);
    } else if (isContainerStyleSafe(bridgeNode, match)) {
      pushContainerStyleChecks(items, bridge, bridgeNode, match);
    }
    pushRunChecks(items, bridge, bridgeNode, match, domSnapshot);
  }

  return {
    gating: false,
    summary: summarizeChecks(items),
    items
  };
}

export function statusFromChecks(checks) {
  if (checks.items.some((item) => item.status === "fail" && item.severity === "major")) return "fail";
  if (checks.items.some((item) => item.status === "fail" || item.status === "warn")) return "conditional";
  return "pass";
}

function pushGeometryChecks(items, bridgeNode, match) {
  if (!bridgeNode.bbox || !match.bbox) return;
  const labels = ["x", "y", "width", "height"];
  for (let i = 0; i < labels.length; i++) {
    const tolerance = i < 2 ? DEFAULT_TOLERANCE.position : DEFAULT_TOLERANCE.size;
    const expected = bridgeNode.bbox[i];
    const actual = match.bbox[i];
    const delta = roundNumber(actual - expected);
    const absDelta = Math.abs(delta);
    items.push(checkItem({
      id: `${bridgeNode.path}:geometry.${labels[i]}`,
      nodePath: bridgeNode.path,
      kind: `geometry.${labels[i]}`,
      expected,
      actual,
      delta,
      tolerance,
      status: absDelta <= tolerance ? "pass" : "fail",
      severity: labels[i] === "height" || labels[i] === "width" ? "minor" : "minor"
    }));
  }
}

function pushTextStyleChecks(items, bridge, bridgeNode, match) {
  const node = bridgeNode.node;
  const style = match.domCandidate.style;
  const font = resolveFont(bridge, node.style?.font);
  if (font) {
    compareNumber(items, bridgeNode.path, "font.size", font.size, pxNumber(style.fontSize), DEFAULT_TOLERANCE.fontSize, "minor");
    compareExact(items, bridgeNode.path, "font.weight", String(font.weight), String(parseInt(style.fontWeight, 10)), "minor");
    const expectedLineHeight = expectedLineHeightPx(font);
    if (expectedLineHeight !== null && style.lineHeight !== "normal") {
      compareNumber(items, bridgeNode.path, "font.lineHeight", expectedLineHeight, pxNumber(style.lineHeight), DEFAULT_TOLERANCE.fontSize, "minor");
    }
  }

  const fillColor = firstSolidColor(bridge, node.style?.fills);
  if (fillColor) {
    compareColor(items, bridgeNode.path, "text.color", fillColor, style.color, "major");
  }
}

function pushContainerStyleChecks(items, bridge, bridgeNode, match) {
  const node = bridgeNode.node;
  const style = match.domCandidate.style;

  const fillColor = firstSolidColor(bridge, node.style?.fills);
  if (fillColor) compareColor(items, bridgeNode.path, "fill.color", fillColor, style.backgroundColor, "major");

  const stroke = node.style?.strokes?.[0];
  if (stroke) {
    const expectedColor = resolveToken(bridge, stroke.color);
    if (expectedColor) compareColor(items, bridgeNode.path, "stroke.color", expectedColor, style.borderColor, "minor");
    compareNumber(items, bridgeNode.path, "stroke.width", Number(stroke.weight), pxNumber(style.borderWidth), 0, "minor");
  }

  const radius = resolveRadius(bridge, node.style?.cornerRadius);
  if (radius !== null) {
    compareNumber(items, bridgeNode.path, "radius", radius, pxNumber(style.borderRadius), DEFAULT_TOLERANCE.borderRadius, "minor");
  }
}

function pushRunChecks(items, bridge, bridgeNode, match, domSnapshot) {
  const runs = bridgeNode.node.runs ?? [];
  for (const run of runs) {
    const expectedText = normalizeText(run.text);
    if (!expectedText) continue;
    const candidateResult = findRunCandidate({ textNodes: domSnapshot.textNodes, expectedText, match, bridgeNode });
    if (!candidateResult.candidate) {
      items.push(checkItem({
        id: `${bridgeNode.path}:run.${expectedText}:match`,
        nodePath: bridgeNode.path,
        kind: "run.match",
        expected: expectedText,
        actual: candidateResult.reason,
        status: "warn",
        severity: "minor"
      }));
      continue;
    }
    const candidate = candidateResult.candidate;
    const expectedColor = firstSolidColor(bridge, run.style?.fills);
    if (expectedColor) {
      compareColor(items, bridgeNode.path, `run.color:${expectedText}`, expectedColor, candidate.style.color, "major");
    }
    const font = resolveFont(bridge, run.style?.font);
    if (font) {
      compareNumber(items, bridgeNode.path, `run.font.size:${expectedText}`, font.size, pxNumber(candidate.style.fontSize), DEFAULT_TOLERANCE.fontSize, "minor");
      compareExact(items, bridgeNode.path, `run.font.weight:${expectedText}`, String(font.weight), String(parseInt(candidate.style.fontWeight, 10)), "minor");
    }
  }
}

function shouldWarnUnmatched(bridgeNode) {
  const node = bridgeNode.node;
  if (bridgeNode.type === "image" || bridgeNode.type === "vector") return false;
  return Boolean(
    bridgeNode.text ||
    node.runs?.length ||
    node.style?.font ||
    node.style?.fills?.length ||
    node.style?.strokes?.length ||
    node.style?.cornerRadius !== undefined
  );
}

function isContainerStyleSafe(bridgeNode, match) {
  if (!bridgeNode.bbox || !match.bbox) return false;
  if (!["frame", "group", "instance", "component"].includes(bridgeNode.type)) return false;
  return iou(bridgeNode.bbox, match.bbox) >= CONTAINER_STYLE_IOU_THRESHOLD;
}

function findRunCandidate({ textNodes, expectedText, match, bridgeNode }) {
  const candidates = textNodes.filter((textNode) => normalizeText(textNode.text) === expectedText);
  if (!candidates.length) return { candidate: null, reason: "unmatched" };

  const referenceBox = match.bbox ?? bridgeNode.bbox;
  if (!referenceBox) {
    return candidates.length === 1
      ? { candidate: candidates[0], reason: "unique-text" }
      : { candidate: null, reason: "ambiguous duplicate text" };
  }

  const inside = candidates.filter((candidate) => boxCenterInside(boxArrayFromObject(candidate.bbox), referenceBox));
  const pool = inside.length ? inside : candidates;
  const ranked = pool
    .map((candidate) => ({
      candidate,
      distance: centerDistance(boxArrayFromObject(candidate.bbox), referenceBox)
    }))
    .sort((a, b) => a.distance - b.distance);

  if (ranked.length > 1 && !inside.length && Math.abs(ranked[0].distance - ranked[1].distance) < 1) {
    return { candidate: null, reason: "ambiguous duplicate text" };
  }

  return { candidate: ranked[0].candidate, reason: inside.length ? "inside-parent-bbox" : "closest-text" };
}

function boxArrayFromObject(box) {
  return [box.x, box.y, box.width, box.height].map((value) => Math.round(value));
}

function boxCenterInside(box, container) {
  const x = box[0] + box[2] / 2;
  const y = box[1] + box[3] / 2;
  return x >= container[0] && x <= container[0] + container[2] && y >= container[1] && y <= container[1] + container[3];
}

function centerDistance(a, b) {
  return Math.hypot((a[0] + a[2] / 2) - (b[0] + b[2] / 2), (a[1] + a[3] / 2) - (b[1] + b[3] / 2));
}

function compareNumber(items, nodePath, kind, expected, actual, tolerance, severity) {
  if (!Number.isFinite(expected) || !Number.isFinite(actual)) return;
  const delta = roundNumber(actual - expected);
  items.push(checkItem({
    id: `${nodePath}:${kind}`,
    nodePath,
    kind,
    expected: roundNumber(expected),
    actual: roundNumber(actual),
    delta,
    tolerance,
    status: Math.abs(delta) <= tolerance ? "pass" : "fail",
    severity
  }));
}

function compareExact(items, nodePath, kind, expected, actual, severity) {
  items.push(checkItem({
    id: `${nodePath}:${kind}`,
    nodePath,
    kind,
    expected,
    actual,
    delta: expected === actual ? 0 : null,
    tolerance: 0,
    status: expected === actual ? "pass" : "fail",
    severity
  }));
}

function compareColor(items, nodePath, kind, expected, actual, severity) {
  const expectedRgb = parseColor(expected);
  const actualRgb = parseColor(actual);
  if (!expectedRgb || !actualRgb) return;
  const delta = Math.max(
    Math.abs(expectedRgb.r - actualRgb.r),
    Math.abs(expectedRgb.g - actualRgb.g),
    Math.abs(expectedRgb.b - actualRgb.b),
    Math.abs(expectedRgb.a - actualRgb.a)
  );
  items.push(checkItem({
    id: `${nodePath}:${kind}`,
    nodePath,
    kind,
    expected: rgbString(expectedRgb),
    actual: rgbString(actualRgb),
    delta,
    tolerance: DEFAULT_TOLERANCE.color,
    status: delta <= DEFAULT_TOLERANCE.color ? "pass" : "fail",
    severity
  }));
}

function checkItem(item) {
  return {
    id: item.id,
    nodePath: item.nodePath,
    kind: item.kind,
    expected: item.expected,
    actual: item.actual,
    delta: item.delta ?? null,
    tolerance: item.tolerance ?? null,
    status: item.status,
    severity: item.severity
  };
}

function summarizeChecks(items) {
  return {
    total: items.length,
    pass: items.filter((item) => item.status === "pass").length,
    warn: items.filter((item) => item.status === "warn").length,
    fail: items.filter((item) => item.status === "fail").length
  };
}

function resolveFont(bridge, value) {
  if (!value) return null;
  const resolved = resolveToken(bridge, value);
  return resolved && typeof resolved === "object" ? resolved : null;
}

function resolveRadius(bridge, value) {
  if (value === undefined) return null;
  const resolved = resolveToken(bridge, value);
  if (typeof resolved === "number") return resolved;
  if (typeof resolved === "string") return Number(resolved);
  if (Array.isArray(resolved)) return Number(resolved[0]);
  return Number.isFinite(value) ? Number(value) : null;
}

function firstSolidColor(bridge, fills) {
  const solid = fills?.find((fill) => fill.type === "solid" && fill.color);
  return solid ? resolveToken(bridge, solid.color) : null;
}

function resolveToken(bridge, value) {
  if (typeof value !== "string" || !value.startsWith("@")) return value;
  const path = value.slice(1).split(".");
  let cur = bridge.tokens;
  for (const key of path) {
    if (cur == null || typeof cur !== "object" || !(key in cur)) return null;
    cur = cur[key];
  }
  return cur;
}

function expectedLineHeightPx(font) {
  if (typeof font.lineHeight === "number") {
    return font.lineHeight <= 3 ? font.size * font.lineHeight : font.lineHeight;
  }
  if (typeof font.lineHeight === "string" && font.lineHeight.endsWith("px")) return pxNumber(font.lineHeight);
  return null;
}

function pxNumber(value) {
  const match = String(value ?? "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function parseColor(value) {
  const text = String(value ?? "").trim();
  if (text.startsWith("#")) {
    const hex = text.slice(1);
    if (![6, 8].includes(hex.length)) return null;
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) : 255
    };
  }
  const match = text.match(/rgba?\(([^)]+)\)/);
  if (!match) return null;
  const parts = match[1].split(",").map((part) => part.trim());
  const [r, g, b] = parts.slice(0, 3).map(Number);
  const a = parts[3] === undefined ? 255 : alphaToByte(parts[3]);
  if (![r, g, b, a].every(Number.isFinite)) return null;
  return { r, g, b, a };
}

function rgbString(color) {
  if (color.a !== 255) return `rgba(${color.r}, ${color.g}, ${color.b}, ${roundNumber(color.a / 255)})`;
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

function roundNumber(value) {
  return Number(value.toFixed(3));
}

function alphaToByte(value) {
  if (String(value).endsWith("%")) return Math.round(Number(String(value).slice(0, -1)) * 2.55);
  const n = Number(value);
  return n <= 1 ? Math.round(n * 255) : n;
}
