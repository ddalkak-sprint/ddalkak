# plan.md — pc-home

> 브릿지 JSON에서 생성된 코드 계획서. 딸깍 code 단계의 입력.
> (pc-home.bridge.json v2.1 + `./design.md` 기준 — 재실행 산출물)

## 개요
- 출처 브릿지: `.ddalkak/bridge/pc-home.bridge.json` (schemaVersion 2.1, mode: section, fidelity: lossless)
- 대상 화면: pc-home (1920×1080 desktop) — 롤링 페이퍼 서비스 홈. 헤더 / 피처 소개 섹션 ×2 / 하단 CTA
- 컨벤션: `./design.md` — React 18 (Vite) + TypeScript + Tailwind CSS
- variantGroup `home`에 breakpoint `desktop` 1개뿐 → 반응형 분기 없음 (mobile 화면 합류 시 §5로 통합)
- 재실행 주의: 동일 브릿지의 이전 산출물이 존재(커밋 53007c8) — 아래 "신규" 파일은 이전 산출물을 대체한다.

## 컴포넌트 분해
- [ ] `PcHome` — 화면 루트 / screen `pc-home`. `<header>`(semanticRole: nav) → 본문(1200px 중앙, column gap 30) → 하단 CTA
- [ ] `HomeButton` — `instance Button/Outlined-40`("롤링 페이퍼 만들기") + `Button/Primary-56`("구경해보기", semanticRole: cta-button).
  `Name/Variant-Size` 패턴(§3) → 베이스 1개 + `variant`(outlined|primary) · `size`(40|56) props.
  기존 `src/components/Button`과 **동명이형**(파랑 단일 primary 체계 vs 보라/아웃라인 체계) → §3-1 스코프 신규 `HomeButton`
- [ ] `FeaturePoint` — Point 배지 + 헤딩 + 서브텍스트 / `suggestedComponent: FeaturePoint` ×2. props `{ point, heading, subtitle }` (suggestedProps 승계)
- [ ] `MessageCard` — 아바타 + From 행(runs → span 분할) + 관계 태그 + 본문 + 날짜 / `suggestedComponent: MessageCard` ×2.
  props `{ from, tag, tagColor, tagTextColor, message, date }` — `tagTextColor`는 suggestedProps에 없어 tag-label fill에서 파생(⚠3).
  내부 `layout` 없음 → §2-1 기본: 자식 bbox y순 흐름(헤더 행 → 본문 → 날짜)으로 근사
- [ ] `ReactionChip` — 이모지+카운트 칩 / `suggestedComponent: ReactionChip` ×3. props `{ emoji?, count }` — emoji만 optional(값 없는 인스턴스 1개), count 필수 (§7-1 기준)
- [ ] `EmojiPickerChip` — 피커 패널용 칩(72×38) / `suggestedComponent: EmojiPickerChip` ×6. props `{ emoji, count, overlay }` 전부 필수 — overlay(54|50)는 배경 농도 파생 prop(⚠4)
- 공통: 단일 텍스트 `content`를 갖는 컴포넌트(`HomeButton`)는 텍스트를 children으로 받는다 (code-rules §7-1)
- 페이지 내부 JSX: 헤더(로고 group + HomeButton, `line` 노드 → `border-b`), `add-card` · `add-button` · `emoji-picker-panel` · `button-dropdown` · 커서 이미지 ×2
  — `img_01`/`img_02` 서브트리는 **일러스트 절대배치**(§2-1 예외: `layout: none` + bbox 겹침 + reconciliation이 "composed illustrations"로 명시)

## 파일 계획
| 경로 | 신규/수정 | 설명 |
|------|-----------|------|
| `src/pages/PcHome.tsx` | 신규 | 화면 조립 (header / 피처 섹션 ×2 / CTA) |
| `src/components/HomeButton/HomeButton.tsx` | 신규 | variant(outlined·primary) × size(40·56) |
| `src/components/HomeButton/index.ts` | 신규 | re-export |
| `src/components/FeaturePoint/FeaturePoint.tsx` | 신규 | Point 배지 + 헤딩 + 서브텍스트 |
| `src/components/FeaturePoint/index.ts` | 신규 | re-export |
| `src/components/MessageCard/MessageCard.tsx` | 신규 | 롤링 페이퍼 메시지 카드 |
| `src/components/MessageCard/index.ts` | 신규 | re-export |
| `src/components/ReactionChip/ReactionChip.tsx` | 신규 | 이모지 반응 칩 |
| `src/components/ReactionChip/index.ts` | 신규 | re-export |
| `src/components/EmojiPickerChip/EmojiPickerChip.tsx` | 신규 | 피커 패널 칩 |
| `src/components/EmojiPickerChip/index.ts` | 신규 | re-export |
| `src/assets/pc-home/` (svg×4, png×2) | 신규 | assets export 6개 배치 — screenshot 제외(§9). export 원본 전부 존재 확인 |
| `tailwind.config.js` | 수정 | pc-home color/type 토큰 · fontFamily 등록 |
| `index.html` | 수정 | Pretendard · Poppins 웹폰트 로딩 (§4-1) |
| `src/App.tsx` | 수정 | 페이지 등록 — `#pc-home` 해시 → PcHome 렌더 |

