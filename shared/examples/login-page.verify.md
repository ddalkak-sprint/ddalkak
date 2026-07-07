# verify.md — login-page

> 딸깍 verify 단계 리포트. LLM 판단 없이 screenshot 기반 visual diff로 생성.
> 수치는 실행 환경의 폰트/브라우저에 따라 달라질 수 있으며, 포맷 계약 예시로 사용한다.

## 대조 대상
- 화면: login-page (desktop)
- 기준 이미지: `.ddalkak/reports/login-page.desktop.baseline.png`
- 렌더 이미지: `.ddalkak/reports/login-page.desktop.render.png`
- Diff 이미지: `.ddalkak/reports/login-page.desktop.diff.png`
- Raw JSON: `.ddalkak/reports/login-page.desktop.visual.json`

## 결과 요약
- 판정: ❌ 실패
- 신뢰도: 99.494%
- 픽셀 불일치: 6,560 / 1,296,000 (0.506%)
- 기준값: pass ≥ 99.5%, conditional ≥ 98.0%, pixelmatch threshold 0.1

## 영역별 불일치
| 영역 | 타입 | bbox | mismatch | severity |
|---|---:|---:|---:|---|
| login-page/LoginCard/signup-row | text | [580, 620, 200, 20] | 20.000% | major |
| login-page/LoginCard/subtitle | text | [520, 292, 320, 24] | 8.216% | minor |
| login-page/LoginCard/submit | instance | [520, 548, 320, 48] | 7.194% | minor |
| login-page/LoginCard/email-field | instance | [520, 348, 320, 76] | 3.705% | minor |
| login-page/LoginCard | frame | [520, 180, 400, 540] | 3.037% | minor |

## 다음 단계
- diff 이미지와 영역별 mismatch가 큰 노드를 기준으로 수정 후 재검증.
