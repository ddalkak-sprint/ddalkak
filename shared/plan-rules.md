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

## 2. 노드 타입 → 코드 타깃 매핑
브릿지 노드 트리를 순회하며 각 노드를 아래 표대로 코드 산출물에 대응시킨다.

| 브릿지 노드 | 코드 타깃 | 비고 |
|-------------|-----------|------|
| `type: component` | 재사용 컴포넌트 (import 또는 신규) | §3으로 재사용/신규 판별 |
| `type: group` | 레이아웃 JSX (flex 컨테이너) | `layout`(row/column)+`gap`+`style`를 컨테이너 클래스로 |
| `type: text` | 텍스트 요소 | `content`를 그대로, `style.token`/`style.color`를 타이포·색 매핑. `style.role: "link"`면 `<a>` |
| `type: image` + `ref` | 에셋 (`assets[]` export) | §9. `<img>` 로 렌더, import 경로 계획 |
| `type: shape` | 스타일된 `div` | 배경/보더/radius만 있는 장식 박스 |

- 노드의 `bbox`(`[x, y, w, h]`)는 **레이아웃 검증용 참조값**이지 좌표 지정용이 아니다.
  절대좌표로 옮기지 말고 부모의 `layout`/`gap` 기반 흐름 레이아웃으로 계획한다.

## 3. 컴포넌트 재사용 vs 신규 판별
`type: component` 노드는 브릿지가 이미 판별해 둔 필드로 결정한다(figma-extraction-rules §3).
핵심: `mappedCodeComponent`는 **대상 코드 경로**일 뿐, 그 파일이 실제로 존재하는지로 재사용/신규를 가른다.
- `mappedCodeComponent`가 있고 **그 경로에 컴포넌트가 이미 존재**하면 → 재사용(import)하도록 계획. 파일 계획에 "신규"로 넣지 않는다.
- `mappedCodeComponent`가 있으나 **그 경로에 아직 파일이 없으면** → 그 경로에 **신규 생성**으로 계획(그린필드 프로젝트의 정상 케이스).
- `isDesignSystemComponent: true`이나 `mappedCodeComponent`가 `null`이면 → design.md 컴포넌트 규칙에 따라
  **신규 재사용 컴포넌트**로 계획(기본 `src/components/<Name>/<Name>.tsx` + `index.ts`).
- `isDesignSystemComponent`가 false/누락이면 → 그 화면 전용이면 페이지 내부 JSX로, 반복되면 신규 컴포넌트로.
- `componentProps`는 컴포넌트에 넘길 props 초안으로 기록한다(예: `{ variant, size, type }` → props 표).

## 4. 토큰 → 코드 매핑 계획
- 브릿지 `tokens.color / type / spacing`를 design.md의 **토큰 전략**에 매핑해 "디자인 토큰 매핑" 표에 적는다.
  - design.md 기본 베이스(Tailwind): color → `tailwind.config` `theme.extend.colors`(+유틸 클래스), type → `fontSize`,
    spacing → 기본 스케일 또는 px 확장. 이때 `tailwind.config.js`를 파일 계획에 "수정"으로 넣는다.
  - 다른 스타일링 스택이면 design.md가 지정한 방식(CSS 변수/테마 객체 등)으로 매핑.
- 브릿지에서 토큰화되지 않고 노드 `style`에 raw 값으로 남은 것(figma-extraction-rules §4)은
  해당 노드에 **일회성 값**으로 계획하고, 토큰 표에는 넣지 않는다.

## 5. 반응형(variantGroup) 계획
- 같은 `variantGroup`을 가진 screen들은 별도 페이지가 아니라 **하나의 페이지 컴포넌트 + 반응형 스타일**로 계획한다.
- 각 screen의 `breakpoint`(mobile/tablet/desktop/default)를 브레이크포인트 전략에 매핑한다
  (Tailwind면 `sm:`/`md:`/`lg:`). 브레이크포인트별로 달라지는 값만 분기로 표기.

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
- 파일 계획 표에 에셋 파일을 "신규"로 넣고, 이를 참조하는 `image` 노드와 연결해 둔다.

## 10. plan.md 구조 (템플릿 채우기)
출력은 `${CLAUDE_PLUGIN_ROOT}/skills/plan/reference/plan.template.md` 골격을 채운다. 각 섹션:
- **개요** — 출처 브릿지 경로, 대상 화면(frame 크기·요지), 적용 컨벤션(design.md 유무).
- **컴포넌트 분해** — 컴포넌트별 역할 + 대응 브릿지 노드(§2·§6).
- **파일 계획** — 경로 / 신규·수정 / 설명 (§3·§4·§9로 도출한 전체 파일 목록).
- **디자인 토큰 매핑** — §4 표.
- **구현 순서** — §7.

작성 예시(로그인 화면 기준)는 `${CLAUDE_PLUGIN_ROOT}/shared/examples/login-page.plan.md`.
