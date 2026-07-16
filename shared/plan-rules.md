# plan 규칙 (plan 단계 SSOT)

`plan` 스킬이 브릿지 JSON을 읽어 `plan.md`를 만들 때 따르는 구체 규칙.
스키마 필드 정의는 [bridge.schema.json](bridge.schema.json), 단계 계약은 [pipeline.md](pipeline.md),
브릿지가 필드를 어떻게 채웠는지는 [figma-extraction-rules.md](figma-extraction-rules.md) 참고.

> plan.md는 **사람이 검토하는 게이트 문서**다(사용자가 확인 후 code로 진행). 그래서
> 코드를 미리 쓰지 않고, "무엇을 / 어디에 / 어떤 순서로" 만들지를 명확·간결하게 적는다.

## 1. `<name>` 과 screen → page 매핑
- `<name>`은 브릿지 파일명(`<name>.bridge.json`)을 그대로 승계한다. 출력은 `.ddalkak/plan/<name>.plan.md`.
- 브릿지 `screens[]` 항목 1개 = 페이지 컴포넌트 1개. screen `name`(kebab-case)을 PascalCase로 바꿔
  페이지 컴포넌트 이름으로 삼는다 (`login-page` → `LoginPage`). 경로는 design.md 디렉토리 규칙(기본 `src/pages/`).
- screens가 여러 개면 각각 페이지로 계획하되, 같은 `variantGroup`을 가진 것들은 §5로 하나로 묶는다.
- **페이지 등록**: 생성한 페이지가 실제로 렌더되도록 앱 진입점 연결 파일도 파일 계획("수정")에 포함한다 —
  design.md 라우팅 규칙이 있으면 그 방식(라우터 등록), 없으면 프로젝트의 기존 진입 방식(App 등)을 따른다.

## 2. 노드 타입 → 코드 타깃 매핑
브릿지 노드 트리를 순회하며 각 노드를 아래 표대로 코드 산출물에 대응시킨다.
(스키마의 노드 타입 10종 전부를 다룬다 — 표에 없는 타입을 만나면 즉흥 처리하지 말고 사용자에게 알린다.)

| 브릿지 노드 | 코드 타깃 | 비고 |
|-------------|-----------|------|
| `type: component` / `instance` | 재사용 컴포넌트 (import·수정·신규) | §3으로 판별. `instance`는 v2.1의 컴포넌트 인스턴스 표기 — `component`와 동일 취급 |
| `type: frame` / `group` | 레이아웃 JSX (flex 컨테이너) | `layout`(row/column)+`gap`+`padding`+`style`를 컨테이너 클래스로. `mode: "wrap"`이면 `flex-wrap`(그리드형 목록 — 자식 폭 고정 여부 확인). `mode: "none"`이면 §2-1 |
| `type: text` | 텍스트 요소 | `content`를 그대로, `style.token`/`style.color`를 타이포·색 매핑. `runs[]`가 있으면 run별 `<span>`으로 분할해 서식 구현(run에 `role: "link"`가 있으면 그 run만 `<a>`). `style.role: "link"`면 요소 전체를 `<a>` |
| `type: image` + `ref` | 에셋 (`assets[]` export) | §9. `<img>` 로 렌더, import 경로 계획 |
| `type: vector` + `ref` | SVG 에셋 | image와 동일하게 §9 (`<img src={svg}>` 기본, 색 제어가 필요하면 인라인 SVG로 명시) |
| `type: vector`/`image` **ref 없음** | 자리표시 `div` | 브릿지 추출 누락 — plan에 기록하고 사용자에게 알린다 |
| `type: shape` / `ellipse` | 스타일된 `div` | 배경/보더/radius만 있는 장식 박스. `ellipse`는 `rounded-full` |
| `type: line` | 구분선 | 부모 컨테이너의 `border-*` 또는 `<hr>`로 구현 (1px fill 색 → border 색). 방향은 bbox로 판별: h=1 → 가로(`border-t`), w=1 → 세로(`border-l`) |

