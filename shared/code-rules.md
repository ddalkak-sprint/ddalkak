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
- **수치는 절대 근사하지 않는다.** 브릿지의 px 값이 Tailwind 기본 스케일과 **정확히 일치할 때만**
  스케일 클래스(48px→`h-12`, 24px→`gap-6`)를 쓰고, 일치하지 않으면 반드시 임의값(`gap-[30px]`, `w-[205px]`)으로 구현한다.
  스펙에 없는 "가까운 값"으로 옮기는 것이 verify 불일치의 주요 원인이다.
- 브릿지 노드 `style`에 raw 값으로 남은 일회성 값은 해당 요소에만 인라인/임의값으로 적용하고 토큰으로 승격하지 않는다.
  단 raw 값이 등록된 토큰과 동일값이면 토큰 클래스를 쓴다.

### 4-1. 표기 규약 — 같은 값은 항상 같은 클래스로 (재실행 결정론)
같은 스타일을 두 가지 이상으로 쓸 수 있으면 아래 규약으로 **하나로 고정**한다.
재실행 때 산출물이 표기 수준에서 달라지는 것을 막기 위한 규칙이므로 예외를 두지 않는다.
- **스케일 정확 일치 시 스케일 클래스 의무** — 임의값 표기(`rounded-[6px]` 등) 금지. 대응표:
  - spacing(px→클래스 값): 2→`0.5` 4→`1` 6→`1.5` 8→`2` 10→`2.5` 12→`3` 14→`3.5` 16→`4` 20→`5` 24→`6`
    28→`7` 32→`8` 36→`9` 40→`10` 44→`11` 48→`12` 56→`14` 64→`16` (그 외 px는 임의값 `[Npx]`)
  - radius(px→클래스): 2→`rounded-sm` 4→`rounded` 6→`rounded-md` 8→`rounded-lg` 12→`rounded-xl`
    16→`rounded-2xl` 24→`rounded-3xl` (그 외 px는 `rounded-[Npx]`)
- **임의값 표기 형식**: 길이는 `[Npx]`(px 단위 명시), 알파(불투명도)는 5% 단위면 스케일(`/40`),
  아니면 leading zero 소수(`/[0.54]` — `.54`·`54%` 표기 금지). 색상 hex는 브릿지 원문 그대로(대문자).
- **간격 1곳 = 속성 1개**: 하나의 간격을 마진+패딩 조합이나 음수 마진 상쇄(`mt-[-6px] pt-[24px]`)로
  표현하지 않는다 — 단일 속성(`mt-[18px]`)으로 쓴다. 음수 마진은 일러스트 절대배치 안에서만 허용.
- 프로젝트에 prettier 등 포매터 설정이 있으면 생성/수정한 파일에 실행해
  클래스 정렬·줄바꿈까지 고정한다(§9 빌드 전에 수행).

## 5. 노드/레이아웃 → JSX
plan-rules §2 매핑을 코드로 구현한다.
- `frame`/`group` → flex 컨테이너. `layout: column`→`flex-col`, `row`→`flex-row`, `wrap`→`flex flex-wrap`,
  `gap`→`gap-*`, `padding`→`p*`, `primaryAxisAlign`/`counterAxisAlign`→`justify-*`/`items-*`, `style`(background/radius/shadow)→클래스.
- `text` → 텍스트 요소. `content`를 그대로 넣고 `style.token`(타이포)·`style.color`를 클래스로.
  `runs[]`가 있으면 run별 `<span>`으로 분할해 서식(굵기 등)을 구현. `style.role: "link"`면 `<a>`.
- `image`/`vector` + `ref` → `assets[]`에서 배치한 파일을 import 해 `<img>`로. 크기는 bbox의 w/h 참조.
- `line` → 부모의 `border-*` 또는 `<hr>`. `shape`/`ellipse` → 스타일된 `div`(ellipse는 `rounded-full`).
- `bbox`는 **참조값**이다. 절대좌표(`position: absolute`, `top/left`)로 옮기지 말고 부모 흐름 레이아웃으로 구현한다.
  단 폭 등 명시가 필요한 값(카드 400px 등)은 클래스로 지정한다.
