# Figma 추출 규칙 (bridge 단계 SSOT) — v2.0

`bridge` 스킬과 `figma-extractor` 서브에이전트가 따르는 구체 규칙. 스키마 필드 정의는
[bridge.schema.json](bridge.schema.json), 단계 계약은 [pipeline.md](pipeline.md) 참고.

**설계 원칙 — 토큰을 쓰되 무손실.** 값이 디자인 변수(토큰)에 매핑되면 참조로 축약하지만,
원본값은 항상 tokens 사전 또는 노드에 남아 복원 가능해야 한다. "축약 = 손실"이 되면 안 된다.
구조(트리)는 접어도 되지만, **속성·자산·텍스트는 전량 캡처**한다.

## 0. 무손실 원칙 3줄
1. 모든 스타일 값은 `@token.path`(참조) **또는** raw 리터럴 중 하나로 **반드시** 채운다. 빈 채로 두지 않는다.
2. 트리를 접는 유일한 경우는 §2 자산화뿐이고, 접을 때는 반드시 실제 export가 따라온다.
3. 구조 데이터로 못 믿을 부분은 §8 스크린샷 교차검증으로 잡는다.

## 1. section / page 모드 선택
- Figma URL에 `node-id` 쿼리파라미터가 있으면 → **section 모드**. 그 노드 하나를 대상으로 추출.
- `node-id`가 없으면 → **page 모드**. URL이 가리키는 페이지의 최상위 프레임을 모두 순회해
  프레임 1개 = `screens[]` 항목 1개로 매핑.
- 사용자가 모드를 명시하면 URL 파싱 결과보다 우선.

## 2. 노드 가지치기 (pruning) — 무손실 접기만 허용
구조적으로 무의미한 서브트리만 접고, **접을 땐 반드시 픽셀을 자산으로 보존**한다.
- `visible: false` / `opacity: 0` 노드 → 제외하되, 디자인 의도상 필요하면 주석 없이 제거(퍼블 렌더에 안 보임).
- 장식용 벡터 아트(아이콘/일러스트) → 트리로 펼치지 않고 `type: "vector"` 또는 `"image"` 노드 1개로 대체하고:
  1. `assets[]`에 `{ id, kind, format }` 등록.
  2. `download_assets`(MCP)로 **실제 파일을 export**해 `export` 경로에 저장 → ref만 남고 픽셀이 사라지는 손실 방지.
  - **자산 저장 위치(무손실 + 소비 가능)**: export의 **정본은 항상 대상 프로젝트의 `.ddalkak/assets/<name>/`** 이고,
    `assets[].export`는 이 **프로젝트 상대경로**로 쓴다(예: `.ddalkak/assets/pc-home/logo.svg`). 브릿지와 같은 프로젝트에
    적재돼야 후속 plan/code가 브릿지만 보고 자산을 바로 붙여넣을 수 있다. 스크린샷(kind=screenshot)도 같은 폴더에 둔다.
    cacheDir(`fixtures/...` 또는 `.ddalkak/mcp-cache/...`)에도 replay 자립을 위해 사본을 두되(§10),
    **브릿지가 가리키는 정본은 캐시가 아니라 프로젝트 쪽**이다(브릿지 export가 `fixtures/...`를 가리키면 안 됨).
  - 장식 판정: 자식이 전부 vector/boolean-operation이고 **텍스트·컴포넌트 인스턴스를 포함하지 않을 때만**.
    텍스트나 인스턴스가 섞였으면 의미 노드이므로 접지 않는다.
- `fidelity: "lossless"`(기본)에서는 위 자산화 외의 트리 축약을 하지 않는다. `"summary"`일 때만 추가 축약 허용.

## 3. 컴포넌트 vs 커스텀 판별
`type: "component"` / `"instance"` 노드에 다음을 채운다 (code 단계의 "재사용 vs 신규 생성" 근거):
- `componentName` — Figma 메인 컴포넌트 이름 (예: `Button/Primary`).
- `isDesignSystemComponent` — 판정 순서:
  1. `get_code_connect_map`에 매핑이 있으면 → `true`, `mappedCodeComponent`에 경로 기입.
  2. 매핑이 없으면 published library 인스턴스인지로 판정 (로컬 1회성 컴포넌트는 `false`).
- `mappedCodeComponent` — 확인 안 되면 `null`. code 단계가 `design.md` 규칙으로 새로 만든다.
- `componentProps` — 인스턴스의 variant/property 값 (예: `{ "size": "md", "state": "default" }`).
- 인스턴스라도 **내부 노드는 무손실 원칙대로 전개**한다(오버라이드된 텍스트/색을 잃지 않기 위해).