- 노드의 `bbox`(`[x, y, w, h]`)는 **레이아웃 검증용 참조값**이지 좌표 지정용이 아니다.
  절대좌표로 옮기지 말고 부모의 `layout`/`gap` 기반 흐름 레이아웃으로 계획한다.

### 2-1. `layout` 정보가 없을 때 (`mode: "none"` 또는 누락)
- 기본: 자식들의 `bbox`를 y→x 순으로 정렬해 흐름 순서를 정하고, bbox 간격을 근사한
  flex 흐름 레이아웃으로 계획한다 (겹치지 않는 일반 UI 영역).
- 예외 — **일러스트 영역**: 자식 bbox가 서로 겹치거나, `reconciliation`이 일러스트/재조합 서브트리로
  명시했거나, 커서·장식 이미지처럼 조작 대상이 아닌 영역은 relative 컨테이너 + absolute 자식 배치를
  허용한다. 이 경우 plan에 해당 영역을 "일러스트 절대배치"로 명시한다.
  절대배치로 판정한 서브트리는 **내부 전체**를 절대배치로 계획한다 — 안에서 일부만 flow로 섞지 않는다
  (재실행마다 경계가 달라지는 확률 지점. code-rules §5와 동일 기준).
  - **좌표를 표로 담는다.** 절대배치 서브트리는 흐름 레이아웃과 달리 code가 각 자식의 좌표를 알아야 하고,
    그 값은 브릿지 bbox에만 있다. 그래서 이 서브트리의 자식별 `left/top`(과 필요한 `w/h`)을 **부모 기준 좌표**로
    plan에 표로 적는다(예: MessageCard 내부 avatar `left-[12px] top-[19px]`, tag `left-[51px] top-[41px]` …).
    이게 없으면 code가 좌표마다 브릿지를 다시 열어 서브트리 전체를 재유도한다(이번 실측의 최대 브릿지 재열람 지점).
    이 표는 손으로 세지 말고 `scripts/plan-extract.mjs <bridge.json>`로 뽑는다 — 겹치는 서브트리를 자동으로 찾아
    부모 기준 좌표를 code 복사용 클래스(`left-[Npx] top-[Npx]`)로, 같은 좌표의 재사용 인스턴스는 하나로 합쳐 낸다.
    브릿지 자식 bbox가 곧 부모 상대 좌표라 무손실이고 결정론적이다. 출력 표를 이 섹션에 붙여넣고 컴포넌트 경계만 판단한다.
- **스크린샷 교차검증**: bbox 배치가 스크린샷(`screens[].screenshot` export)과 모순되면
  **스크린샷이 진실이다** — 스크린샷 기준으로 계획하고, 모순 내용을 plan "가정 및 미해결"에 기록해
  브릿지 담당에게 전달한다. (예: bbox상 겹치는 카드들이 스크린샷에선 나란히 배열)

### 2-2. v2.1 의미 필드 소비 (semanticRole / suggestedComponent)
- `suggestedComponent`가 있으면 **그 이름·단위로 컴포넌트를 분해하는 것이 기본값**이다.
  같은 `suggestedComponent`끼리는 §6으로 축약하고, `suggestedProps`를 props 초안으로 승계한다.
  제안과 다르게 분해할 때는 사유를 plan에 명시한다.
- `suggestedProps`와 노드 `content`가 **불일치**하면(예: content에 파생 접미사가 붙은 경우) 노드 content를
  진실로 삼고, props 조합으로 재구성하려면 그 파생 로직을 ⚠에 명시한다. 브릿지에 대응 노드가 없는
  텍스트/요소는 계획에 발명해 넣지 않는다(필요해 보이면 ⚠로 브릿지 담당에게 전달).
- `semanticRole`은 시맨틱 태그·역할 힌트로 반영한다:
  `nav`→`<header>`/`<nav>`, `card`→`<article>` 등 시맨틱 요소, `cta-button`→주요 CTA,
  `badge`→라벨 요소, `card-list`→목록 컨테이너, `avatar`→인물 이미지(alt 계획).
  역할이 명확한 노드는 컴포넌트 이름과 태그 선택에 이 힌트를 우선 사용한다.
