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
7. `semantic` — 캡처된 스크린샷(로컬 파일)을 **비전으로 분석**해 의미 레이어를 얹는다(§11).
   **MCP 호출 0회** — 이미 받은 스크린샷을 읽는 것이므로 replay(`source: cache`)에서도 동일하게 동작.
8. 병합 후 §2 가지치기, §5 반응형 그룹핑 적용 → §8 교차검증 → 최종 JSON 조립.

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
2. 발견 항목을 `screens[].reconciliation.discrepancies[]`에 기록. 보정한 항목은 `resolved: true` + `resolution` 명시:
   - `re-extract` — MCP 재추출로 보정 (기본, 우선 시도).
   - `vision-backfill` — 재추출로도 못 채우는 것(예: 이미지에 래스터화된 텍스트)을 스크린샷 비전으로 보강.
     이 경로로 생긴 노드/값은 반드시 §11 규약대로 `source: "vision"` + `confidence` 태깅.
3. 전부 일치하면 `reconciliation.status: "match"`. 미해결 불일치가 있으면 `"discrepancies"`로 두고 사용자에게 보고.
- 이 패스가 "누락되는 퍼블 내용 없음"을 실제로 보장하는 안전망이다.

### 8-1. 재조합(re-extract) 서브트리는 저신뢰다 — confidence 마킹 의무, **직접 물어보는 게 최우선**
`get_metadata`가 leaf로 노출한 인스턴스(§8-2 스켈레톤의 `metadataLeaf`)는 **반드시 그 노드 ID로
`get_design_context`를 개별 호출**해서 채운다. 전체 섹션 노드에 대한 1회 `get_design_context` 호출은
복잡한 화면에서 `codeSummary`(자연어 요약, 좌표 없음)만 돌아올 수 있다 — 이 경우 leaf 내부 수치는
LLM이 요약에서 다시 지어내게 되고, 그게 곧 좌표 오염이다. **실측**: pc-home에서 img_01 leaf를
`get_design_context(nodeId: 9:571)`로 개별 조회하니 카드 3장 중 실제로 틀린 값은 `add-card`의
x좌표 1개뿐이었다(나머지 카드 위치·크기·avatar가 pill이라는 것·tag 색까지 전부 정확) — 그런데
전체-섹션 요약만 보고 만든 최초 브릿지는 이 서브트리 전체를 부정확하게 재구성했었다.
**우선순위**: ① leaf별 개별 `get_design_context` 호출(정본) → ② 호출 실패·rate limit 시에만
`scripts/bridge-autofix.mjs`의 스크린샷 색상영역 매칭(차선 — §9-1 참고, 흰 배경 위 흰 요소·같은 색
형제가 여럿이면 확신 없어 보류하도록 만들어짐) → ③ 그래도 안 되면 vision-backfill(§11-2)로
`confidence` 낮게 태깅. 개별 호출이 소진(rate limit)됐다고 곧장 픽셀 추측으로 넘어가지 말고,
그 사실을 사용자에게 알리고 한도가 풀리면 재시도하는 것을 기본으로 한다.
- 재조합한 서브트리의 **루트 노드에 `confidence`(0~1, 권장 0.6~0.8) 마킹 필수.** vision 노드(§11-2)와
  동일한 의미다 — "이 수치는 추정값, 스크린샷이 우선".
- reconciliation의 해당 discrepancy `detail`에 재조합 사실과 대상 노드를 명시한다.
- 재조합 서브트리 내부의 형태 속성(원형 여부·cornerRadius·테두리 유무)은 §11-1 비전 패스가
  스크린샷 크롭으로 **스팟체크**한다 — 예: 스크린샷상 원형인 avatar에 cornerRadius가 없으면
  `style-mismatch`로 기록하고 보정한다.