## 4. 토큰 추출 & 무손실 참조 규약
- **1차 소스**: `get_variable_defs`(Variables). 여기서 나온 값만 `tokens.*`에 이름 그대로 등록.
  - `tokens.color`(hex 문자열), `tokens.type`(typography 객체), `tokens.spacing`(숫자), `tokens.radius`, `tokens.effect`.
- **참조 규약**: 노드 스타일에서 토큰에 매핑되는 값은 **`@<그룹>.<이름>`** 문자열로 쓴다 (예: `@color.primary`, `@type.body-md`, `@spacing.md`).
  소비 단계는 `tokens`에서 원본을 복원한다. → 토큰을 써도 원본 손실 없음.
- **매핑 안 되는 값**: 추측으로 토큰화하지 말고 **raw 리터럴**을 그대로 style에 둔다 (예: `"#1A1A1A"`, `16`).
  같은 색이 다른 이름으로 중복 토큰화되는 것을 막기 위함.
- 결과적으로 모든 스타일 값은 "참조 아니면 리터럴"로 항상 채워져 있어야 한다(§0-1).

## 5. 반응형 — 프레임 그룹 + 노드 constraints (2층)
반응형은 두 층위로 표현한다.
- **화면 층(브레이크포인트)**: 같은 화면의 폭별 프레임을 하나의 논리 화면으로 묶는다.
  - 판별: 프레임 이름이 `<Screen> - <Breakpoint>`(`Login - Mobile`) 패턴이거나, 같은 페이지에서 동일 접두 이름의 서로 다른 폭(`w`) 프레임.
  - 각 프레임에 `breakpoint`(`mobile`|`tablet`|`desktop`|`default`)와 공통 `variantGroup`(논리 화면 이름)을 채운다. 그룹이 아니면 두 필드 생략.
- **노드 층(constraints)**: 프레임 하나 안에서 각 노드가 부모 리사이즈에 어떻게 반응하는지 `constraints.horizontal/vertical`에 기록.
  오토레이아웃 컨테이너면 `layout.sizing`(hug/fill/fixed)이 함께 반응 규칙이 된다.
- plan 단계는 같은 `variantGroup` screen들 + 각 노드 constraints를 합쳐 **하나의 컴포넌트 + 반응형 스타일**로 계획한다.

## 6. 추출 절차 (병렬 단일-책임 패스)
`figma-extractor`는 아래 패스를 **병렬 실행 후 병합**한다 (패스 하나가 실패해도 나머지는 생존):
1. `structure` — `get_metadata`로 트리/노드 구조 + bbox.
2. `detail` — `get_design_context`로 노드별 상세 스타일(fills/strokes/effects/cornerRadius/layout/constraints/typography). §4 리터럴의 소스.
3. `tokens` — `get_variable_defs`로 변수 기반 토큰(§4). detail 값 중 토큰에 매핑되는 것을 `@ref`로 치환.
4. `component-map` — `get_code_connect_map` + 인스턴스 정보로 컴포넌트 판별(§3).
5. `assets` — `download_assets`로 §2 장식 자산 + 이미지 fill 실제 파일 export.
6. `screenshots` — `get_screenshot`으로 화면별 스크린샷 → `assets[]`(kind=screenshot) + `screens[].screenshot`.
7. 병합 후 §2 가지치기, §5 반응형 그룹핑 적용 → §8 교차검증 → 최종 JSON 조립.

## 7. 오토레이아웃 캡처
컨테이너 노드(frame/group)의 `layout` 객체를 다음까지 채운다 (퍼블 재현 핵심):
- `mode`(row/column/wrap/none), `padding`([top,right,bottom,left]), `gap`(숫자 또는 `@spacing.*`),
  `primaryAxisAlign`, `counterAxisAlign`, `sizing.horizontal/vertical`(hug/fill/fixed).
- 오토레이아웃이 아닌 절대배치 컨테이너는 `mode: "none"` + 자식 `bbox`/`constraints`로 표현.

## 8. 스크린샷 ↔ 구조 교차검증 (핵심)
구조 데이터만 믿지 않고, `get_screenshot` 이미지와 대조해 **누락·불일치를 스스로 잡는다.**
1. 조립한 각 screen의 구조 트리를 그 화면 스크린샷과 비교:
   - 스크린샷엔 보이는데 구조 트리에 없는 요소 → `missing-node` (가지치기 과잉/추출 실패). 재추출 시도.
   - 구조엔 있는데 화면엔 안 보이는 요소 → `extra-node` (숨김 처리 누락 등).
   - 색/그림자/폰트/위치가 눈으로 봐도 다르면 → `style-mismatch` / `text-mismatch` / `position-mismatch`.