- `semanticRole`·`name`은 **태그·alt·컴포넌트 이름** 힌트일 뿐이다. 노드의 명시 `style`(cornerRadius 등)·
  `layout`(mode/gap)을 이 힌트로 바꿔 계획하지 않는다 — "avatar라서 원형" 식 정규화 금지(code-rules §4-2).

### 2-3. 이모지 글리프 텍스트 → 벡터 이모지 에셋
- `content`가 **이모지 글리프뿐인 `type: text` 노드**(예: 👍 😍 🎉)는 텍스트가 아니라 **벡터 이모지 에셋(SVG)**으로 계획한다.
  이모지를 텍스트로 렌더하면 브라우저·OS마다 시스템 이모지로 폴백돼 디자인과 다르게, 환경마다도 다르게 그려진다.
  코드포인트를 공개 이모지 세트(기본 Twemoji)의 SVG로 고정하면 모든 해상도에서 선명하고 환경 불문 동일하다.
- 계획: 그 노드를 §9 에셋으로 취급해 `<img>` 렌더로 계획하고(크기는 leaf bbox의 w/h), 파일 계획에 SVG 에셋을 넣는다.
  에셋은 `scripts/emoji-extract.mjs`가 코드포인트별로 받아 만든다(code-rules §6-1). 컴포넌트가 이모지를 받는다면
  텍스트가 아니라 **이미지 src prop**(예: `emojiSrc`)으로 계획한다.
- 브릿지에 이 노드용 `ref` 에셋이 아직 없어도 계획에는 에셋으로 넣고, "이모지 에셋은 code 단계 emoji-extract로 생성"을
  §9/⚠에 명시한다. (이모지가 아닌 일반 컬러 텍스트·아이콘 폰트는 이 규칙 대상이 아니다.)
- **verify 한계 명시**: 세트 글리프는 Figma가 쓴 이모지와 모양이 완전히 같지 않아 verify의 이모지 영역 픽셀 불일치는
  남는다. 이는 Figma↔브라우저 이모지 래스터의 본질적 차이라 코드로 못 없애며, 게이트를 콘텐츠 인지형으로 다루는
  검증쪽 몫이다. plan은 이 점을 ⚠에 적어 "이모지 영역 불일치는 정상"임을 전달한다.

### 2-4. 상호작용·표 시맨틱 역할 → 네이티브 요소
`semanticRole`이 상호작용이나 표 구조를 가리키면 §2 기본 매핑(`frame→div`, `text→span`)을 덮고
네이티브 요소로 계획한다. **div/span으로 떨구지 않는다** — 키보드 포커스·기본 동작·접근성이 사라진다.
(브릿지가 이 역할을 이미 태깅해 두므로 발명이 아니라 소비다. §2-2 여섯 역할의 확장.)

| semanticRole | 코드 요소 | 비고 |
|---|---|---|
| `button` / `cta-button` / `icon-button` | `<button type="button">` | 아이콘만 있어 라벨 텍스트가 없으면 `aria-label` 계획 |
| `nav-menu` / `menu-item` (드롭다운 트리거) | `<button>` + `aria-haspopup` | 펼침 상태가 있으면 `aria-expanded` |
| `search-field` (값 직접 입력) | `<input>` + `<label>` 연결 | 옵션에서 고르는 형태(값+화살표)면 `<select>`. 어느 쪽인지 브릿지로 불분명하면 ⚠에 기록 |
| `tab` | `<button role="tab">` (목록 컨테이너는 `role="tablist"`) | 현재 탭은 `aria-selected` |
| `nav-item` | 라우팅(다른 페이지·URL로 이동)이면 `<a href>`, 앱 내 화면 전환·토글이면 `<button>` | 판별 불가면 `<button type="button">`을 기본으로 하고 ⚠에 기록(죽은 href 방지) |
| `breadcrumb-item` | `<a href>`, **마지막(현재 위치)** 항목만 `<span aria-current="page">` | 링크 대상은 design.md 라우팅 규칙, 없으면 ⚠ |