### 8-2. 수치는 기계가, 구조 판단은 LLM이 (스켈레톤 규약)
좌표 오염의 근본 원인은 수치가 LLM의 전사(轉寫)를 거치는 것이다. 그래서:
- `structure` 패스는 `scripts/bridge-skeleton.mjs`로 원시 `get_metadata` 캐시에서 **bbox 트리를
  결정론적으로 추출**한다(부모 상대좌표 변환 포함). extractor는 이 스켈레톤의 수치를 **덮어쓰지 않고
  그대로 병합**한다 — LLM이 좌표를 다시 쓰지 않는다.
- 스켈레톤에 없는 노드(재조합 서브트리 내부, vision backfill)만 LLM이 수치를 채우며, 그 서브트리는
  §8-1/§11-2의 confidence 마킹 대상이 된다. 스켈레톤이 `metadataLeaf`로 표시한 인스턴스가 곧
  재조합 후보 목록이다.
- **좌표계 해석도 기계에 고정한다.** metadata의 x/y는 부모 상대좌표다(루트만 캔버스 좌표).
  실측: pc-home CTA 버튼(Group 7 x=461, bottom 기준)을 LLM이 루트 좌표로 오해해 102로 "변환"한 것이
  좌표 결함의 실제 원인이었다 — 올바른 절대좌표는 359+461=820(중앙정렬)으로 스크린샷과 일치했다.
  스켈레톤이 전사·좌표계 해석 오류를 없애고, 남는 원본 오류·재조합 서브트리는 §9-1 픽셀 대조가 잡는다.

## 9. 자가검증 재시도 루프
1. 조립한 브릿지 JSON을 저장 전 `scripts/validate-bridge.mjs`로 검증.
2. 실패하면 어떤 패스가 무엇을 잘못 채웠는지 추론해 **1회 자가 수정**(예: 미해결 `@ref`의 토큰 등록, 빈 style 채우기) 후 재검증.
3. 재시도 후에도 실패하면 실패 필드·원인 + §8 미해결 불일치를 사용자에게 보고하고 진행 여부를 확인한다.

### 9-1. 수치 진실성 검사 (validate-bridge 불변식 + 픽셀 대조)
스키마·참조 무결성만으로는 좌표 거짓말을 못 잡는다(실측: pc-home 결함 4건 전부 스키마 통과).
`validate-bridge.mjs`는 다음을 추가로 검사해 **경고**로 보고하고, extractor는 경고 항목을 §8 교차검증
대상으로 삼아 보정하거나(스크린샷 기준) 해당 서브트리에 confidence를 마킹한다:
- **오토레이아웃 산술 불변식**: `sizing: hug`인 축에서 `padding + Σ자식 + gap×(n-1) ≈ bbox` (±2px).
  counter축은 `padding + max(자식)`. `primaryAxisAlign: space-between`이면 gap이 파생값이므로 주축 검사 생략.
- **포함 관계 불변식**: 자식 bbox가 부모 bbox를 벗어나면(±4px) 경고.
- **선언 레이아웃 겹침 불변식**: `mode: row|column`인데 자식 bbox가 주축에서 겹치면 모순.
- **bbox↔스크린샷 edge 대조**: solid fill(불투명)이나 stroke를 선언한 컨테이너 노드에 대해, 선언된
  bbox 경계 위치의 스크린샷 픽셀에 실제 시각 경계(색 전이)가 있는지 표본 검사. 경계 4변 중 2변 이상에
  전이가 없으면 "bbox가 스크린샷과 불일치 의심" 경고. 부모와 같은 색이고 stroke도 없는 노드는 제외.

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
- **입력 불변 스킵(시간 절약)**: 산출 시 `node scripts/mcp-cache.mjs fingerprint <cacheDir>` 값을
  브릿지 `meta.sourceFingerprint`에 기록한다. 재실행에서 기존 브릿지가 있고 지문이 같으면
  원시 입력이 동일하므로 **추출·교차검증을 통째로 스킵하고 기존 브릿지를 재사용**한다
  (validate-bridge 재실행만으로 충분). 지문이 다르거나 없으면 정상 추출.

