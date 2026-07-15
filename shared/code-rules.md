# code 규칙 (code 단계 SSOT)

`code` 스킬이 `plan.md`를 실행 계획 삼아 실제 소스 파일을 생성/수정할 때 따르는 규칙.
계획 산출 규칙은 [plan-rules.md](plan-rules.md), 단계 계약은 [pipeline.md](pipeline.md),
브릿지 필드 의미는 [figma-extraction-rules.md](figma-extraction-rules.md) 참고.

> plan.md는 **이미 사용자 검토를 통과한 계약**이다. code는 새로 설계하지 말고 plan을 충실히 구현한다.
> plan과 실제가 어긋나면(파일 충돌 등) 임의로 벗어나지 말고 사용자에게 알린다.

## 1. 입력 읽기 & 스택 결정
1. `.ddalkak/plan/<name>.plan.md`를 읽어 파일 계획·구현 순서·토큰 매핑을 파악한다.
2. 프로젝트 루트 `design.md`가 있으면 스택/디렉토리/네이밍/토큰 전략을 그대로 따른다.
   없으면 프로젝트 기존 코드 패턴을 추론하고, 그래도 불분명하면 기본 베이스(React 18 + TS + Tailwind)로 진행한다.
3. plan이 참조한 브릿지 값이 필요하면 `.ddalkak/bridge/<name>.bridge.json`을 함께 열어 확인한다(토큰 원값, content 등).

## 2. 파일 계획 준수 & 범위 제한
- plan.md "파일 계획" 표의 파일만 생성/수정한다. 표에 없는 파일은 건드리지 않는다(무관한 파일 오염 금지).
- "신규"는 새로 만들고, "수정"은 기존 파일을 읽어 필요한 부분만 바꾼다(전체 덮어쓰기 금지).
- "구현 순서"를 그대로 따른다: 토큰/설정 → 잎 컴포넌트 → 상위·페이지 조립 → 에셋 → 레이아웃 확인.

## 3. 컴포넌트 재사용(import) vs 수정 vs 신규 생성
- plan이 "재사용"으로 표기했거나 대상 경로(`mappedCodeComponent`)에 컴포넌트가 **이미 존재**하면 → 새로 만들지 말고 import한다.
- plan이 "신규"로 표기한 컴포넌트만 그 경로에 작성한다. `mappedCodeComponent`가 있어도 그 파일이 없으면 신규 생성이 정상이다(그린필드).
- plan이 "수정"으로 표기한 컴포넌트는 기존 파일을 읽고 **기존 props와 사용처의 하위호환을 유지**하며
  확장한다(기존 props 기본값 보존). 수정 후 기존 사용처가 깨지지 않는지 빌드로 확인한다(§9).
- 이미 존재하는 파일은 덮어쓰지 말고 재사용한다.

## 4. 토큰 → 스타일 매핑
- plan의 "디자인 토큰 매핑" 표를 그대로 구현한다(스코프 접미사 등 충돌 처리 포함 — plan-rules §4-1).
  - Tailwind 베이스: color/type 토큰을 `tailwind.config.js` `theme.extend`(colors/fontSize)에 등록한 뒤
    유틸 클래스(`bg-primary`, `text-heading-lg`)로 사용.
  - 다른 스택이면 design.md가 지정한 방식(CSS 변수/테마 객체)으로 등록·참조.
- **표에 확정된 코드 표현은 그대로 옮긴다 — code에서 px→클래스 재환산 금지.**
  plan 표에 코드 표현이 있는 값(토큰·raw 불문)은 그 표현을 **복사**한다. 표에 없는 값을 만났을 때만 §4-1 절차로
  환산하되, 그런 값이 있었다는 사실을 생성 후 보고(§9)에 남긴다(plan 표 완결성 피드백 — 다음 재실행 때 표로 흡수).
- **수치는 절대 근사하지 않는다.** 스펙에 없는 "가까운 값"으로 옮기는 것이 verify 불일치의 주요 원인 —
  스케일/임의값 판정과 표기 형식은 §4-1을 따른다(정확 일치만 스케일 클래스, 그 외 임의값).
- 브릿지 노드 `style`에 raw 값으로 남은 일회성 값은 해당 요소에만 인라인/임의값으로 적용하고 토큰으로 승격하지 않는다.
  단 raw 값이 등록된 토큰과 동일값이면 토큰 클래스를 쓴다.

