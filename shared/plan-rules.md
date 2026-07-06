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
- **스크린샷 교차검증**: bbox 배치가 스크린샷(`screens[].screenshot` export)과 모순되면
  **스크린샷이 진실이다** — 스크린샷 기준으로 계획하고, 모순 내용을 plan "가정 및 미해결"에 기록해
  브릿지 담당에게 전달한다. (예: bbox상 겹치는 카드들이 스크린샷에선 나란히 배열)

### 2-2. v2.1 의미 필드 소비 (semanticRole / suggestedComponent)
- `suggestedComponent`가 있으면 **그 이름·단위로 컴포넌트를 분해하는 것이 기본값**이다.
  같은 `suggestedComponent`끼리는 §6으로 축약하고, `suggestedProps`를 props 초안으로 승계한다.
  제안과 다르게 분해할 때는 사유를 plan에 명시한다.
- `semanticRole`은 시맨틱 태그·역할 힌트로 반영한다:
  `nav`→`<header>`/`<nav>`, `card`→`<article>` 등 시맨틱 요소, `cta-button`→주요 CTA,
  `badge`→라벨 요소, `card-list`→목록 컨테이너, `avatar`→인물 이미지(alt 계획).
  역할이 명확한 노드는 컴포넌트 이름과 태그 선택에 이 힌트를 우선 사용한다.

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
  이때 필수/선택을 함께 표기한다 — 모든 인스턴스가 값을 명시하면 필수(기본값 없음), 값이 없는 인스턴스가
  있으면 optional (code-rules §7-1과 동일 기준). 단일 텍스트 `content`는 prop이 아니라 children으로 계획한다.
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
- 브릿지에서 토큰화되지 않고 노드 `style`에 raw 값으로 남은 것(figma-extraction-rules §4)은
  해당 노드에 **일회성 값**으로 계획하고, 토큰 표에는 넣지 않는다.
  단 raw 값이 **기존/등록 예정 토큰과 동일값**이면 raw 대신 그 토큰 클래스를 쓰도록 계획한다.

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
- 없으면 프로젝트의 기존 패턴을 추론하고, 그것도 불분명하면 기본 베이스(React 18 + TS + Tailwind)로 계획하되
  "design.md 없음 — 기본 베이스 가정" 을 개요에 명시한다.

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
- **구현 순서** — §7.
- **가정 및 미해결** (조건부) — 규칙으로 결정할 수 없어 판단으로 메운 항목이 있으면
  ⚠ 표시와 함께 말미에 목록으로 남긴다. 없으면 섹션 생략. (게이트에서 사용자가 이 부분을 중점 검토한다.)

작성 예시(로그인 화면 기준)는 `${CLAUDE_PLUGIN_ROOT}/shared/examples/login-page.plan.md`.