- 표 구조(`table` / `table-header` / `table-row`)는 격자 시맨틱으로 계획한다:
  목록 컨테이너 `<table>`, 헤더행 `<thead>`+셀 `<th scope="col">`, 데이터행 `<tbody>`+`<tr>`+셀 `<td>`.
  Figma가 오토레이아웃 프레임으로 준 표라도 flex/grid `div`로 두지 말고 표 요소로 재구성한다.
  셀의 정렬·간격·폭 등 **시각 수치는 §2·§4 그대로** 스타일 클래스로 유지한다(시맨틱만 표 요소로 바꾼다).
- 상호작용 요소의 컴포넌트 API는 네이티브 요소 속성을 passthrough 하도록 계획한다
  (`<button>`→`ButtonHTMLAttributes`, `<a>`→`AnchorHTMLAttributes`, `<input>`→`InputHTMLAttributes`).
  `onClick`/`href`/`value` 같은 동작 값을 새 명명 prop으로 발명하지 말고 요소 속성으로 흘린다(§3 props 표에 명시, code-rules §7-1).
- 이 판정은 §2-2 마지막 문단과 동일하게 **태그·요소 선택에만** 쓴다 — 역할을 근거로 radius/gap/방향 같은
  시각 수치를 바꾸지 않는다.

## 3. 컴포넌트 재사용 vs 수정 vs 신규 판별
`type: component`/`instance` 노드는 브릿지가 이미 판별해 둔 필드로 결정한다(figma-extraction-rules §3).
핵심: `mappedCodeComponent`는 **대상 코드 경로**일 뿐, 그 파일이 실제로 존재하는지로 재사용/신규를 가른다.
- `mappedCodeComponent`가 있고 **그 경로에 컴포넌트가 이미 존재**하면 → 재사용(import)하도록 계획. 파일 계획에 "신규"로 넣지 않는다.
- `mappedCodeComponent`가 있으나 **그 경로에 아직 파일이 없으면** → 그 경로에 **신규 생성**으로 계획(그린필드 프로젝트의 정상 케이스).
- `isDesignSystemComponent: true`이나 `mappedCodeComponent`가 `null`이면 → design.md 컴포넌트 규칙에 따라
  **신규 재사용 컴포넌트**로 계획(기본 `src/components/<Name>/<Name>.tsx` + `index.ts`).
- `isDesignSystemComponent`가 false/누락이면 → 그 화면 전용이면 페이지 내부 JSX로, 반복되면 신규 컴포넌트로.
  단 `componentName`/`suggestedComponent`가 명확한 컴포넌트 단위를 가리키면(§2-2) 그쪽을 우선한다.
- `componentProps`는 컴포넌트에 넘길 props 초안으로 기록한다(예: `{ variant, size, type }` → props 표).
  이때 필수/선택과 **타입**을 함께 표기한다 — 모든 인스턴스가 값을 명시하면 필수(기본값 없음), 값이 없는 인스턴스가
  있으면 optional (code-rules §7-1과 동일 기준). 타입은 브릿지 값으로 확정한다(`variant: "primary"|"outlined"`,
  `count: string`(브릿지 content가 문자열이면 string) 등) — 안 적으면 code가 number/string을 임의로 골라 재실행에 갈린다.
  단일 텍스트 `content`는 prop이 아니라 children으로 계획한다.
- **파생 prop은 값의 형식까지 확정한다.** ⚠로 파생한 prop(색 주입 등)은 코드 표현 형식을 명시한다 —
  예: `tagColor`는 hex가 아니라 **Tailwind 클래스 문자열**(`bg-purple-200` / `bg-[#E2F5FF]`)로 넘긴다(JIT 스캔·§4 표와 일치).
  형식을 안 적으면 code가 hex↔클래스 사이에서 갈린다.