## 11. 비전 보강 (vision enrichment) — 의미 레이어 + 누락 backfill
MCP 데이터만으로는 "이쁜 코드"에 필요한 **의미**(이게 히어로인지, CTA인지, 카드 리스트인지)가 없다.
스크린샷을 비전으로 분석해 그 의미 레이어를 얹는다. 단, 신뢰 영역을 엄격히 나눈다:

**대원칙 — MCP 측정값이 항상 정답.** 비전은 MCP가 준 수치·색·텍스트·토큰을 **절대 덮어쓰지 않는다**
(비전은 16px을 15로 환각한다). 비전이 하는 일은 두 가지뿐:

1. **의미 레이어 (semantic)** — 모든 브릿지에 기본 수행:
   - 주요 컨테이너/요소에 `semanticRole` 부여 — 예: `hero`, `nav`, `cta-button`, `card`, `card-list`,
     `footer`, `avatar`, `badge`. 자유 문자열이되 kebab-case, 일반적 UI 용어 사용.
   - **반복 패턴 인식**: 같은 구조가 2회 이상 반복되는 형제들 → 부모에 `card-list`류 role,
     자식들에 동일 role. plan/code가 `.map()` 반복 렌더로 계획하는 근거가 된다.
   - `Frame 27` 같은 무의미한 레이어 이름의 컨테이너에 우선 적용. 확신 없으면 안 붙인다(추측 금지).
   - `semanticRole`은 비전 전용 필드이므로 별도 태깅 불필요.
2. **누락 backfill** — §8 교차검증이 `missing-node`를 잡았고 재추출로도 못 채울 때만:
   - 스크린샷에서 읽은 내용으로 노드를 생성하되, 그 노드에 `source: "vision"` + `confidence`(0~1)를 반드시 붙인다.
   - 이 노드의 수치(bbox/px)는 **추정값**이다 — verify 단계가 최우선 확인 대상으로 삼는다.
   - 전형적 대상: 이미지에 래스터화되어 MCP 트리에 없는 텍스트/로고.

**비용·재현성**: 스크린샷은 §6-6에서 이미 확보된 로컬 파일이므로 이 패스는 **MCP 호출 0회**,
`source: cache` replay에서도 동일하게 동작한다. 토큰도 §8 교차검증이 읽는 스크린샷을 **공유**하므로
순수 추가분은 추론 1~2k 수준(화면당). 빠른 이터레이션에는 `enrich: off`로 §11·§12를 통째로 건너뛸 수 있다
(§8 교차검증은 안전망이므로 off여도 수행).
**검증**: `validate-bridge.mjs`가 vision 유래 노드 수를 경고로 보고한다 — 0이면 순수 MCP 브릿지,
있으면 verify 단계에서 해당 노드를 우선 대조한다.