- **bbox 잔차 ±1px 무시**: 부모 padding/gap을 자식 bbox들의 최솟값 기준으로 정한 뒤 남는 1px 이하 차이는
  보정하지 않는다(`ml-px` 같은 보정 마진 금지 — 재실행마다 유무가 갈리는 확률 지점이다).
  2px 이상 차이만 명시적 마진 **1개**로 구현한다.
- 예외: plan이 "일러스트 절대배치"로 명시한 영역(plan-rules §2-1)은 relative 컨테이너 + absolute 자식으로
  bbox 좌표를 그대로 구현한다. semanticRole이 있으면 시맨틱 태그로 구현한다(plan-rules §2-2).

## 6. 에셋 배치
- 브릿지 `assets[]`의 export 파일(`.ddalkak/assets/<name>/...`)을 plan이 지정한 프로젝트 경로(기본 `src/assets/<name>/`)로 복사·배치하고,
  이를 사용하는 컴포넌트에서 import 한다.
- `kind: "screenshot"` 에셋은 verify 전용 — 프로젝트로 복사하지 않는다.

## 7. 컴포넌트 작성 규칙 (design.md 4장 기본 베이스)
- props는 `interface <Component>Props`로 명시. `any` 금지.
- 컴포넌트 폴더에 `index.ts` re-export를 둔다(`export { default } from "./<Component>"`).
- 컴포넌트 파일은 PascalCase.tsx, 그 외 파일은 kebab-case. 페이지는 screen name → PascalCase.
- design.md가 다른 규칙을 정의하면 그쪽이 우선한다.

### 7-1. 컴포넌트 API 규약 (재실행 결정론)
- **단일 텍스트 `content`는 `children`으로** 받는다 — `label` 같은 별도 텍스트 prop을 만들지 않는다.
  텍스트 슬롯이 여러 개면 브릿지 노드 이름을 딴 명명 props(`heading`, `subtitle` 등)로 받는다.
- **props 필수/선택 판별**: 화면의 모든 인스턴스가 값을 명시하는 prop은 **필수로 선언하고 기본값을 주지 않는다**.
  값이 없는 인스턴스가 존재하는 prop만 optional(`?`)로 선언한다. plan이 ⚠로 명시한 파생 prop도 같은 기준.
  (단 §3 "수정" 케이스의 하위호환 기본값은 예외 — 기존 사용처 보호가 우선.)
- 인스턴스별로 다른 배치 값(폭 등)은 컴포넌트에 새 prop을 만들지 말고 `className` passthrough로 전달한다.
- 주석은 plan의 ⚠ 항목·절대배치 근거를 인용할 때만 남긴다(그 외 서술 주석 금지).

## 8. 프레임워크 분기
- 기본 타깃은 React 웹. design.md의 "기술 스택"이 다른 것(Vue/Svelte/RN/Flutter 등)을 지정하면 그 스택의 관용 패턴으로 생성한다:
  컴포넌트 단위·스타일 적용 방식·파일 확장자·라우팅을 해당 스택에 맞춘다.
- 어느 스택이든 공통 원칙은 동일: plan 파일 계획 준수, 토큰 매핑 구현, 재사용 우선, 범위 제한.

## 9. 빌드 검증 & 생성 후 보고
- **타입 체크·빌드는 필수다.** 구현을 마치면 반드시 빌드(예: `npm run build`)를 실행한다.
  실패하면 원인을 수정하고 재시도한다(최대 3회). 3회 후에도 실패하면 실패 상태와 원인을 그대로 보고한다
  — 통과한 척 넘어가지 않는다.
- 이후 사용자에게 요약한다:
  - 생성/수정한 파일 목록(경로 + 신규·수정)과 빌드 결과.
  - plan 대비 벗어난 점이 있으면 그 사유(예: 기존 파일과 충돌해 통합).
  - 렌더 확인 방법 안내(예: `npm run dev`).
  - 다음 단계는 verify(code ↔ figma 대조)임을 안내.