### 4-1. 표기 규약 — 같은 값은 항상 같은 클래스로 (재실행 결정론)
같은 스타일을 두 가지 이상으로 쓸 수 있으면 아래 규약으로 **하나로 고정**한다.
재실행 때 산출물이 표기 수준에서 달라지는 것을 막기 위한 규칙이므로 예외를 두지 않는다.
- **Tailwind 기본 스케일 전체와 정확 일치하면 스케일 클래스 의무** — 임의값 표기(`rounded-[6px]`, `h-[96px]`) 금지.
  판정 기준은 열거표가 아니라 **기본 스케일 전체**다(아래는 자주 나오는 값 예시일 뿐 — 표에 없다고 임의값이 아니다):
  - spacing(1단위=4px): 2→`0.5` 6→`1.5` 12→`3` 24→`6` 44→`11` 64→`16` 96→`24` 240→`60` …
  - radius: 2→`rounded-sm` 4→`rounded` 6→`rounded-md` 8→`rounded-lg` 12→`rounded-xl` 16→`rounded-2xl` 24→`rounded-3xl`
  - **pill 판정**: radius가 요소 높이의 절반 이상이면 값과 무관하게 `rounded-full`(999·100px pill 포함 — `rounded-[100px]` 금지)
  - 위 어디에도 해당 없는 px만 임의값 `[Npx]`
- 토큰 fontSize에 lineHeight가 내장돼 있으면(`text-title-xl` 등) `leading-*`을 중복 지정하지 않는다.
- 조건부 클래스 표기는 스택별 1형태로 고정한다 — React: 템플릿 리터럴 + 삼항, Vue: 정적 `class` + `:class="cond ? a : b"`.
- **임의값 표기 형식**: 길이는 `[Npx]`(px 단위 명시), 알파(불투명도)는 5% 단위면 스케일(`/40`),
  아니면 leading zero 소수(`/[0.54]` — `.54`·`54%` 표기 금지). 색상 hex는 브릿지 원문 그대로(대문자).
- **그림자 임의값은 4성분 전부 표기**: `shadow-[x_y_blur_spread_color]` — spread가 0이어도 생략하지 않는다
  (`shadow-[0_2px_12px_0_rgba(0,0,0,0.08)]`).
- **간격 1곳 = 속성 1개**: 하나의 간격을 마진+패딩 조합이나 음수 마진 상쇄(`mt-[-6px] pt-[24px]`)로
  표현하지 않는다 — 단일 속성(`mt-[18px]`)으로 쓴다. 음수 마진은 일러스트 절대배치 안과
  §5 잔차 예외 마진(기준 gap보다 좁은 간격을 단일 속성으로 표현할 유일한 방법일 때)에서만 허용.
- 프로젝트에 prettier 등 포매터 설정이 있으면 생성/수정한 파일에 실행해
  클래스 정렬·줄바꿈까지 고정한다(§9 빌드 전에 수행).

### 4-2. 브릿지 명시값 우선 — 관습·시맨틱으로 시각 수치를 덮지 않는다
verify 불일치의 또 다른 축은 근사(§4)가 아니라 **관습 강요**다 — "아바타니까 원형, 썸네일이라 정사각,
세로가 자연스러우니 column"처럼 스펙에 없는 판단으로 명시값을 바꾸는 것. 아래를 절대 규칙으로 둔다.
- 노드 `style`·`layout`의 **명시값**(cornerRadius / layout.mode / gap / padding / sizing / 색 등)은
  브릿지 그대로 구현한다. `semanticRole`·레이어 `name`·컴포넌트 관습으로 이 값을 바꾸지 않는다.
  - `cornerRadius: 12`인 아바타·썸네일을 `rounded-full`로 정규화 금지 → §4-1대로 `rounded-xl`
    (pill 판정, 즉 radius가 요소 높이의 절반 이상일 때만 `rounded-full`).
  - `layout.mode: "row"`를 자식 bbox 배열이나 "세로가 자연스러움" 판단으로 `flex-col`로 바꾸지 않는다.
  - `layout.gap: 8`을 "여백이 좁아 보임" 등으로 16/4로 조정하지 않는다 — gap은 브릿지 값 그대로.
- `semanticRole`·`name`은 **시맨틱 태그·alt·컴포넌트 이름** 선택에만 쓴다(§7). 모양·방향·간격·크기 같은
  **시각 수치에는 관여하지 않는다.** 명시값이 없을 때만(§2-1 layout 누락 등) 추론이 개입한다.
