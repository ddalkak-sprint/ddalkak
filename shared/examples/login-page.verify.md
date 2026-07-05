# verify.md — login-page

> 딸깍 verify 단계 리포트. code ↔ figma(브릿지) 대조 결과.
> (목업 예시 — 리포트 포맷의 기준. 글랜·렉스가 실제 포맷 확정 시 이 파일을 갱신)

## 대조 대상
- 코드: `src/pages/LoginPage.tsx` (렌더링 스크린샷: `.ddalkak/reports/login-page.render.png`)
- 스펙: `.ddalkak/bridge/login-page.bridge.json` + Figma 스크린샷

## 결과 요약
- 판정: ⚠️ 조건부 통과 (불일치 2건 — major 0, minor 2)
- 항목: 검사 12 / 통과 10 / 불일치 2

## 체크리스트
| # | 항목 | 기준(브릿지) | 구현 | 판정 |
|---|------|--------------|------|------|
| 1 | 카드 폭 | 400px | 400px | ✅ |
| 2 | 카드 radius | 12px | 12px | ✅ |
| 3 | 내부 gap | 24px | 24px | ✅ |
| 4 | 타이틀 타이포 | heading-lg 28/700 | 28/700 | ✅ |
| 5 | 타이틀 색 | text-strong #111827 | #111827 | ✅ |
| 6 | 인풋 높이 | 48px | 44px | ❌ minor |
| 7 | 인풋 border | #E5E7EB, radius 8 | 일치 | ✅ |
| 8 | 버튼 배경 | primary #3B82F6 | #3B82F6 | ✅ |
| 9 | 버튼 높이 | 48px | 48px | ✅ |
| 10 | 회원가입 링크 색 | primary | text-muted 적용됨 | ❌ minor |
| 11 | 로고 asset | logo.svg 48×48 | 일치 | ✅ |
| 12 | 배경색 | background #F9FAFB | #F9FAFB | ✅ |

## 불일치 상세 & 제안 수정
1. **[minor] TextField 높이 44px ≠ 48px**
   - 위치: `src/components/TextField/TextField.tsx`
   - 제안: `h-11` → `h-12`
2. **[minor] 회원가입 링크 색상 오적용**
   - 위치: `src/pages/LoginPage.tsx` 하단 링크
   - 제안: `text-text-muted` → `text-primary`

## 다음 단계
- 제안 수정 반영 후 재검증 → 통과 시 finalize 진행
