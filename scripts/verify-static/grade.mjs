// 채점 — 정규화 후 오차 0. 조건부 클래스 집합은 "기대값 ∈ 집합"이면 pass. (규칙 SSOT: §6)
import { colorClassFor, pxClassFor, FONT_WEIGHT_CLASSES, RADIUS_CLASSES } from "./tailwind.mjs";
import { matchCheck } from "./match.mjs";
import { extractProperty, elementMinSideOf } from "./extract.mjs";

function displayValue(v, unit) {
  if (unit === "px") return `${v}px`;
  if (unit === "px4") return String(v).split(" ").map((n) => `${n}px`).join(" ");
  return String(v);
}

// 정규화 후 오차 0 비교. 단 borderRadius는 CSS 클램프(박스 짧은 변의 절반 초과분은 렌더 동일)를
// 양변에 적용한 뒤 비교 — rounded-full(9999)과 "절반 이상 radius"는 같은 렌더 결과다.
function valuesEqual(check, actual, clampSide) {
  if (check.property === "borderRadius") {
    const side = check.minSide ?? clampSide ?? null;
    if (side != null) {
      const clamp = (v) => Math.min(Number(v), side / 2);
      return clamp(actual) === clamp(check.expected);
    }
  }
  return String(actual) === String(check.expected);
}

function suggestedFixFor(property, expected, foundCls) {
  const repl = (to) => (foundCls && !foundCls.startsWith("(") ? `\`${foundCls}\` → \`${to}\`` : `\`${to}\` 클래스 추가`);
  switch (property) {
    case "height": return repl(pxClassFor(expected, "h"));
    case "width": return repl(pxClassFor(expected, "w"));
    case "gap": return repl(pxClassFor(expected, "gap"));
    case "padding": {
      if (typeof expected === "string" && expected.includes(" ")) {
        const [t, r, b, l] = expected.split(" ").map(Number);
        if (t === r && r === b && b === l) return repl(pxClassFor(t, "p"));
        if (t === b && r === l) return repl(`${pxClassFor(r, "px")} ${pxClassFor(t, "py")}`);
        return repl(`${pxClassFor(t, "pt")} ${pxClassFor(r, "pr")} ${pxClassFor(b, "pb")} ${pxClassFor(l, "pl")}`);
      }
      return repl(pxClassFor(expected, "p"));
    }
    case "borderRadius": {
      const named = Object.entries(RADIUS_CLASSES).find(([, v]) => v === expected)?.[0];
      return repl(named ?? `rounded-[${expected}px]`);
    }
    case "backgroundColor": return repl(colorClassFor(expected, "bg"));
    case "textColor": return repl(colorClassFor(expected, "text"));
    case "borderColor": return repl(colorClassFor(expected, "border"));
    case "fontWeight": {
      const named = Object.entries(FONT_WEIGHT_CLASSES).find(([, v]) => v === expected)?.[0];
      return repl(named ?? `font-[${expected}]`);
    }
    case "fontSize": case "lineHeight": return "타이포 토큰 클래스(text-<token>) 확인";
    case "boxShadow": return "그림자 토큰(shadow-<token>) 또는 shadow-[임의값] 확인";
    case "flexDirection": return repl(expected === "column" ? "flex-col" : "flex-row");
    default: return "값 불일치 — 수동 확인";
  }
}

// deduped 체크리스트 → 채점된 item 배열.
export function buildItems(deduped) {
  return deduped.map((check) => {
    const base = {
      nodeId: check.instanceNodeIds.join(", "),
      label: check.label,
      property: check.property,
      expectedValue: displayValue(check.expected, check.unit),
      actualValue: null,
      filePath: null,
      lineNumber: null,
      matchMethod: "none",
      matchConfidence: "none",
      verdict: "match_failure",
      suggestedFix: null,
      tailwindClass: null,
      conversionSuccess: false,
      reason: null,
      ...(check.lowTrust ? { lowTrust: check.lowTrust } : {}),
      ...(check.figmaId ? { figmaId: check.figmaId } : {}),
    };
    const match = matchCheck(check);
    if (match.failure) return { ...base, matchMethod: match.method, reason: match.failure };

    base.matchMethod = match.method;
    base.matchConfidence = match.confidence;
    const found = extractProperty(match, check.property);
    base.filePath = found.file ?? null;
    base.lineNumber = found.line ?? null;
    if (found.notFound) return { ...base, reason: "해당 속성 클래스 미발견 — 미판정 (런타임/AI 층으로 이관)" };
    if (found.unconvertible)
      return { ...base, tailwindClass: found.cls, reason: `클래스 \`${found.cls}\` 결정론 환산 불가 — 미판정 (런타임/AI 층으로 이관)` };

    base.conversionSuccess = true;
    const clampSide = match.scope === "element" ? elementMinSideOf(match.element) : null;
    if (found.values) {
      // 조건부 클래스 집합 (상태 분기): 기대값이 집합에 있으면 그 분기가 해당 상태의 구현
      const hit = found.values.find((h) => valuesEqual(check, h.value, clampSide));
      base.tailwindClass = found.values.map((h) => h.cls).join(" | ");
      base.actualValue = found.values.map((h) => displayValue(h.value, check.unit)).join(" | ");
      if (hit) {
        base.verdict = "pass";
        base.tailwindClass = hit.cls;
        base.actualValue = displayValue(hit.value, check.unit);
        base.reason = "조건부 클래스 집합에서 일치 (상태 분기)";
      } else {
        base.verdict = "mismatch";
        base.suggestedFix = suggestedFixFor(check.property, check.expected, found.values[0].cls);
      }
      return base;
    }
    base.tailwindClass = found.cls;
    base.actualValue = displayValue(found.value, check.unit);
    const pass = valuesEqual(check, found.value, clampSide);
    base.verdict = pass ? "pass" : "mismatch";
    if (pass && check.property === "borderRadius" && String(found.value) !== String(check.expected))
      base.reason = "CSS radius 클램프로 렌더 동일 (박스 절반 초과분)";
    if (!pass) base.suggestedFix = suggestedFixFor(check.property, check.expected, found.cls);
    if (found.inherited) base.reason = "조상 요소에서 상속된 클래스로 판정";
    return base;
  });
}

export { displayValue };