## 12. 구조 추론 — 디자인에 없어도 코드에 필요한 구조를 제안
디자이너가 Figma에서 컴포넌트화/그룹핑을 안 해놨어도, 코드는 **재사용 컴포넌트와 의미 있는 중첩**으로
나와야 한다. MCP 데이터에 그 구조가 없으면 extractor가 **추론해서 제안**을 얹는다 (§3의 "실제 Figma
컴포넌트 판별"과 별개 레이어 — 실제가 있으면 §3이 항상 우선).

1. **컴포넌트화 추론 (`suggestedComponent`)**
   - 대상: Figma 컴포넌트/인스턴스가 **아닌데** 같은 구조가 2회 이상 반복되는 서브트리
     (자식 타입 시퀀스·layout·스타일 시그니처가 동일), 또는 명백한 UI 패턴(버튼 모양 프레임 등).
   - 반복 발생 노드 각각에 동일한 `suggestedComponent: "RollingCard"`(PascalCase)를 부여한다.
     → plan/code는 같은 값을 가진 노드들을 **컴포넌트 1개 + `.map()` 데이터**로 계획한다.
   - 발생 간 달라지는 값(텍스트/색/이미지)은 `suggestedProps`에 기록 — prop 후보가 된다.
     예: `{ "title": "감사했어요", "avatar": "asset-avatar-2" }`
   - 판단 근거는 structure 유사성 + 비전 반복 인식(§11-1). **확신 없으면 안 붙인다** — 잘못된
     컴포넌트화 제안은 없느니만 못하다. 1회만 나오는 요소에는 붙이지 않는다(반복 근거 필수).
   - §3과의 관계: `componentName`/`isDesignSystemComponent`는 "Figma에 실제로 있는 것",
     `suggestedComponent`는 "없지만 만들어야 하는 것". 한 노드에 둘 다 있을 수 없다.
2. **재그룹핑 추론 (합성 래퍼 노드, `source: "inferred"`)**
   - 대상: 절대배치(`layout.mode: "none"`) 컨테이너에서 시각적으로 한 덩어리인 형제들
     (근접·정렬·공통 배경/테두리 위에 얹힘). 예: 라벨 + 인풋이 그룹 없이 나란히 절대배치된 경우.
   - extractor는 이들을 감싸는 **합성 `group` 노드를 만들어도 된다.** 단:
     - 합성 노드에 `source: "inferred"` 태깅 필수 (디자인 원본에 없는 노드임을 표시).
     - 시각 결과를 바꾸면 안 된다 — 합성 노드의 `bbox`는 자식들의 합집합, 스타일 없음.
     - 원본 자식 노드들은 그대로 보존 (무손실 — 추가만 허용, 변형·삭제 금지).
   - 이때 layout 추론(자식 배치가 세로 등간격이면 `mode: "column"` + `gap`)까지 채우면
     code가 absolute 대신 flex로 구현할 수 있다.
- **검증**: `validate-bridge.mjs`가 suggestedComponent(PascalCase)와 inferred 노드 수를 보고한다.
  vision(§11)과 마찬가지로 추론 결과는 verify 단계의 확인 대상이다.

## 13. 수치 정규화 — 소수점 픽셀은 코드에 없다
실측 근거: pc-home 캡처에서 `radius: 36.567`, `gap: 1.818`, `padding: [5.455, 10.909, …]` 같은 값이
다수 발견됨 — 공통 배율(≈0.909)이 곱해진 **스케일 아티팩트**다. `gap-[1.818px]` 같은 코드는 아무도 안 쓴다.
정규화는 디자인 의도의 **복원**이지 손실이 아니다 (아티팩트가 원본 의도가 아님).

1. **스케일 아티팩트 복원(우선)**: 같은 서브트리의 값들이 공통 배율의 곱으로 설명되면
   (예: 5.455=6×0.909, 10.909=12×0.909, 1.818=2×0.909) 배율을 나눠 **nominal 값**(6, 12, 2)으로 복원한다.
2. **반올림(차선)**: 배율로 설명 안 되는 나머지 px 수치(`gap`/`padding`/`cornerRadius`/`stroke.weight`/
   `effect.radius·offset`/`bbox`)는 **정수로 반올림**. 단 0 < v < 1 인 값(0.5 border 등)은 소수 1자리 유지.
3. **typography**: `size`는 정수 반올림, `lineHeight`가 비율(1.5)이면 소수 2자리까지 유지.
4. 적용 시점: extractor 병합 후처리의 마지막(§12 다음, 검증 §9 직전). fidelity와 무관하게 항상 적용.
- **검증**: `validate-bridge.mjs`가 소수 2자리 이상 px 값을 경고한다 — 정규화 누락 신호.

## 14. 저장 포맷 — 정본은 compact
브릿지 JSON 정본은 **무들여쓰기(compact)로 저장**한다. pretty 저장은 파일을 4배 불려(pc-home 실측
94KB≈24k 토큰 vs 23KB≈6k 토큰) 하류(plan/code/verify)가 매 단계 지불하는 읽기 토큰 = 시간을 낭비한다.
- 사람이 검토할 때만 `node scripts/bridge-format.mjs <bridge.json> --pretty`로 본다(stdout, 파일 불변).
- 브릿지를 제자리 수정하는 스크립트(emoji-extract 등)도 compact로 재저장한다.
- `shared/examples/`의 예시 브릿지는 사람용 문서이므로 pretty를 유지해도 된다.
