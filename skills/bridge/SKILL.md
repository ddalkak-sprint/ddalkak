---
name: bridge
description: Figma MCP를 사용해 Figma 디자인을 AI가 알아듣기 쉬운 "디자인 브릿지(JSON)"로 산출한다. section 추출 / page 기준 추출 두 모드를 지원하고, 결과를 .ddalkak/bridge/에 저장한다. 사용자가 Figma URL로 디자인을 뽑을 때, 또는 딸깍 파이프라인 1단계에서 사용.
---

# [1] 디자인 브릿지(JSON) 산출  (닉·초록)

Figma의 원본 데이터를 정규화·축약해 후속 단계(plan/code)가 쓰기 좋은
단일 JSON으로 만든다.
- 스키마 SSOT: `${CLAUDE_PLUGIN_ROOT}/shared/bridge.schema.json`
- 추출 규칙(모드 판별/가지치기/컴포넌트 판별/토큰 우선순위/반응형 그룹핑) SSOT:
  `${CLAUDE_PLUGIN_ROOT}/shared/figma-extraction-rules.md`

## 입력
- Figma URL (필수)
- 모드: `section` (프레임/섹션 단위) | `page` (페이지 전체) — 기본 `page`
  (URL의 `node-id` 유무로 자동 판별. 규칙: rules §1)

## 사용하는 Figma MCP 도구
- `get_metadata` — 노드 트리/구조 파악
- `get_variable_defs` — 디자인 토큰(변수) — tokens 1차 소스 (rules §4)
- `get_code_connect_map` — 컴포넌트 ↔ 코드 매핑 (rules §3)
- `get_design_context` — 스타일·레이아웃 컨텍스트 (변수로 못 채운 나머지 보완)
- `get_screenshot` — 시각 참조 (검증 단계에서 재사용)

> 실제 추출은 `ddalkak:figma-extractor` 서브에이전트에 위임해 컨텍스트를 격리한다.
> 서브에이전트는 4개 패스(structure/tokens/component-map/screenshots)를 병렬로 실행 (rules §6).

## 출력
- `.ddalkak/bridge/<name>.bridge.json` (스키마 준수, `meta.schemaVersion` 포함)
- 저장 전 `scripts/validate-bridge.mjs`로 검증 → 실패 시 자가 수정 1회 재시도 (rules §7)

## 절차
1. URL 파싱 → file key / node id 추출, node-id 유무로 section/page 모드 확정.
2. `figma-extractor`에게 위임 → 4개 패스 결과 병합.
3. 가지치기(rules §2) + 컴포넌트 판별(rules §3) + 반응형 그룹핑(rules §5) 적용.
4. 브릿지 스키마로 정규화 (tokens / screens / assets).
5. 검증(rules §7) → 저장 → 사용자에게 요약 보고 (screens 수, 컴포넌트 판별 결과, 반응형 그룹 여부).
