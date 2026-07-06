# plan.md — pc-home

> 브릿지 JSON에서 생성된 코드 계획서. 딸깍 code 단계의 입력.
> (pc-home.bridge.json v2.1 + `./design.md` 기준, plan-rules 개정판 적용)

## 개요
- 출처 브릿지: `.ddalkak/bridge/pc-home.bridge.json` (schemaVersion 2.1, mode: section)
- 대상 화면: pc-home (1920×1080 desktop, 롤링 페이퍼 서비스 홈 — 헤더 / 피처 소개 2개 섹션 / 하단 CTA)
- 컨벤션: `./design.md` — React 18 + TypeScript + Tailwind CSS
- variantGroup `home` / breakpoint `desktop` — desktop 화면 1개뿐이므로 반응형 분기 없음 (추후 mobile 합류 시 §5로 통합)

## 컴포넌트 분해
- [ ] `PcHome` — 화면 루트 / screen `pc-home`. `<header>`(semanticRole: nav) → 본문 컨테이너(1200px, gap 30) → 하단 CTA
- [ ] `HomeButton` — 홈 화면 버튼 / bridge `instance Button/Outlined-40`(롤링 페이퍼 만들기), `Button/Primary-56`(구경해보기, semanticRole: cta-button). `componentName` 패턴(§3) → 베이스 1개 + `variant`(outlined|primary)·`size`(40|56) props. **기존 `Button`과 동명이형**(파랑 단일형 vs 보라/아웃라인 체계) → §3-1에 따라 스코프 신규
- [ ] `FeaturePoint` — 배지(Point. NN)+헤딩+서브텍스트 / `suggestedComponent: FeaturePoint` ×2 — props `{ point, heading, subtitle }` (suggestedProps 승계)
- [ ] `MessageCard` — 아바타+From 행+관계 태그+본문+날짜 / `suggestedComponent: MessageCard` ×2 — props `{ from, tag, tagColor, message, date }`. 내부 layout 없음 → §2-1 기본(bbox 순서로 흐름 근사). From 행은 `runs[]` → span 분할
- [ ] `ReactionChip` — 이모지+카운트 칩 / `suggestedComponent: ReactionChip` ×3 — props `{ emoji?, count }` (emoji 없는 인스턴스 존재)
- [ ] `EmojiPickerChip` — 피커 패널용 큰 칩 / `suggestedComponent: EmojiPickerChip` ×6 — props `{ emoji, count }`
- 페이지 내부 JSX: 헤더(로고 group + HomeButton + line→`border-b`), `add-card`·`add-button`·`emoji-picker-panel`·`button-dropdown`·커서 이미지 — **일러스트 절대배치 영역**(§2-1 예외: bbox 겹침 + reconciliation이 "composed illustrations"로 명시)

## 파일 계획
| 경로 | 신규/수정 | 설명 |
|------|-----------|------|
| `src/pages/PcHome.tsx` | 신규 | 화면 조립 (header / 피처 섹션 ×2 / CTA) |
| `src/components/HomeButton/HomeButton.tsx` | 신규 | variant(outlined·primary) × size(40·56) |
| `src/components/HomeButton/index.ts` | 신규 | re-export |
| `src/components/FeaturePoint/FeaturePoint.tsx` | 신규 | 배지+헤딩+서브텍스트 |
| `src/components/FeaturePoint/index.ts` | 신규 | re-export |
| `src/components/MessageCard/MessageCard.tsx` | 신규 | 롤링 페이퍼 메시지 카드 |
| `src/components/MessageCard/index.ts` | 신규 | re-export |
| `src/components/ReactionChip/ReactionChip.tsx` | 신규 | 이모지 반응 칩 |
| `src/components/ReactionChip/index.ts` | 신규 | re-export |
| `src/components/EmojiPickerChip/EmojiPickerChip.tsx` | 신규 | 피커 패널 칩 |
| `src/components/EmojiPickerChip/index.ts` | 신규 | re-export |
| `src/assets/pc-home/` (svg×4, png×2) | 신규 | assets export 6개 배치 — screenshot 제외(§9), 전 파일 존재 확인됨 |
| `tailwind.config.js` | 수정 | pc-home color/type 토큰·fontFamily 추가 |
| `index.html` | 수정 | Pretendard·Poppins 웹폰트 로딩 (§4-1) |
| `src/App.tsx` | 수정 | 렌더 확인용 페이지 전환 (`#pc-home` 해시 → PcHome) |

