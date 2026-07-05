# Figma 추출 규칙 (bridge 단계 SSOT)

`bridge` 스킬과 `figma-extractor` 서브에이전트가 따르는 구체 규칙. 스키마 필드 정의는
[bridge.schema.json](bridge.schema.json), 단계 계약은 [pipeline.md](pipeline.md) 참고.

## 1. section / page 모드 선택
- Figma URL에 `node-id` 쿼리파라미터가 있으면 → **section 모드**. 그 노드 하나를 대상으로 추출.
- `node-id`가 없으면 → **page 모드**. URL이 가리키는 페이지의 최상위 프레임을 모두 순회해
  프레임 1개 = `screens[]` 항목 1개로 매핑.
- 사용자가 모드를 명시하면 URL 파싱 결과보다 우선.

## 2. 노드 가지치기 (pruning)
브릿지 JSON을 오염시키는 노드는 트리로 펼치지 않는다.
- `visible: false` 노드 → 제외.
- `opacity: 0` 노드 → 제외.
- 장식용 벡터 아트(아이콘/일러스트 — boolean group, vector path가 대부분인 서브트리) →
  트리로 펼치지 않고 `type: "image"` 노드로 대체 + `assets[]`에 export 등록.
  기준: 자식이 전부 vector/boolean-operation이고 텍스트·컴포넌트 인스턴스를 포함하지 않으면 장식용으로 간주.
- 위 규칙은 `plan.md`가 읽을 트리를 작고 의미있게 유지하기 위함 — 시각적으로 존재하되
  구조적으로 무의미한 노드는 자산화한다.

## 3. 컴포넌트 vs 커스텀 판별
`type: "component"` 노드에는 다음 필드를 채운다 (code 단계가 "재사용 vs 신규 생성"을 판단하는 근거):
- `componentName` — Figma의 메인 컴포넌트 이름 (예: `Button/Primary`).
- `isDesignSystemComponent` — 아래 순서로 판정:
  1. Figma MCP `get_code_connect_map`에 매핑이 존재하면 → `true`, `mappedCodeComponent`에 매핑 경로 기입.
  2. Code Connect 매핑이 없으면 → 컴포넌트가 **published library**의 인스턴스인지로 판정 (로컬 1회성 컴포넌트는 `false`).
- `mappedCodeComponent` — 매핑 확인 안 되면 `null`. 이 경우 code 단계는 프로젝트의
  `design.md` 컴포넌트 규칙(예: `src/components/<Name>/`)에 따라 새로 만든다.
- `componentProps` — 인스턴스의 variant/property 값 (예: `{ "size": "md", "state": "default" }`).

## 4. 토큰 추출 우선순위
1. Figma MCP `get_variable_defs` (Variables) — **1차 소스**. 여기서 나온 값만 `tokens.*`에 이름 그대로 반영.
2. 매핑되는 변수가 없는 raw 스타일 값 — 2차(fallback)로만 사용, `tokens`에 편입하지 않고
   해당 노드의 `style`에 원본 값을 그대로 둔다 (추측으로 토큰화하지 않음).
- 이유: 변수 기반 토큰만 코드의 디자인 시스템과 안정적으로 매핑되며, 스타일 값 역추론은
  같은 색이 다른 이름으로 중복 생성되는 문제를 만든다.

## 5. 반응형 프레임 그룹핑
같은 화면의 브레이크포인트별 프레임은 서로 다른 `screens[]` 항목이 아니라
**하나의 논리 화면**으로 묶는다.
- 판별: 프레임 이름이 `<Screen> - <Breakpoint>` 패턴(`Login - Mobile`, `Login - Desktop`)이거나,
  같은 페이지에서 서로 다른 폭(`w`)의 프레임이 동일 접두 이름을 가지면 그룹 후보.
- 그룹으로 판별되면 각 프레임에 `breakpoint`(`mobile`|`tablet`|`desktop`|`default`)와
  공통 `variantGroup`(논리 화면 이름)을 채운다. 그룹이 아니면 두 필드 모두 생략.
- plan 단계는 같은 `variantGroup`을 가진 screen들을 하나의 컴포넌트 + 반응형 스타일로 계획해야 한다.

## 6. 추출 절차 (병렬 단일-책임 패스)
`figma-extractor`는 한 번에 다 훑지 않고 아래 패스를 **병렬로 실행**한 뒤 병합한다
(monday.com의 11-노드 파이프라인 참고 — 각 패스가 실패해도 나머지는 살아남는다):
1. `structure` — `get_metadata`로 트리/노드 구조.
2. `tokens` — `get_variable_defs`로 변수 기반 토큰(§4).
3. `component-map` — `get_code_connect_map` + 인스턴스 정보로 컴포넌트 판별(§3).
4. `screenshots` — `get_screenshot`으로 시각 참조(검증 단계 재사용).
5. 병합 후 §2 가지치기, §5 반응형 그룹핑을 적용해 최종 브릿지 JSON 조립.

## 7. 자가검증 재시도 루프
1. 조립한 브릿지 JSON을 저장 전에 `scripts/validate-bridge.mjs`로 검증.
2. 실패하면 에러 목록을 그대로 사용자에게 보이지 말고, 어떤 패스가 무엇을 잘못 채웠는지
   추론해 **1회 자가 수정**(예: 누락된 `meta.schemaVersion` 채우기, 빈 `screens` 재수집) 후 재검증.
3. 재시도 후에도 실패하면 실패한 필드와 원인을 사용자에게 보고하고 진행 여부를 확인한다.
