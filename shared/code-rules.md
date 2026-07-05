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

## 3. 컴포넌트 재사용(import) vs 신규 생성
- plan이 "재사용"으로 표기했거나 대상 경로(`mappedCodeComponent`)에 컴포넌트가 **이미 존재**하면 → 새로 만들지 말고 import한다.
- plan이 "신규"로 표기한 컴포넌트만 그 경로에 작성한다. `mappedCodeComponent`가 있어도 그 파일이 없으면 신규 생성이 정상이다(그린필드).
- 이미 존재하는 파일은 덮어쓰지 말고 재사용한다.

## 4. 토큰 → 스타일 매핑
- plan의 "디자인 토큰 매핑" 표를 그대로 구현한다.
  - Tailwind 베이스: color/type 토큰을 `tailwind.config.js` `theme.extend`(colors/fontSize)에 등록한 뒤
    유틸 클래스(`bg-primary`, `text-heading-lg`)로 사용. spacing은 기본 스케일 또는 px 임의값(`gap-[24px]`).
  - 다른 스택이면 design.md가 지정한 방식(CSS 변수/테마 객체)으로 등록·참조.
- 브릿지 노드 `style`에 raw 값으로 남은 일회성 값은 해당 요소에만 인라인/임의값으로 적용하고 토큰으로 승격하지 않는다.

## 5. 노드/레이아웃 → JSX
plan-rules §2 매핑을 코드로 구현한다.
- `group` → flex 컨테이너. `layout: column`→`flex-col`, `row`→`flex-row`, `gap`→`gap-*`, `style`(background/padding/radius/shadow)→클래스.
- `text` → 텍스트 요소. `content`를 그대로 넣고 `style.token`(타이포)·`style.color`를 클래스로. `style.role: "link"`면 `<a>`.
- `image` + `ref` → `assets[]`에서 배치한 파일을 import 해 `<img>`로. 크기는 bbox의 w/h 참조.
- `bbox`는 **참조값**이다. 절대좌표(`position: absolute`, `top/left`)로 옮기지 말고 부모 흐름 레이아웃으로 구현한다.
  단 폭 등 명시가 필요한 값(카드 400px 등)은 클래스로 지정한다.

## 6. 에셋 배치
- 브릿지 `assets[]`의 export 파일(`.ddalkak/assets/<name>/...`)을 plan이 지정한 프로젝트 경로(기본 `src/assets/<name>/`)로 복사·배치하고,
  이를 사용하는 컴포넌트에서 import 한다.

## 7. 컴포넌트 작성 규칙 (design.md 4장 기본 베이스)
- props는 `interface <Component>Props`로 명시. `any` 금지.
- 컴포넌트 폴더에 `index.ts` re-export를 둔다(`export { default } from "./<Component>"`).
- 컴포넌트 파일은 PascalCase.tsx, 그 외 파일은 kebab-case. 페이지는 screen name → PascalCase.
- design.md가 다른 규칙을 정의하면 그쪽이 우선한다.

## 8. 프레임워크 분기
- 기본 타깃은 React 웹. design.md의 "기술 스택"이 다른 것(Vue/Svelte/RN/Flutter 등)을 지정하면 그 스택의 관용 패턴으로 생성한다:
  컴포넌트 단위·스타일 적용 방식·파일 확장자·라우팅을 해당 스택에 맞춘다.
- 어느 스택이든 공통 원칙은 동일: plan 파일 계획 준수, 토큰 매핑 구현, 재사용 우선, 범위 제한.

## 9. 생성 후 보고
구현을 마치면 사용자에게 요약한다:
- 생성/수정한 파일 목록(경로 + 신규·수정).
- plan 대비 벗어난 점이 있으면 그 사유(예: 기존 파일과 충돌해 통합).
- 렌더/빌드 확인 방법 안내(예: `npm run dev`). 가능하면 타입 체크·빌드가 통과하는지 확인해 결과를 함께 보고한다.
- 다음 단계는 verify(code ↔ figma 대조)임을 안내.