- **상호작용·표 역할은 네이티브 요소로 구현한다(plan-rules §2-4).** plan이 `<button>`/`<a>`/`<input>`/`<select>`
  또는 `<table>`류로 계획한 노드를 `div`/`span`으로 떨구지 않는다. 접근성 최소치를 함께 구현한다 —
  `<button>` 기본 `type="button"`, 아이콘 전용 버튼은 `aria-label`, 드롭다운 트리거는 `aria-haspopup`,
  breadcrumb 현재 위치는 `aria-current="page"`. plan에 계획이 있으면 그대로, 없으면 §2-4 표 기본값을 따른다.

## 5. 노드/레이아웃 → JSX
plan-rules §2 매핑을 코드로 구현한다.
- `frame`/`group` → flex 컨테이너. `layout: column`→`flex-col`, `row`→`flex-row`, `wrap`→`flex flex-wrap`,
  `gap`→`gap-*`, `padding`→`p*`, `primaryAxisAlign`/`counterAxisAlign`→`justify-*`/`items-*`, `style`(background/radius/shadow)→클래스.
- `text` → 텍스트 요소. `content`를 그대로 넣고 `style.token`(타이포)·`style.color`를 클래스로.
  `runs[]`가 있으면 run별 `<span>`으로 분할해 서식(굵기 등)을 구현. `style.role: "link"`면 `<a>`.
  단 **`content`가 이모지 글리프뿐인 text 노드는 텍스트가 아니라 이미지로 렌더**한다(§6-1, plan-rules §2-3).
- `image`/`vector` + `ref` → `assets[]`에서 배치한 파일을 import 해 `<img>`로. 크기는 bbox의 w/h 참조.
- `line` → 부모의 `border-*` 또는 `<hr>`. `shape`/`ellipse` → 스타일된 `div`(ellipse는 `rounded-full`).
- `bbox`는 **참조값**이다. 절대좌표(`position: absolute`, `top/left`)로 옮기지 말고 부모 흐름 레이아웃으로 구현한다.
  단 폭 등 명시가 필요한 값(카드 400px 등)은 클래스로 지정한다.
- **bbox 잔차 처리(결정 절차)**: 기준 간격은 ① 선언된 `layout.gap`, ② 없으면 자식 bbox 간격의 **최빈값**이다.
  단 선언 gap과 다른 bbox 간격이 **과반**이면 최빈값으로 gap을 재판정하고 plan ⚠에 기록한다.
  기준 대비 ±1px 잔차는 보정하지 않는다(`ml-px` 같은 보정 마진 금지 — 재실행마다 유무가 갈리는 확률 지점).
  2px 이상 벗어나는 소수 항목만 명시적 마진 **1개**로 구현한다.
- **크기 표현 결정**: `layout.sizing`이 `fixed`인 축은 bbox 크기를 클래스로 고정(`h-10`, `w-[280px]`)하고,
  `hug`인 축은 크기를 명시하지 않고 padding·콘텐츠에서 파생시킨다(예: Button 56 = vertical hug → `py-3.5`).
  **sizing이 없으면** 순서대로 판정한다: ① `wrap` 컨테이너의 자식이면 bbox 폭 고정(그리드 성립 조건),
  ② 자식 bbox 합 + padding이 노드 bbox를 ±1px 내로 설명하면 hug 취급(파생),
  ③ 그 외(잎 노드, 자식 합보다 큰 컨테이너)는 fixed 취급(bbox 고정).
- `image`/`vector` 크기는 `width`/`height` HTML 속성이 아니라 **클래스**(`h-7 w-7` — §4-1 스케일 적용)로 지정한다.
- **텍스트 오버플로는 실제로 넘칠 때만**: 콘텐츠가 bbox 높이를 넘치는 텍스트(content 길이·폭으로 명백하거나
  스크린샷에 말줄임이 보이는 경우)에만 적용한다 — bbox h가 lineHeight×N이면 `line-clamp-N`,
  정수배가 아니면 h 고정 + `overflow-hidden`. **넘치지 않는 텍스트에는 높이도 클램프도 지정하지 않는다.**
- 브릿지에 없는 텍스트/노드를 발명하지 않는다. suggestedProps와 노드 `content`가 불일치하면
  **노드 content가 진실**이며, 파생 로직(접미사 조합 등)이 필요하면 plan ⚠에 근거를 남긴 경우에만 구현한다.
