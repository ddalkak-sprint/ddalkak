# plan.md — login-page

> 브릿지 JSON에서 생성된 코드 계획서. 딸깍 code 단계의 입력.
> (목업 예시 — `login-page.bridge.json` + 기본 design.md(React 웹) 기준으로 작성)

## 개요
- 출처 브릿지: `.ddalkak/bridge/login-page.bridge.json`
- 대상 화면: login-page (1440×900, 중앙 로그인 카드)
- 컨벤션: `./design.md` — React 18 + TypeScript + Tailwind CSS

## 컴포넌트 분해
- [ ] `LoginPage` — 화면 루트. 배경(`background`) 위 중앙 정렬 카드 / screen `login-page`
- [ ] `TextField` — 라벨 + 인풋 재사용 컴포넌트 / bridge `component ref=TextField` ×2 (이메일, 비밀번호)
- [ ] `Button` — primary 버튼 재사용 컴포넌트 / bridge `component ref=Button` (로그인)

## 파일 계획
| 경로 | 신규/수정 | 설명 |
|------|-----------|------|
| `src/pages/LoginPage.tsx` | 신규 | 화면 레이아웃, 카드 그룹(column, gap 24) |
| `src/components/TextField/TextField.tsx` | 신규 | label + input, `inputType` prop 지원 |
| `src/components/TextField/index.ts` | 신규 | re-export |
| `src/components/Button/Button.tsx` | 신규 | primary 배경, hover 시 `primary-hover` |
| `src/components/Button/index.ts` | 신규 | re-export |
| `src/assets/login-page/logo.svg` | 신규 | 브릿지 `asset-logo` export |
| `tailwind.config.js` | 수정 | color/type 토큰 등록 |

등록 토큰 + 화면에 쓰인 비토큰 raw 값을 모두 최종 코드 표현으로 확정한다 (code는 복사만 — plan-rules §4).

| 브릿지 값 | 코드 표현 (최종) |
|-----------|------------------|
| `color.primary` #3B82F6 | `colors.primary` → `bg-primary` |
| `color.primary-hover` #2563EB | `colors.primary-hover` → `hover:bg-primary-hover` |
| `color.text-strong` #111827 | `colors.text-strong` → `text-text-strong` |
| `color.text-muted` #6B7280 | `colors.text-muted` → `text-text-muted` |
| `color.border` #E5E7EB | `colors.border` → `border-border` |
| `type.heading-lg` 28/700 | `fontSize.heading-lg` → `text-heading-lg font-bold` |
| `type.body-md` 16/400 | `fontSize.body-md` → `text-body-md` |
| `type.label-sm` 14/500 | `fontSize.label-sm` → `text-label-sm font-medium` |
| `spacing.lg` 24 | 카드 내부 `gap-6` (24px) |
| `spacing.xl` 40 | 카드 `p-10` (40px) |
| raw radius 8 (인풋·버튼 모서리) | `rounded-lg` |
| raw gap 8 (라벨↔인풋) | `gap-2` |
| raw 폭 400 (카드) | `w-[400px]` (스케일 불일치 → 임의값) |

## 구현 순서
1. `tailwind.config.js`에 토큰 등록
2. `Button`, `TextField` 재사용 컴포넌트 작성
3. `LoginPage` 조립 (로고 → 타이틀 → 서브텍스트 → 이메일 → 비밀번호 → 로그인 버튼 → 회원가입 링크)
4. 브릿지 bbox 대비 레이아웃 확인 (카드 400px 폭, 중앙 정렬)