2. 발견 항목을 `screens[].reconciliation.discrepancies[]`에 기록. 재추출로 보정한 항목은 `resolved: true`.
3. 전부 일치하면 `reconciliation.status: "match"`. 미해결 불일치가 있으면 `"discrepancies"`로 두고 사용자에게 보고.
- 이 패스가 "누락되는 퍼블 내용 없음"을 실제로 보장하는 안전망이다.

## 9. 자가검증 재시도 루프
1. 조립한 브릿지 JSON을 저장 전 `scripts/validate-bridge.mjs`로 검증.
2. 실패하면 어떤 패스가 무엇을 잘못 채웠는지 추론해 **1회 자가 수정**(예: 미해결 `@ref`의 토큰 등록, 빈 style 채우기) 후 재검증.
3. 재시도 후에도 실패하면 실패 필드·원인 + §8 미해결 불일치를 사용자에게 보고하고 진행 여부를 확인한다.

## 10. MCP 캡처 & 재생 (record / replay) — 호출 절약
Figma MCP 호출은 유한한 자원이다(예: 월 N회). 개발 중 매번 라이브 호출을 하면 금방 소진되므로,
**한 번 뜬 원시 응답을 통째로 캐시**해두고 스킬 개발·디버깅은 캐시로 반복한다.

- `source` 입력:
  - `live`(기본) — MCP를 실제 호출한다. **그리고 모든 원시 응답을 캐시에 즉시 기록한다**(record-always).
    한 콜이 끝날 때마다 저장하므로, 호출 한도에 도중 걸려도 그때까지 받은 건 보존된다.
  - `cache` — MCP를 호출하지 않고 캐시 디렉토리의 원시 응답을 읽어 정규화만 수행(replay). 호출 0회.
- 캐시 디렉토리: 개발용 골든 픽스처는 레포의 `fixtures/figma/<capture-name>/`, 실행 시 런타임 캐시는
  대상 프로젝트 `.ddalkak/mcp-cache/<name>/`. `cacheDir` 입력으로 지정 가능.
- 캐시 레이아웃(레포 골든 픽스처 예):
  ```
  fixtures/figma/<capture-name>/
    manifest.json                 # source URL/page, 캡처한 섹션 목록, 콜 로그(도구/args/파일/scope)
    get_metadata.json             # 페이지 스코프 원시 응답 (1콜로 전 섹션 트리)
    get_variable_defs.json        # 페이지 스코프 변수 (1콜)
    sections/<section>/
      get_design_context.json     # 섹션별 상세 (필요 시)
      screenshot.png              # 섹션별 스크린샷
  ```
- **캡처 예산 전략(한도가 빡빡할 때)**: 가능한 한 **가장 넓은 스코프**로 호출해 콜 수를 줄인다 —
  `get_metadata`·`get_variable_defs`는 페이지 루트 1콜로 전 섹션을 덮고, 넓은 콜로 부족할 때만 섹션 단위로 파고든다.
  모든 콜은 받는 즉시 캐시에 기록(record-always)해 재시도 없이 재생만으로 개발한다.
- `manifest.json`의 콜 로그가 "어느 파일이 어느 노드/도구의 응답인지"를 매핑한다 → 재생 시 extractor가 이를 보고 파일을 고른다.
- **자산 정본은 캐시가 아니라 프로젝트**(§2): `live`든 `cache`(replay)든 산출 시 자산을 대상 프로젝트의
  `.ddalkak/assets/<name>/`에 적재하고 브릿지 `export`를 프로젝트 상대경로로 쓴다. replay일 때는 cacheDir의 자산 사본을
  이 폴더로 복사한다(호출 0회로도 프로젝트에서 바로 쓸 수 있는 브릿지가 나와야 하므로). cacheDir의 사본은 골든 픽스처 자립·replay용일 뿐이다.
  **일반(런타임) 사용은 캐시를 쓰지 않는다** — live로 뽑아 프로젝트에 바로 적재하는 게 정상 경로다.
- 라이브/캐시 어느 경로든 그 뒤 정규화(§2~§8)는 동일하다. 즉 캐시로도 실제 스키마 산출·교차검증을 그대로 테스트할 수 있다.
- 캡처 완결성은 `node scripts/mcp-cache.mjs check fixtures/figma/<capture-name>`로 확인한다.