- **일러스트 절대배치 서브트리의 형제 배치는 절대좌표**: plan이 "일러스트 절대배치"로 판정한 서브트리에서
  **직계 형제들의 상호 배치**는 전부 bbox 좌표로 구현한다(형제 일부만 flow로 묶지 않는다).
  단 자식 노드가 자체 `layout`(mode row/column 등)을 선언한 컨테이너면 **그 내부**는 선언 layout대로 구현한다.
  자식이 재사용 컴포넌트 인스턴스면 위치 클래스를 passthrough로 전달한다(§7-1).
  예외는 plan이 스크린샷 모순(⚠)으로 재배치를 명시한 노드뿐이고, 그 좌표도 plan에 적힌 값을 그대로 쓴다.
- 예외: plan이 "일러스트 절대배치"로 명시한 영역(plan-rules §2-1)은 relative 컨테이너 + absolute 자식으로
  bbox 좌표를 그대로 구현한다. semanticRole이 있으면 시맨틱 태그로 구현한다(plan-rules §2-2).

## 6. 에셋 배치
- 브릿지 `assets[]`의 export 파일(`.ddalkak/assets/<name>/...`)을 plan이 지정한 프로젝트 경로(기본 `src/assets/<name>/`)로 복사·배치하고,
  이를 사용하는 컴포넌트에서 import 한다.
- `kind: "screenshot"` 에셋은 verify 전용 — 프로젝트로 복사하지 않는다.

### 6-1. 이모지 글리프 에셋 (emoji-extract)
`content`가 이모지 글리프뿐인 text 노드(plan-rules §2-3)는 텍스트로 렌더하면 브라우저·OS마다 시스템 이모지로
폴백돼 디자인과 다르게, 환경마다도 다르게 그려진다. 벡터 이모지 세트(SVG)로 고정해 `<img>`로 렌더한다 —
벡터라 모든 해상도에서 선명하고 배경이 투명하다.
- **생성**: `node ${CLAUDE_PLUGIN_ROOT}/scripts/emoji-extract.mjs --project <p> --name <name> [--set twemoji]`.
  이 스크립트는 이모지 노드를 찾아 코드포인트별 SVG를 공개 세트(기본 Twemoji, `--set noto` 등)에서 받아
  `.ddalkak/assets/<name>/`와 `src/assets/<name>/`에 함께 쓰고, bridge `assets[]`에 `kind: "vector"`로 등록하며
  노드에 `ref`를 단다. code는 그 SVG 경로를 import 해 `<img src>`로 렌더한다.
- **크기**: 컴포넌트에서 leaf bbox의 w/h를 클래스로 준다(§4-1 스케일). 같은 이모지가 여러 크기로 쓰이면 SVG 하나를
  크기만 달리해 재사용한다(벡터라 무손실).
- **컴포넌트 API**: 이모지를 받는 컴포넌트는 텍스트가 아니라 이미지 src prop(예: `emojiSrc`)으로 받는다(§7-1 passthrough와 별개의 의미 값).
- **verify 한계**: 세트 글리프는 Figma가 쓴 이모지와 모양이 완전히 같지 않아 이모지 영역 픽셀 불일치는 남는다.
  이는 Figma↔브라우저 래스터의 본질적 차이라 code로 못 없앤다 — fix 모드로 되돌릴 대상이 아니며, 게이트를
  콘텐츠 인지형으로 다루는 검증쪽 몫이다(§10-2 폴백 매칭 제외와 같은 맥락).

## 7. 컴포넌트 작성 규칙 (design.md 4장 기본 베이스 — 예시는 React, 다른 스택은 §8 대응표로 치환)
- props는 `interface <Component>Props`로 명시. `any` 금지.
- 컴포넌트 폴더에 index re-export를 둔다. 모듈 경로는 스택 확장자 규칙을 따른다
  (React: `export { default } from "./<Component>"`, Vue: `"./<Component>.vue"` — 확장자 명시).
- 컴포넌트 파일은 PascalCase.tsx(스택 관용 확장자), 그 외 파일은 kebab-case. 페이지는 screen name → PascalCase.
- **신규 컴포넌트는 루트 요소에 스타일 passthrough를 지원**한다
  (React: `className` 병합, Vue: 단일 루트 유지 또는 `inheritAttrs: false` + `v-bind="$attrs"` 명시).