- **컴포넌트 내부 텍스트는 타이포 토큰·색을 분해에 바인딩한다.** 각 텍스트 슬롯이 어느 type 토큰·어느 색인지
  컴포넌트 분해(또는 파일 계획 설명)에 적는다(예: HomeButton 라벨 40→`font-16-bold`/`gray-900`, 56→`font-18-bold`/white).
  §4 토큰 표는 "이 화면이 이 토큰들을 쓴다"는 집합이고, 이 바인딩은 "이 텍스트가 그중 무엇을 쓴다"는 연결이다 —
  후자가 없으면 code가 각 텍스트의 토큰을 브릿지에서 다시 읽는다.
- `componentName`이 `Name/Variant-Size` 패턴이면(예: `Button/Outlined-40`) 변형마다 별도 컴포넌트가 아니라
  **베이스 컴포넌트 1개 + variant/size props**로 계획한다.

### 3-1. 기존 프로젝트와의 충돌 (브라운필드)
- **수정**: 대상 컴포넌트가 이미 존재하지만 필요한 variant/props를 지원하지 않으면 파일 계획에
  "수정"으로 분류한다. 단, 기존 사용처가 깨지지 않도록 **하위호환 조건**(기존 props 기본값 유지)을 명시한다.
- **동명이형(同名異形) 컴포넌트**: 존재하는 동명 컴포넌트와 **디자인 체계 자체가 다르면**(색·형태가 다른
  별개 디자인 시스템) 수정하지 말고 스코프된 이름(예: `HomeButton`)의 신규 컴포넌트로 계획하고 사유를 명시한다.

## 4. 토큰 → 코드 매핑 계획
- 브릿지 `tokens.color / type / spacing`를 design.md의 **토큰 전략**에 매핑해 "디자인 토큰 매핑" 표에 적는다.
  - design.md 기본 베이스(Tailwind): color → `tailwind.config` `theme.extend.colors`(+유틸 클래스), type → `fontSize`,
    spacing → 기본 스케일 또는 px 확장. 이때 `tailwind.config.js`를 파일 계획에 "수정"으로 넣는다.
  - 다른 스타일링 스택이면 design.md가 지정한 방식(CSS 변수/테마 객체 등)으로 매핑.
- **비토큰 raw 값도 표에서 최종 코드 표현으로 확정한다 (code 암산 제거·재실행 결정론).**
  화면에 쓰인 raw 시각값의 **distinct 집합**을 표에 모아, 각 값을 미리 환산해 둔다
  (Tailwind 기본은 code-rules §4-1 절차, 다른 스택은 design.md 방식). code가 환산 없이 표를 **복사만** 하게 하려는 것 —
  리포트의 `radius 12 → 9999`, `gap 8 → 16/4` 같은 환산 이탈이 이 지점에서 난다.
  대상 시각값 종류를 빠짐없이 훑는다: **radius / gap / padding / 고정 폭·높이 / 그림자(effects) / 획(stroke)**.
  - **그림자는 distinct 집합에 반드시 포함한다.** 노드 `effects`의 drop-shadow를 code-rules §4-1의 4성분 표기
    (`shadow-[x_y_blur_spread_color]`, spread 0도 명시)로 확정한다. 이게 없으면 code가 그림자를 브릿지에서 다시 읽는다.
  - **근접값은 서로 다른 값이다.** `rgba(0,0,0,0.5)`와 `rgba(0,0,0,0.54)`, 11px와 12px를 하나로 뭉개지 않는다 —
    실제로 다른 값이 여러 개면 표에 각각 올린다(뭉개면 code가 누락값을 브릿지에서 다시 읽는다).
  - **레이아웃이 강제하는 고정 폭·높이도 담는다.** `sizing: fixed`가 아니어도, hug 컴포넌트가 줄바꿈/정렬 때문에
    폭을 고정해야 하거나(heading 2줄 유지 폭), `justify-between` 컨테이너처럼 고정 폭이 필요한 경우 그 bbox 값을 표에 올린다.
  - raw 값이 **등록 토큰과 동일값**이면 raw로 두지 말고 그 토큰 클래스로 확정한다.
  - 같은 값은 표에서 **하나의 코드 표현**만 갖는다(같은 12px가 두 표현으로 갈리지 않게).

