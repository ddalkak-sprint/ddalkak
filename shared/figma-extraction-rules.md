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