- design.md가 다른 규칙을 정의하면 그쪽이 우선한다.

### 7-1. 컴포넌트 API 규약 (재실행 결정론)
- **단일 텍스트 `content`는 기본 콘텐츠 슬롯**(React `children` / Vue 기본 `<slot>`)으로 받는다 —
  `label` 같은 별도 텍스트 prop을 만들지 않는다.
  텍스트 슬롯이 여러 개면 브릿지 노드 이름을 딴 명명 props(`heading`, `subtitle` 등)로 받는다.
- **props 필수/선택 판별 기준은 브릿지다**: 화면의 모든 인스턴스의 `componentProps`/`suggestedProps`에
  키가 존재하는 prop은 **필수로 선언하고 기본값을 주지 않으며**, 호출부는 boolean `false`를 포함해 항상 명시 전달한다.
  키가 없는 인스턴스가 존재하는 prop만 optional(`?`). plan이 ⚠로 명시한 파생 prop도 같은 기준.
  (단 §3 "수정" 케이스의 하위호환 기본값은 예외 — 기존 사용처 보호가 우선.)
- 인스턴스별로 다른 배치 값(폭·절대 위치 등)과 **raw 스타일 값**(토큰이 아닌 배경 알파 등)은
  새 prop을 만들지 말고 **스타일 passthrough 채널**(React `className` / Vue class fallthrough)로 전달하며,
  래퍼 `div`로 감싸지 않는다. 명명 prop은 브릿지 props에서 온 **의미 값**에만 쓴다.
  **래퍼 허용 예외 2가지**: ① 반응형 표시 분기(`hidden lg:block`)처럼 display 유틸이 컴포넌트 루트 클래스와
  충돌하는 경우, ② passthrough를 지원하지 않는 기존(수정 범위 밖) 컴포넌트를 배치하는 경우.
- **상호작용 컴포넌트는 네이티브 요소 속성을 passthrough 한다(§2-4).** 루트가 `<button>`/`<a>`/`<input>`이면
  props를 그 요소의 HTML 속성 타입에서 확장하고(`ButtonHTMLAttributes`/`AnchorHTMLAttributes`/`InputHTMLAttributes`)
  `...rest`로 흘린다 — `onClick`/`href`/`type`/`value`/`disabled` 등을 개별 명명 prop으로 발명하지 않는다.
  명명 prop은 브릿지 props에서 온 의미 값(`variant`, `label` 등)에만 쓴다.
- 주석은 plan의 ⚠ 항목·절대배치 근거를 인용할 때만 남긴다(그 외 서술 주석 금지).

## 8. 프레임워크 분기
- 기본 타깃은 React 웹. design.md의 "기술 스택"이 다른 것(Vue/Svelte/RN/Flutter 등)을 지정하면 그 스택의 관용 패턴으로 생성한다:
  컴포넌트 단위·스타일 적용 방식·파일 확장자·라우팅을 해당 스택에 맞춘다.
  design.md가 없으면 package.json 의존성으로 스택을 먼저 판별한다(`vue` 존재 → Vue, `pubspec.yaml`에 `flutter` → Flutter 등).
  Vue/Svelte/RN처럼 DOM 계열은 아래 치환표로 충분하지만, **Flutter는 웹과 근본이 달라 §8-1에서 별도로 다룬다.**
- **스택별 관용 대응(결정론)**: 이 문서의 React 용어는 다음으로 치환한다 —
  index re-export 경로(Vue는 `.vue` 확장자 명시), 콘텐츠 슬롯(`children`↔`<slot>`),
  스타일 passthrough(`className`↔class fallthrough), 조건부 클래스 표기(§4-1), 타입 체크 도구(`tsc`↔`vue-tsc`).
  `content` 텍스트의 템플릿 특수문자는 스택별로 이스케이프한다(JSX `{`, Vue `{{`).
- Tailwind 토큰 등록 시 `content` glob이 스택 확장자(`.vue` 등)를 포함하는지 확인한다 —
  누락되면 빌드는 통과하고 CSS만 조용히 비는 실패가 된다.

