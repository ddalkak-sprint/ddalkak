export function flattenBridgeNodes(screen) {
  const nodes = [];
  for (const [index, node] of (screen.nodes ?? []).entries()) {
    walkBridgeNode({
      node,
      parentAbs: [0, 0],
      path: [screen.name],
      dkPath: `children[${index}]`,
      nodes
    });
  }
  return nodes;
}

export function matchBridgeToDom({ screen, domSnapshot }) {
  const bridgeNodes = flattenBridgeNodes(screen);
  const matches = bridgeNodes.map((bridgeNode) => {
    const match = bestDomMatch(bridgeNode, domSnapshot);
    return {
      nodeId: bridgeNode.id,
      nodePath: bridgeNode.path,
      dkPath: bridgeNode.dkPath,
      nodeName: bridgeNode.name,
      nodeType: bridgeNode.type,
      matched: match.confidence >= 0.35,
      domId: match.candidate?.id ?? null,
      domKind: match.candidate?.kind ?? null,
      tag: match.candidate?.tag ?? null,
      text: match.candidate?.text ?? "",
      bbox: match.candidate ? boxArray(match.candidate.bbox) : null,
      confidence: roundMetric(match.confidence),
      strategy: match.strategy,
      expected: {
        text: bridgeNode.text,
        bbox: bridgeNode.bbox,
        dkPath: bridgeNode.dkPath
      },
      bridgeNode,
      domCandidate: match.candidate ?? null
    };
  });
  return { matches };
}

function walkBridgeNode({ node, parentAbs, path, dkPath, nodes }) {
  const local = Array.isArray(node.bbox) ? node.bbox : null;
  const abs = local
    ? [parentAbs[0] + local[0], parentAbs[1] + local[1], local[2], local[3]]
    : null;
  const name = node.name ?? node.semanticRole ?? node.componentName ?? node.type;
  const nextPath = [...path, name];
  const text = normalizeText(node.content ?? (node.runs ?? []).map((run) => run.text).join(""));
  const item = {
    id: nextPath.join("/"),
    path: nextPath.join("/"),
    name,
    type: node.type,
    node,
    text,
    dkPath,
    bbox: abs?.map((value) => Math.round(value)) ?? null
  };
  nodes.push(item);

  for (const [index, child] of (node.children ?? []).entries()) {
    walkBridgeNode({
      node: child,
      parentAbs: abs ? [abs[0], abs[1]] : parentAbs,
      path: nextPath,
      dkPath: `${dkPath}.children[${index}]`,
      nodes
    });
  }
}

// 노드↔DOM 대응은 내용(텍스트)과 기하로만 특정한다. data-dk 앵커에는 의존하지 않는다 —
// 앵커는 생성 LLM이 부착하므로 코드에 오류가 있을수록 함께 무너지고, 정합성을 독립 검증할 수 없다.
function bestDomMatch(bridgeNode, domSnapshot) {
  const candidates = [
    ...domSnapshot.elements.map((candidate) => ({ ...candidate, source: "element" })),
    ...domSnapshot.textNodes.map((candidate) => ({ ...candidate, source: "text" }))
  ];
  let best = { candidate: null, confidence: 0, strategy: "none" };
  for (const candidate of candidates) {
    const score = scoreCandidate(bridgeNode, candidate);
    if (score.confidence > best.confidence) best = { candidate, ...score };
  }
  return best;
}

function scoreCandidate(bridgeNode, candidate) {
  const textScore = scoreText(bridgeNode, candidate);
  const geometryScore = bridgeNode.bbox ? scoreGeometry(bridgeNode.bbox, boxArray(candidate.bbox)) : 0;
  const kindScore = scoreKind(bridgeNode, candidate);
  const confidence = clamp(textScore * 0.58 + geometryScore * 0.32 + kindScore * 0.1, 0, 1);
  const strategy = [
    textScore >= 1 ? "text-exact" : textScore > 0 ? "text-partial" : null,
    geometryScore > 0 ? "geometry" : null,
    kindScore > 0 ? "kind" : null
  ].filter(Boolean).join("+") || "none";
  return { confidence, strategy };
}

function scoreText(bridgeNode, candidate) {
  if (!bridgeNode.text) return 0;
  const expected = normalizeText(bridgeNode.text);
  const actual = normalizeText(candidate.text);
  if (!actual) return 0;
  if (actual === expected) return 1;
  if (actual.includes(expected) || expected.includes(actual)) return 0.7;
  if (bridgeNode.node.runs?.every((run) => actual.includes(normalizeText(run.text)))) return 0.8;
  return 0;
}

function scoreGeometry(expected, actual) {
  const iouScore = iou(expected, actual);
  const distance = centerDistance(expected, actual);
  const diagonal = Math.hypot(expected[2], expected[3]) || 1;
  const distanceScore = Math.max(0, 1 - distance / diagonal);
  return clamp(iouScore * 0.7 + distanceScore * 0.3, 0, 1);
}

function scoreKind(bridgeNode, candidate) {
  if (bridgeNode.type === "text" && candidate.kind === "text") return 1;
  if ((bridgeNode.type === "instance" || bridgeNode.type === "component") && ["label", "button", "input", "a"].includes(candidate.tag)) return 0.8;
  if ((bridgeNode.type === "frame" || bridgeNode.type === "group") && candidate.kind === "element") return 0.5;
  return 0;
}

export function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function boxArray(box) {
  return [box.x, box.y, box.width, box.height].map((value) => Math.round(value));
}

export function iou(a, b) {
  const left = Math.max(a[0], b[0]);
  const top = Math.max(a[1], b[1]);
  const right = Math.min(a[0] + a[2], b[0] + b[2]);
  const bottom = Math.min(a[1] + a[3], b[1] + b[3]);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  const areaA = Math.max(0, a[2]) * Math.max(0, a[3]);
  const areaB = Math.max(0, b[2]) * Math.max(0, b[3]);
  const union = areaA + areaB - intersection;
  return union ? intersection / union : 0;
}

function centerDistance(a, b) {
  return Math.hypot((a[0] + a[2] / 2) - (b[0] + b[2] / 2), (a[1] + a[3] / 2) - (b[1] + b[3] / 2));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundMetric(value) {
  return Number(value.toFixed(6));
}
