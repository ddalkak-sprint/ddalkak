---
name: bridge
description: Figma MCP를 사용해 Figma 디자인을 AI가 알아듣기 쉬운 "디자인 브릿지(JSON)"로 산출한다. section 추출 / page 기준 추출 두 모드를 지원하고, 결과를 .ddalkak/bridge/에 저장한다. 사용자가 Figma URL로 디자인을 뽑을 때, 또는 딸깍 파이프라인 1단계에서 사용.
---

# [1] 디자인 브릿지(JSON) 산출  (닉·초록)

Figma의 원본 데이터를 정규화·축약해 후속 단계(plan/code)가 쓰기 좋은
단일 JSON으로 만든다. 스키마는 SSOT: `${CLAUDE_PLUGIN_ROOT}/shared/bridge.schema.json`.

## 입력
- Figma URL (필수)
- 모드: `section` (프레임/섹션 단위) | `page` (페이지 전체) — 기본 `page`

## 사용하는 Figma MCP 도구
- `get_metadata` — 노드 트리/구조 파악
- `get_design_context` — 스타일·레이아웃·토큰 컨텍스트
- `get_screenshot` — 시각 참조 (검증 단계에서 재사용)

> 대량 노드 추출은 `ddalkak:figma-extractor` 서브에이전트에 위임해 컨텍스트를 격리한다.

## 출력
- `.ddalkak/bridge/<name>.bridge.json` (스키마 준수)
- 저장 후 `scripts/validate-bridge.mjs`로 스키마 검증.

## 절차
1. URL 파싱 → file key / node id 추출.
2. 모드에 따라 대상 노드 결정 (section=선택 프레임 / page=페이지 루트).
3. MCP로 metadata → context → screenshot 순 수집.
4. 브릿지 스키마로 정규화 (tokens / screens / assets).
5. 저장 + 검증 + 사용자에게 요약 보고.

<!-- TODO: URL 파싱, 노드 순회 규칙, 토큰 추출 휴리스틱 채우기 -->