### 8-1. Flutter (네이티브 위젯 — 웹 어휘 대응)
Flutter는 웹이 아니다 — `className`·CSS·Tailwind·DOM·JSX가 없다. 이 문서의 웹 용어를 다음으로 치환한다(프로젝트별 구조·컨벤션은 언제나 design.md가 우선).
- **컴포넌트 = Widget 클래스**: 기본 `StatelessWidget`, 상태가 필요할 때만 `StatefulWidget`. 파일은 `snake_case.dart`(한 파일 1위젯), 클래스명은 PascalCase, 페이지는 screen name → PascalCase 위젯. `.tsx` PascalCase 파일 규칙(§7)은 여기서 `snake_case.dart`로 치환된다.
- **props = 생성자 named 파라미터**: `const Foo({super.key, required this.title, this.subtitle});`. 필수/선택 판별은 §7-1 그대로(브릿지 기준) — 필수는 `required`, 선택만 nullable/기본값.
- **콘텐츠 슬롯**: 단일 텍스트 `content`는 `String` 파라미터로, 자식 위젯은 `Widget child`/`List<Widget> children`로 받는다(React `children`↔Vue `<slot>`의 Flutter판). 별도 텍스트 prop을 발명하지 않는다(§7-1).
- **스타일 = 위젯 속성**: `className` 대신 `TextStyle`·`BoxDecoration`·위젯 속성으로 적용한다. 토큰은 design.md가 정한 방식(테마 상수/`ThemeData`/`Theme.of(context)`/디자인시스템)으로 참조하고, 없으면 Dart 상수로. 조건부 스타일은 build 내 삼항·분기로(§4-1 결정론 — 같은 토큰은 항상 같은 상수/스타일).
- **명시값 우선(§4-2)**: bbox·간격·radius는 브릿지 수치를 논리 픽셀로 그대로 쓴다. 관습("아바타니까 원형")으로 근사·대체 금지.
- **레이아웃(§5 대응)**: auto-layout → `Row`/`Column`(+`MainAxisAlignment`/`CrossAxisAlignment`), gap → `SizedBox`(또는 `spacing`), padding → `Padding`+`EdgeInsets`, 절대배치 → `Stack`+`Positioned`.
- **passthrough**: 루트에 `super.key`를 받고 인스턴스별 배치값은 명명 파라미터나 부모 레이아웃 위젯으로 전달한다. 웹의 임의 className 병합은 없으니 래퍼 위젯 남발 금지(§7-1 정신).
- **텍스트 이스케이프**: Dart 문자열 리터럴의 `$`·`${...}`는 `\$`로 이스케이프한다(§8 "템플릿 특수문자"의 Flutter판).
- **타입/정적 게이트(§9)**: `tsc`/`vue-tsc` 대신 **`fvm flutter analyze`**(fvm 없으면 `flutter analyze`)가 필수 게이트다. Tailwind glob 규칙은 해당 없음.
- **verify 진입점(필수)**: verify가 로그인·권한·라우팅을 우회해 대상 화면에 바로 도달하도록 code가 검수용 진입점을 함께 낸다 — deep link `ddalkak://preview?screen=<name>` 또는 프리뷰 route/위젯(`?screen=<name>`으로 화면 선택). 없으면 verify는 pass/fail이 아니라 blocked다(`docs/platform-verify.md`).
- **verify 런타임(§9 dev 렌더의 Flutter판)**: 웹 dev 서버 대신 Flutter Web을 `fvm flutter run -d web-server`로 띄워 그 URL을 verify에 넘긴다. verify는 canvas라 DOM 없이 픽셀로만 판정한다(style은 `n/a`).

## 9. 빌드 검증 & 생성 후 보고
- **타입 체크가 필수 게이트다.** 구현을 마치면 반드시 타입 체크를 실행한다
  (프로젝트의 `tsc`/`vue-tsc` 단계 — `tsc --noEmit`, project references면 `tsc -b`, Vue는 `vue-tsc --noEmit`).
  실패하면 원인을 수정하고 재시도한다(최대 3회). 3회 후에도 실패하면 실패 상태와 원인을 그대로 보고한다
  — 통과한 척 넘어가지 않는다.
- **반복 게이트에서 full 프로덕션 빌드(번들링)는 생략한다.** verify(4단계)는 **dev 서버**(`localhost:5173`)를
  캡처하지 프로덕션 번들 산출물을 쓰지 않으므로, 타입 체크 통과 + dev 렌더 확인으로 다음 단계(verify)로 넘어간다.
  `vite build` 같은 번들링은 매 라운드 돌리지 않는다(fix 수렴 루프에서 라운드마다 반복되면 낭비).
  번들 전용 설정 등 **프로덕션 빌드에서만 드러나는 오류**가 우려되는 프로젝트에서만 파이프라인 종료 직전 full build를 1회 확인한다.
