---
name: bridge
description: Figma MCP 또는 기록된 MCP 캐시를 사용해 Figma 디자인을 무손실 플랫폼 중립 Bridge IR(JSON)로 산출한다. 스타일·토큰·레이아웃·적응형 화면 조건·constraints·자산·텍스트 동작을 캡처하고 스크린샷과 교차검증한다. 웹, React, React Native, iOS, Android로 이어지는 딸깍 파이프라인 1단계에서 사용.
---

# [1] 디자인 브릿지(JSON) 산출  (닉·초록)

Figma 원본을 **무손실 플랫폼 중립 Bridge IR**로 정규화해 후속 단계(plan/code)가 쓰기 좋은 단일 JSON으로 만든다.
토큰을 쓰되 원본값이 항상 복원 가능하고(§4), 스크린샷과 교차검증해 누락을 잡고(§8), 적응형 동작까지 담고(§5),
스크린샷 비전 분석으로 **의미 레이어**(semanticRole — hero/cta-button/card-list …)를 얹는다(§11).
- 스키마 SSOT: `${CLAUDE_PLUGIN_ROOT}/shared/bridge.schema.json` (v2.1)
- 추출 규칙 SSOT: `${CLAUDE_PLUGIN_ROOT}/shared/figma-extraction-rules.md`

## 입력
- Figma URL (필수)
- 모드: `section` (프레임/섹션 단위) | `page` (페이지 전체) — 기본 `page`
  (URL의 `node-id` 유무로 자동 판별. 규칙: rules §1)
- `fidelity`: `lossless`(기본) | `summary` — lossless는 구조 접기 외 축약 금지 (rules §2)
- `source`: `live`(기본, MCP 호출 + 원시응답 캐시 기록) | `cache`(캐시 재생, 호출 0회) — rules §10
- `cacheDir`: 캐시 위치. 개발용 골든 픽스처는 `fixtures/figma/<name>/`, 런타임 기본은 `.ddalkak/mcp-cache/<name>/`
- `enrich`: `on`(기본) | `off` — off면 §11 비전 의미 레이어·§12 구조 추론을 건너뛴 순수 MCP 브릿지.
  로직 반복 디버깅 등 빠른 이터레이션용 (§8 교차검증은 안전망이므로 off여도 수행)

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
> 서브에이전트는 7개 패스(structure/detail/tokens/component-map/assets/screenshots/semantic)를 병렬 실행 후 병합 (rules §6).
> `semantic` 패스는 캡처된 스크린샷을 비전 분석하는 것이라 **MCP 호출을 추가로 쓰지 않는다** (§11).

## 출력

### 캐시 입력 사전검사

`source: cache`에서는 변환 전에 반드시 `node scripts/mcp-cache.mjs check <cacheDir>`를 실행한다.
섹션 응답이 `codeSummary`인 경우 `get_metadata`의 모든 `metadataLeaf`에 대응하는 개별
`get_design_context(nodeId)` 상세 응답이 있어야 한다. 하나라도 없으면 bridge, plan, code를 생성하지 않고
누락된 leaf 이름과 node ID를 보고한다. 자연어 요약이나 스크린샷 추정으로 누락 좌표를 채워 성공 처리하지 않는다.
- `.ddalkak/bridge/<name>.bridge.json` (스키마 v2.1 준수, `meta.schemaVersion: "2.1"`)
- **compact 저장**(rules §14 — pretty는 토큰 4배). 사람 검토: `scripts/bridge-format.mjs <file> --pretty`
- `meta.sourceFingerprint`와 `meta.extractorFingerprint`를 함께 기록한다. 캐시와 추출기 지문이 모두 같을 때만
  기존 브릿지를 재사용한다. 스키마·규칙·변환기가 바뀌면 같은 캐시에서도 다시 생성한다(rules §10).
- `meta.coordinateSpace`와 `meta.completeness`를 기록하고, 부분 실패면 `meta.errors[]`에 실패 패스를 남긴다(rules §15).
- 저장 전 `scripts/validate-bridge.mjs`로 검증 → 미해결 `@ref`/불일치 있으면 자가 수정 1회 재시도 (rules §9)
  — 검증기는 불변식·bbox↔스크린샷 edge 대조(rules §9-1)까지 수행한다

## 절차
1. URL 파싱 → file key / node id 추출, node-id 유무로 section/page 모드 확정.
2. `figma-extractor`에게 위임 (`source` 전달) → 7개 패스 결과 병합.
   - `live`: MCP 호출하며 원시 응답을 `cacheDir`에 기록. `cache`: `cacheDir`에서 원시 응답 읽어 재생 (rules §10).
   - cache final 생성은 `npm run bridge:cache -- --cache <cacheDir> --project <project> --name <name>`을 실행한다.
     노드 컴파일, 자산 로컬 적재, compact 저장, JSON Schema·스크린샷 검증까지 원자적으로 끝낸다.
   - 병합의 수치·구조·텍스트는 기계 산출물을 그대로 쓴다: `bridge-skeleton.mjs`(metadata → bbox 트리, §8-2)
     + `design-context-to-bridge.mjs`(코드 응답 → 노드 초안: 스타일·텍스트·에셋·앵커 원형 §8-3).
     LLM은 두 산출물의 병합(instance 판별, 스켈레톤 bbox 우선)만 담당 — 전사 금지.
3. 가지치기(rules §2, 무손실 자산화) + 컴포넌트 판별(§3) + 플랫폼 중립 layout/sizing/behavior(§7) 적용.
   같은 논리 화면 변형은 `adaptive.group`으로 묶고, 확실한 동일 노드에만 `matchKey`를 붙인다(§5).
4. **비전 의미 레이어(§11)** — 주요 컨테이너에 `semanticRole` 부여, 반복 패턴 인식. MCP 수치는 절대 덮어쓰지 않음.
5. **구조 추론(§12)** — Figma에 없어도 코드에 필요한 구조 제안: 반복 서브트리 → `suggestedComponent`(+`suggestedProps`),
   흩어진 절대배치 덩어리 → `source: "inferred"` 합성 그룹 + flex 추론. plan/code가 이걸 근거로 컴포넌트화·중첩을 구현.
6. **스크린샷 ↔ 구조 교차검증(§8)** — 누락·불일치를 `reconciliation`에 기록. **재추출(leaf 노드 ID로
   개별 `get_design_context` 재호출)이 항상 1순위**이고(rules §8-1), 호출이 실패/한도초과일 때만
   `scripts/bridge-autofix.mjs`(스크린샷 색상영역 매칭, §9-1)로 차선 보정 — 이때 보정한 노드는
   `confidence: 0.7`로 남겨 한도가 풀리면 재확인 대상임을 표시한다. 그래도 안 되는 것만 비전
   backfill(`source: "vision"` + `confidence` 태깅, §11-2).
7. 토큰 매핑: 값이 변수에 대응하면 `@color.primary`처럼 참조, 아니면 raw 리터럴 (§4 무손실 규약).
8. JSON Schema + 적응형 그룹 검증(§9/§15) → 저장 → 요약 보고 (screens 수, adaptive 그룹, completeness,
   컴포넌트 판별, 교차검증 결과,
   semanticRole/vision 노드 수, suggestedComponent 제안 목록).