## 디자인 토큰 매핑
| 브릿지 토큰 | 코드 표현 |
|-------------|-----------|
| `color.purple-600` #9935FF · `purple-700` #861DEE · `purple-200` #ECD9FF · `purple-50` #A64EFF | `colors.purple-*` → `bg-purple-600` 등 (Tailwind 기본 purple 셰이드 4종 덮어씀 — §4-1 명시. purple-50 명도 역전은 브릿지 원본 승계) |
| `color.surface` #F6F8FF | **기존 `surface` #FFFFFF와 이름 충돌** → §4-1 스코프: `colors.surface-home` |
| `color.gray-900` #181818 · `gray-500` #555555 · `gray-300` #CCCCCC · `gray-200` #EEEEEE | `colors.gray-*` (기본 gray 셰이드 덮어씀 — §4-1 명시) |
| `color.gray-90` #4A494F | `colors.gray-90` (신규 이름, 충돌 없음) |
| `color.white` #FFFFFF | 등록 생략 — Tailwind 기본 `white` 동일값 재사용 (§4-1) |
| `type.font-24-bold` 24/700/36/-1% | `fontSize.font-24-bold` → `text-font-24-bold font-bold` |
| `type.font-18-bold` · `font-18-regular` · `font-16-bold` · `font-14-bold` | 동일 패턴 등록 (-1% → -0.01em, -0.5% → -0.005em) |
| 폰트 패밀리 `Pretendard`(본문) · `Poppins`(로고) — 프로젝트에 없음(§4-1) | `fontFamily.pretendard`/`poppins` 등록 + index.html 웹폰트 로딩 |
| raw 값 (radius 2·6·10·12·14·32·40·50·100, rgba 배경·보더, 드롭섀도, #EDEDED·#DBD9E9·#DADCDF·#777777·#E2F5FF·#00A2FE) | 일회성 값 — 토큰 승격 안 함. 스케일 정확 일치분은 스케일 클래스 의무(code-rules §4-1: 2→`rounded-sm`, 6→`rounded-md`, 12→`rounded-xl`), 그 외 임의값(`rounded-[32px]`, `bg-black/[0.54]`, `border-[#DBD9E9]`) |
| raw `#555555`(카드 본문) | 등록 토큰 `gray-500`과 동일값 → `text-gray-500` (§4) |

## 구현 순서
1. `tailwind.config.js` 토큰·fontFamily 등록 + `index.html` 폰트 로딩 (기존 수정분 존재 시 유지 확인)
2. 잎 컴포넌트: `ReactionChip` → `EmojiPickerChip` → `FeaturePoint` → `HomeButton`
3. `MessageCard` (avatar 에셋 사용)
4. `PcHome` 조립: `<header>`(로고 + outlined-40 버튼, `border-b` #EDEDED) → 섹션1(surface-home 라운드 카드: FeaturePoint + 메시지 카드 일러스트[MessageCard ×2 + add-card, 절대배치]) → 섹션2(이모지 위젯 일러스트[절대배치] + FeaturePoint) → CTA(primary-56 "구경해보기", 중앙)
5. 에셋 6개 배치 + `App.tsx` 페이지 등록
6. bbox 대비 확인: 본문 1200px 중앙(헤더 아래 60px), 섹션 324px·radius 16, 메시지 카드 205×162, 피커 패널 293px, CTA 280×56

## ⚠ 가정 및 미해결
1. 헤더 `header-bar`의 `gap: 944`는 space-between auto-layout의 잔여 공간 값으로 판단 → `justify-between`으로 구현 (1146px 컨테이너 중앙 배치)
2. **브릿지 bbox ↔ 스크린샷 모순 2건 — 스크린샷 우선(§2-1), 브릿지 담당 전달 필요:**
   - 메시지 카드 3장 bbox 겹침(add-card x0 · 강미나 x40 · 박대영 x257) vs 스크린샷은 나란히 배열 → flex row gap 12로 구현, 순서는 스크린샷 기준 강미나 → 박대영 → add-card
   - 하단 CTA bbox x=102(좌측) vs 스크린샷은 중앙 정렬 → `justify-center`로 구현
3. `MessageCard`의 suggestedProps에 태그 글자색이 없음 — tag-label 노드 fill(#861DEE/#00A2FE)에서 파생해 `tagTextColor` prop 추가. 박대영 카드 suggestedProps의 `tagColor: @color.purple-200`(#ECD9FF)·글자색 purple-700 적용
4. `EmojiPickerChip` 배경이 1행 rgba(0,0,0,0.54) / 2행 rgba(0,0,0,0.5)로 불일치 — 디자인 의도 불명확하나 브릿지 원본 그대로 승계(농도 prop 분기)
5. `ReactionChip` bbox 폭(55)이 padding 합(12+12+콘텐츠 36=60)과 모순 — layout(padding) 우선으로 구현, 브릿지 담당 전달