- **정적 게이트(verify 앞단, 저비용)**: 타입 체크 통과 후 `node ${CLAUDE_PLUGIN_ROOT}/scripts/validate-code.mjs <plan.md>`를
  실행한다(plan 단계의 validate-plan.mjs와 대칭 — LLM 없이 결정론적으로 plan↔code 드리프트를 잡아 무거운 verify 앞에서 거른다).
  - error(파일 계획의 신규/수정 파일 부재)는 고쳐서 재실행한다 — 남긴 채 verify로 넘어가지 않는다.
  - warning(코드의 arbitrary 시각값이 plan에 없음 = §4 즉석 환산 신호)은 `.ddalkak/reports/<name>.code-gaps.json`으로 떨어진다.
    이 목록이 §4 완결성 피드백의 기계 판이며, 다음 plan 재실행 때 토큰/좌표 표로 흡수한다(§11 plan 완결성 레버).
- 이후 사용자에게 요약한다:
  - 생성/수정한 파일 목록(경로 + 신규·수정)과 빌드 결과.
  - 검증 보조 정보: plan 표에 없어 §4-1로 즉석 환산한 값이 있으면 그 목록
    (§4 완결성 피드백 — 다음 재실행 때 plan 표로 흡수).
  - plan 대비 벗어난 점이 있으면 그 사유(예: 기존 파일과 충돌해 통합).
  - 렌더 확인 방법 안내(예: `npm run dev`).
  - 다음 단계는 verify(code ↔ figma 대조)임을 안내.

## 10. fix 모드 — verify 리포트로 짚어진 곳만 고친다
verify(4단계)가 불일치를 찾으면, code는 **새로 설계하지 않고** 그 리포트가 속성 단위로 짚은 지점만
규칙대로 되돌린다. "AI가 어긴 규칙(§4·§4-1·§4-2)을 규칙대로 다시" 하는 것이지 재판단이 아니다.
전체 재생성 금지(§2)는 fix 모드에서 더 엄격히 적용된다.

### 10-1. 입력 — verify 산출물
- verify 리포트(`.ddalkak/reports/<name>.*`, breakpoint별 파일 — 반응형은 각각 처리)의 위반 항목을 읽는다.
- 위반으로 표기된 항목이 수정 대상 후보다. 각 항목은 "어느 노드의 어느 속성이 기대 X인데 실제 Y"이며
  `{ kind, expected, actual, delta, severity }`와 고칠 지점을 가리키는 **소스 위치**(§10-2)를 담는다.
- `expected`/`actual`는 해석된 실측 단위다(px·rgb). `expected`가 **되돌릴 목표값**이다 — 여기서 새 값을 지어내지 않는다.

### 10-2. 위치 특정 — 위반 항목 → 소스 요소 (verify가 짚은 소스 위치로 확정)
verify는 각 위반 항목에 **소스 위치**(`파일:줄:칼럼`)를 붙인다. 검증 빌드에서 렌더 요소마다 그 요소를 만든
JSX의 AST 위치가 주입되므로, 리포트가 노드 경로가 아니라 고칠 소스 지점을 직접 가리킨다. 이 위치는 렌더·파서에서
기계적으로 얻는 값이지 생성자가 부착하는 앵커가 아니라서, 코드가 틀려도 위치가 함께 무너지지 않는다.
- 항목에 소스 위치가 있으면 → 그 `파일:줄`의 요소를 특정해 고친다(신뢰도 high).
- 소스 위치가 없으면(verify가 요소를 유도·특정하지 못한 미유도 컨테이너·단서 없는 리프 등)
  → **자동 수정에서 제외**하고 사람에게 보고한다(오수정 위험).

### 10-3. kind별 수정 액션 (짚어진 속성 1개만 교체)
- `radius` → §4-1 표기 규약대로 `expected`에 해당하는 클래스로 교체(pill 판정 포함).
- `fill.color`/`text.color`/`stroke.color`/`run.color:*` → §4대로 등록 토큰 클래스 또는 원문 hex로 교체.
- `font.size`/`font.weight`/`font.lineHeight`/`run.font.*` → 토큰 fontSize/weight 또는 §4-1 표기로 교체.
- `stroke.width` → §4-1 스케일/임의값 규약대로 border 폭 클래스로 교체.
- `geometry.x/y/width/height` → 절대좌표로 박지 않는다. 원인(부모 `gap`/`padding`/`sizing`·§5 bbox 잔차)을 되짚어
  **명시값(§4-2)** 기준으로 복원한다. 폭·높이 고정 누락이면 §5 크기 표현대로 클래스를 준다.
  원인이 불명확하면(레이아웃 구조 자체 문제) 자동 수정하지 말고 사람에게 보고한다.