### 4-1. 토큰 충돌 (브라운필드)
- 등록하려는 토큰 이름이 프로젝트 설정에 **다른 값**으로 이미 존재하면 덮어쓰지 않는다 →
  `<token>-<screen|서비스>` 접미사로 스코프해 등록하고(예: `surface` 충돌 → `surface-home`),
  토큰 표에 충돌 사실을 명시한다. **이름과 값이 모두 같으면** 기존 토큰을 재사용한다.
- Tailwind 기본 팔레트 이름(`purple-600` 등)과 겹치면 해당 셰이드를 덮어쓰게 됨을 토큰 표에 명시한다.
- 토큰/스타일의 `font.family`가 프로젝트에 없으면 `fontFamily` 등록과 **폰트 로딩 방법**
  (index.html 링크 등)을 파일 계획에 포함한다.

## 5. 반응형(variantGroup) 계획
- 같은 `variantGroup`을 가진 screen들은 별도 페이지가 아니라 **하나의 페이지 컴포넌트 + 반응형 스타일**로 계획한다.
- 각 screen의 `breakpoint`(mobile/tablet/desktop/default)를 브레이크포인트 전략에 매핑한다
  (Tailwind면 `sm:`/`md:`/`lg:`). 브레이크포인트별로 달라지는 값만 분기로 표기.
- Tailwind 베이스는 **mobile-first**: 가장 작은 breakpoint 화면을 기본 스타일로 삼고,
  큰 화면을 `md:`/`lg:` 분기로 계획한다 (desktop을 기본으로 두고 축소하지 않는다).
- **breakpoint 간 구조 차이**: 값만 아니라 **노드 자체가 한 breakpoint에만 존재**할 수 있다
  (예: desktop 전용 사이드바). 이런 서브트리는 표시 분기(`hidden lg:flex` 등)로 계획하고,
  컴포넌트 분해·파일 계획은 **모든 breakpoint의 합집합** 기준으로 잡는다.
- 노드의 `constraints`(left-right/center/scale 등)는 리사이즈 힌트 **참조값**이다 —
  고정 폭 화면에서는 무시하고, 반응형 스트레칭 판단(§5)에만 참고한다.

## 6. 중복 인스턴스 축약
- 같은 컴포넌트(같은 `ref`/`mappedCodeComponent`)가 여러 번 나오면 컴포넌트는 **한 번만** 파일 계획에 넣고,
  화면에서의 인스턴스 수와 각 `content`/`componentProps` 차이를 컴포넌트 분해 항목에 병기한다
  (예: `TextField` ×2 — 이메일(type=email) / 비밀번호(type=password)).

## 7. 구현 순서 도출
code 단계가 그대로 따를 수 있도록 의존성 순서로 적는다. 기본 순서:
1. 토큰/설정 파일 (예: `tailwind.config.js` 토큰 등록)
2. 잎(leaf) 재사용 컴포넌트 (다른 것에 의존하지 않는 것부터)
3. 상위 컴포넌트 → 페이지 조립 (노드 트리 순서대로)
4. 에셋 배치
5. bbox 대비 레이아웃 확인 (폭/정렬 등 눈으로 확인할 포인트)

## 8. design.md 유무
- 있으면 스택·디렉토리 구조·네이밍·토큰 전략을 **모두 design.md 기준**으로 계획하고,
  plan.md 개요에 `컨벤션: ./design.md` 출처를 명시한다.
- 없으면 프로젝트의 기존 패턴을 추론하되, **package.json 의존성으로 스택을 먼저 판별**한다(`vue` 존재 → Vue 등 —
  파일 계획의 확장자·컴포넌트 형식도 그 스택 관용을 따른다). 그것도 불분명하면 기본 베이스(React 18 + TS + Tailwind)로
  계획하고 "design.md 없음 — 기본 베이스 가정" 을 개요에 명시한다.