## 디자인 토큰 매핑
| 브릿지 토큰 | 코드 표현 |
|-------------|-----------|
| `color.purple-600` #9935FF | `colors.purple-600` → `bg-purple-600` (Tailwind 기본 purple-600 덮어씀 — §4-1 명시) |
| `color.purple-700` #861DEE / `purple-200` #ECD9FF / `purple-50` #A64EFF | 동일 방식 (purple-50 명도 역전은 브릿지 원본 승계) |
| `color.surface` #F6F8FF | **기존 `surface` #FFFFFF와 이름 충돌** → §4-1 스코프: `colors.surface-home` |
| `color.gray-900` #181818 / `gray-500` #555555 / `gray-300` #CCCCCC / `gray-200` #EEEEEE / `gray-90` #4A494F | `colors.gray-*` (기본 gray 셰이드 4종 덮어씀 — §4-1 명시) |
| `color.white` #FFFFFF | 등록 생략 — Tailwind 기본 `white`와 동일값 재사용 (§4-1) |
| `type.font-24-bold` 24/700/36/-1% | `fontSize.font-24-bold` → `text-font-24-bold font-bold` |
| `type.font-18-bold` · `font-18-regular` · `font-16-bold` · `font-14-bold` | 동일 패턴 등록 |
| (§4-1) `Pretendard`(본문)·`Poppins`(로고) | `fontFamily.pretendard`/`poppins` 등록 + index.html 로딩 |
| raw 값 (radius 2·6·10·12·14·16·32·40·50·100, rgba 배경/보더, 드롭섀도) | 일회성 임의값 클래스 (`rounded-[32px]`, `bg-black/[.54]` 등) |
| raw `#555555`(message 본문) | `gray-500` 토큰과 동일값 → `text-gray-500` 사용 (§4) |

## 구현 순서
1. `tailwind.config.js` 토큰·fontFamily 등록, `index.html` 폰트 로딩
2. 잎 컴포넌트: `ReactionChip` → `EmojiPickerChip` → `FeaturePoint` → `HomeButton`
3. `MessageCard` (avatar 에셋 사용)
4. `PcHome` 조립: `<header>`(로고+outlined 버튼, `border-b` 1px #EDEDED) → 섹션1(surface-home 카드: FeaturePoint + 카드 일러스트[MessageCard ×2 + add-card, 절대배치]) → 섹션2(이모지 위젯 일러스트[절대배치] + FeaturePoint) → CTA(primary-56 "구경해보기")
5. 에셋 6개 배치 + `App.tsx` 페이지 전환
6. bbox 대비 확인: 본문 1200px 중앙(y 124), 섹션 324px·rounded 16, 카드 205×162, CTA 280×56

## ⚠ 가정 및 미해결
1. 헤더 내부 `gap: 944`는 auto-layout 잔여 공간으로 보고 `justify-between`으로 구현 (컨테이너 1146px 중앙)
2. **브릿지 bbox ↔ 스크린샷 모순 2건 — 스크린샷 우선 적용 (§2-1), 브릿지 담당(닉·초록) 전달 필요:**
   - 메시지 카드 3장: bbox상 겹침(add-card x0·강미나 x40·박대영 x257)이나 스크린샷은 나란히 배열
     → flex row gap 12로 구현 (순서: 강미나·박대영·add-card)
   - 하단 CTA: bbox상 x102(좌측)이나 스크린샷은 중앙 정렬 → `justify-center`로 구현
3. ReactionChip bbox 폭(55)이 자체 padding 합(60)과 모순 — layout(padding) 우선으로 구현, 브릿지 담당 전달