- `match`/`run.match`(warn) → verify가 요소를 유도·매칭하지 못한 경우(미유도 컨테이너·단서 없는 리프). code로 되돌릴 대상이 아니라 보고한다.

### 10-4. 안전장치 & 수렴
- **범위**: 짚어진 요소만, plan "파일 계획" 범위 내 파일만 수정한다. 표에 없는 파일·짚이지 않은 요소는 건드리지 않는다.
- **재빌드/재검증**: 패치 후 빌드(§9) → verify를 다시 돌려 해당 항목이 해소됐는지 확인한다.
- **수렴/중단**: 재검증에서 통과면 종료. 같은 항목이 **개선(`delta` 감소) 없이 2회 연속 실패**하면 중단하고
  사람에게 보고한다(무한 루프·발산 방지). 상한은 기본 3회.
- **자동 적용 기준(기본값)**: `status: "fail"` + 소스 위치가 특정된 항목만 자동 수정한다(§10-2).
  warn·advisory·소스 위치 없는 항목은 보고만 하고 손대지 않는다(사람 확인). 이 임계값은 프로젝트에서 조정 가능하다.
- **결정론**: 같은 verify 입력 → 같은 패치. `expected`를 목표로 §4-1 규약을 그대로 적용하므로 재실행에 안정적이다.

### 10-5. fix 후 보고
- 고친 항목(`id`/`kind`/`expected`→적용값)과 수정 파일, 재검증 결과.
- 자동 수정에서 **제외한 항목**과 사유(저신뢰 매칭·구조 문제 등) — 사람이 판단할 목록.
- 수렴 못 하고 중단했으면 남은 실패 항목과 마지막 `delta`.

## 11. 실행 모델 — 단일 컨텍스트 순차 생성 (실측 근거)
생성 모드는 **한 컨텍스트에서 순차로** 파일을 만든다. 잎 컴포넌트를 서브에이전트로 병렬 fan-out하는 방식을
pc-home(잎 5 + 조립 1)에서 실측한 결과 **더 느렸다**(순차 단일 컨텍스트 ~9분 → 병렬 fan-out ~22분).
원인은 세 가지이며, 다음 재설계 때 이 함정을 피한다.
- **병목은 잎이 아니라 페이지 조립(Phase C)이다.** 잎 생성은 조립에 비해 짧고, 조립은 절대배치·
  좌우 배치를 화면 전체 맥락에서 한 번에 풀어야 해서 본질적으로 순차다. 잎을 병렬화해도 병목이 그대로 남는다.
- **서브에이전트마다 컨텍스트를 다시 로드한다.** 각자 plan·code-rules·브릿지(수십 KB)를 콜드로 다시 읽어,
  단일 컨텍스트가 한 번만 치르는 읽기 비용을 N번 중복 지불한다. 이 오버헤드가 병렬 이득을 넘어선다.
- **격리된 에이전트는 서로 다른 선택을 한다.** 네이밍·주석·속성 순서·prop 타입·레이아웃 표현(`justify-between`↔`gap-[Npx]`)
  등 §4-1이 고정하지 않는 자유도에서 에이전트별로 갈려 재실행 결정론이 **더** 나빠진다(병렬화가 통일이 아니라 분산을 낳음).

따라서 시간 개선의 실효 레버는 fan-out이 아니라 다음이다.
- **plan 완결성**(plan 단계): code가 브릿지를 다시 열게 만드는 값(버튼 라벨 폰트·카드 내부 좌표·패널 폭·그림자 등,
  §4 완결성 피드백으로 반복 관측되는 항목)을 plan 표로 흡수한다. 그러면 code는 §1.3의 브릿지 재열람을 건너뛰어
  컨텍스트 로드가 줄고, 조립도 표 복사에 가까워져 빨라지며 결정론도 함께 오른다.
- **빌드 게이트 경량화**(§9): 반복 게이트에서 full 프로덕션 빌드를 생략(타입 체크만)해 fix 수렴 루프의 라운드 비용을 줄인다.