## 9. 에셋 계획
- 브릿지 `assets[]` 각 항목을 프로젝트 에셋 경로로 배치하도록 계획한다
  (`.ddalkak/assets/<name>/logo.svg` → design.md assets 규칙, 기본 `src/assets/<name>/logo.svg`).
- 파일 계획 표에 에셋 파일을 "신규"로 넣고, 이를 참조하는 `image`/`vector` 노드와 연결해 둔다.
- `kind: "screenshot"` 에셋은 verify 단계 전용이다 — 프로젝트로 배치하지 않는다.
- export 파일이 `.ddalkak/assets/`에 실제 존재하는지 확인하고, 없으면 plan에 명시하고 사용자에게 알린다.

## 10. plan.md 구조 (템플릿 채우기)
출력은 `${CLAUDE_PLUGIN_ROOT}/skills/plan/reference/plan.template.md` 골격을 채운다. 각 섹션:
- **개요** — 출처 브릿지 경로, 대상 화면(frame 크기·요지), 적용 컨벤션(design.md 유무).
- **컴포넌트 분해** — 컴포넌트별 역할 + 대응 브릿지 노드(§2·§6).
- **파일 계획** — 경로 / 신규·수정 / 설명 (§3·§4·§9로 도출한 전체 파일 목록).
- **디자인 토큰 매핑** — §4 표.
- **인터랙션 & 상태 전환** — §11. 트리거→동작→로직 출처 표(인터랙티브 요소·상태 variant가 있으면 필수).
- **기존 소스 통합(브라운필드)** — §12. 대체/수정/공존 + 회귀 경계. 그린필드면 "해당 없음".
- **구현 순서** — §7.
- **결정·추가정보 요청** (조건부, ⚠) — §13. 규칙으로 결정 못 해 사용자가 정하거나 추가정보를 줘야 하는 항목.
  하나라도 있으면 사용자 게이트(code 진행 전 질의). 없으면 섹션 생략.

작성 예시(로그인 화면 기준)는 `${CLAUDE_PLUGIN_ROOT}/shared/examples/login-page.plan.md`.

### 10-1. 자동 검증 (결정론 게이트)
저장한 plan.md는 `scripts/validate-plan.mjs`로 점검한다(브릿지가 곧 계약, `validate-bridge.mjs`와 대칭).
- **error(구조·계약)**: 필수 섹션 누락, 파일 계획 표 붕괴, 토큰 매핑 표 부재, 제목 `<name>` 불일치,
  브릿지 screen에 대응하는 페이지 부재(커버리지 구멍). error는 반드시 해소한다.
