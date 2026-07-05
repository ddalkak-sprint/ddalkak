---
name: bridge
description: Figma MCP를 사용해 Figma 디자인을 무손실 "디자인 브릿지(JSON)"로 산출한다. 상세 스타일·토큰·오토레이아웃·constraints를 전량 캡처하고, 스크린샷과 교차검증해 누락을 잡으며, 반응형 그룹까지 표현한다. section/page 두 모드 지원, 결과를 .ddalkak/bridge/에 저장. 사용자가 Figma URL로 디자인을 뽑을 때, 또는 딸깍 파이프라인 1단계에서 사용.
---

# [1] 디자인 브릿지(JSON) 산출  (닉·초록)

Figma 원본을 **무손실로** 정규화해 후속 단계(plan/code)가 쓰기 좋은 단일 JSON으로 만든다.
토큰을 쓰되 원본값이 항상 복원 가능하고(§4), 스크린샷과 교차검증해 누락을 잡고(§8), 반응형까지 담는다(§5).
- 스키마 SSOT: `${CLAUDE_PLUGIN_ROOT}/shared/bridge.schema.json` (v2.0)
- 추출 규칙 SSOT: `${CLAUDE_PLUGIN_ROOT}/shared/figma-extraction-rules.md`

## 입력
- Figma URL (필수)
- 모드: `section` (프레임/섹션 단위) | `page` (페이지 전체) — 기본 `page`
  (URL의 `node-id` 유무로 자동 판별. 규칙: rules §1)
- `fidelity`: `lossless`(기본) | `summary` — lossless는 구조 접기 외 축약 금지 (rules §2)
- `source`: `live`(기본, MCP 호출 + 원시응답 캐시 기록) | `cache`(캐시 재생, 호출 0회) — rules §10
- `cacheDir`: 캐시 위치. 개발용 골든 픽스처는 `fixtures/figma/<name>/`, 런타임 기본은 `.ddalkak/mcp-cache/<name>/`

> **MCP 호출 한도 절약**: 라이브 실행은 모든 원시 응답을 캐시에 즉시 기록한다(record-always).
> 이후 `source: cache`로 호출 0회 개발·디버깅. 상세: rules §10.

## 사용하는 Figma MCP 도구
- `get_metadata` — 노드 트리/구조/bbox (structure 패스)
- `get_design_context` — 노드별 상세 스타일: fills/strokes/effects/cornerRadius/layout/constraints/typography (detail 패스, rules §7)
- `get_variable_defs` — 디자인 토큰(변수) — tokens 1차 소스, `@ref`로 치환 (rules §4)
- `get_code_connect_map` — 컴포넌트 ↔ 코드 매핑 (rules §3)
- `download_assets` — 장식 벡터/이미지 fill 실제 파일 export (rules §2, 자산 무손실)
- `get_screenshot` — 화면 스크린샷 → 교차검증(§8) + verify 재사용

> 실제 추출은 `ddalkak:figma-extractor` 서브에이전트에 위임해 컨텍스트를 격리한다.
> 서브에이전트는 6개 패스(structure/detail/tokens/component-map/assets/screenshots)를 병렬 실행 후 병합 (rules §6).

## 출력
- `.ddalkak/bridge/<name>.bridge.json` (스키마 v2.0 준수, `meta.schemaVersion: "2.0"`)
- 저장 전 `scripts/validate-bridge.mjs`로 검증 → 미해결 `@ref`/불일치 있으면 자가 수정 1회 재시도 (rules §9)

## 절차
1. URL 파싱 → file key / node id 추출, node-id 유무로 section/page 모드 확정.
2. `figma-extractor`에게 위임 (`source` 전달) → 6개 패스 결과 병합.
   - `live`: MCP 호출하며 원시 응답을 `cacheDir`에 기록. `cache`: `cacheDir`에서 원시 응답 읽어 재생 (rules §10).
3. 가지치기(rules §2, 무손실 자산화) + 컴포넌트 판별(§3) + 오토레이아웃(§7) + 반응형 그룹핑/constraints(§5) 적용.
4. **스크린샷 ↔ 구조 교차검증(§8)** — 누락·불일치를 `reconciliation`에 기록, 재추출로 보정.
5. 토큰 매핑: 값이 변수에 대응하면 `@color.primary`처럼 참조, 아니면 raw 리터럴 (§4 무손실 규약).
6. 검증(§9) → 저장 → 요약 보고 (screens 수, 반응형 그룹, 컴포넌트 판별, 교차검증 결과).