- **warning(완결성)**: 브릿지가 참조한 토큰·raw 시각값(radius/gap/padding/고정 폭·높이/**그림자/획**)이 토큰 매핑 표에
  없음, 컴포넌트 내부 텍스트의 **타이포 토큰·색 바인딩 부재**, props 표의 **타입·파생 형식 부재**,
  절대배치 서브트리의 **자식 좌표 표 부재**, 컴포넌트 미언급, 페이지 등록 행 부재. 이 경고가 곧 §4가 막으려는
  "code 즉석 환산·브릿지 재열람" 지점이므로, 지적된 값을 표에 채워 없애는 것을 기본으로 한다.
  검사기 `validate-plan.mjs`는 토큰·raw 시각값에 더해 raw 색(fill/stroke/effect 리터럴, 근접 rgba 각각),
  그림자(drop/inner-shadow 표기 유무), text 노드 인라인 타이포의 lineHeight, 겹치는 `mode:"none"` 서브트리의
  절대좌표 표 유무까지 자동 탐지한다. props 표의 타입·파생 형식과 텍스트 색 바인딩의 정합 검사는 아직 부분적이라
  게이트에서 눈으로 확인한다.

## 11. 인터랙션 & 상태 전환 (정적 디자인 → 동작)
디자인은 화면의 **모습**만 준다. **"이거 누르면 뭐가 되는지"(트리거)는 픽셀에 없다** — plan이 명시적으로 채운다.
- 같은 `adaptive.group`의 여러 variant는 "한 화면의 상태"다. **무엇이 어느 상태로 바꾸는지**를 "인터랙션 & 상태 전환" 표에 적는다. 프로토타입 reaction이 브릿지에 있으면 그것을 1순위 근거로 쓴다.
- 각 인터랙티브 요소(`semanticRole`: button/cta-button/input/search-field/tab/nav-item/link 등)마다 한 줄: **트리거(무엇을)** → **동작(화면 전환 / 상태 변경 / 서버 호출 / 토스트·다이얼로그)** → **로직 출처**(디자인 상태·기존 API·사용자 지정).
- **트리거·전환 대상이 디자인/브릿지로 불명확하면 추측하지 않는다** — §13대로 ⚠에 질문으로 올린다. (예: "교환하기 → 다음 화면? 서버 연동? 없음?")
- **로직성 조건**("입력 검증 통과 시 버튼 활성", "서버 401 시 에러 표시", "카운트가 0이면 빈 상태")은 디자인이 아니라 코드 판단이다. 어느 조건인지 plan에 적고, 애매하면 ⚠. 없는 데이터를 성공처럼 지어내지 않는다.
- **오버레이 역할**(`semanticRole` bottom-sheet/dialog/toast/drawer 또는 딤 배경 위 시트)은 **페이지가 아니라 모달**로 계획한다(code-rules §8-1). "이전 화면 위에 뜬다 / 딤은 barrier"를 명시하고, 배경을 이미지로 굽지 않는다.

## 12. 기존 소스 통합 (브라운필드)
빈 프로젝트가 아니면 새 화면은 **기존 코드와 부딪힌다.** plan이 그 경계를 먼저 그린다(그린필드면 이 섹션 "해당 없음").
- 이 화면이 건드리는 기존 자산을 **스캔**한다: 같은/유사 화면, 라우트(경로), API·컨트롤러, l10n 키, 그리고 그 화면을 검증하는 **기존 테스트**.
- 각각 관계를 판정해 표에 적는다: **대체 / 수정 / 공존 / 신규**(§3-1 동명이형 기준 재사용).
- **대체·수정이면 "보존할 것"(회귀 경계)을 명시한다**: 그 화면이 갖던 동작(입력 검증·에러·토스트·진입점)과 그걸 검증하는 **테스트/위젯 Key**. code는 이를 지키고, 기존 테스트는 새 UI 기준으로 갱신하되 **삭제·약화하지 않는다**(code-rules §9 테스트 게이트). 진입점을 숨길 땐 소스·라우트는 남긴다.
- **기존 스펙과 새 디자인이 충돌하면**(예: 실패=다이얼로그였는데 디자인은 인라인 에러) 임의로 스펙을 어기지 말고 ⚠에 올려 사용자·스펙 개정 결정을 받는다.

## 13. 누락 정보 → 사용자 요청 (게이트)
plan은 "규칙으로 결정 가능한 것"과 "사람이 정해야 하는 것"을 분리한다. **후자는 추측으로 채우지 않는다.**
- 다음은 항상 ⚠(결정·추가정보 요청)로 올린다: 트리거/전환 대상 미상(§11), 브라운필드 대체 여부·스펙 충돌(§12), **디자인에 없는 진입점·데이터**(측정 시작·마이페이지·실 카운트 등), 상태 조건 애매, 자산(에셋/스크린샷) 누락.
- ⚠ 항목이 하나라도 있으면 **code로 넘어가기 전에 사용자에게 묻고 답을 받는다**(gated 모드). 답이 온 항목은 결정 내용을 적어 "✅ 확정"으로 바꾼다.
- 질문은 **구체적 선택지**로 낸다("A로 대체 / B로 공존 / C 신규 …") — 열린 질문보다 사용자가 답하기 쉽고 결정이 추적된다. 오케스트레이터(`ddalkak`)는 이 ⚠가 비었는지 확인하고 code 게이트를 연다.
