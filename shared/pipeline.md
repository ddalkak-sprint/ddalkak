# 딸깍 파이프라인 — 단계 간 입출력 계약 (SSOT)

각 스킬이 지켜야 할 입력/출력 계약. 모든 산출물은 대상 프로젝트의 `.ddalkak/`에 저장.

| 단계 | 스킬 | 입력 | 출력 | 담당 |
|------|------|------|------|------|
| 0 | design-md | 프로젝트 코드베이스 | `./design.md` (루트) | 오픈소스 |
| 1 | bridge    | Figma URL + mode | `.ddalkak/bridge/<name>.bridge.json` | 닉·초록 |
| 2 | plan      | bridge.json (+design.md) | `.ddalkak/plan/<name>.plan.md` | 퓨리 |
| 3 | code      | plan.md (+design.md) | 프로젝트 소스 파일 | 퓨리 |
| 4 | verify    | code + bridge.json | `.ddalkak/reports/<name>.verify.md` | 글랜·렉스 |
| 5 | finalize  | verify.md | 최종 요약 + config 완료 표기 | 글랜·렉스 |

## 대상 프로젝트 산출물 레이아웃
```
<project>/
├── design.md
└── .ddalkak/
    ├── ddalkak.config.json      # figmaUrl, mode, 단계별 상태(done/skip)
    ├── bridge/<name>.bridge.json
    ├── plan/<name>.plan.md
    └── reports/<name>.verify.md
```

## skip / 계속 게이트
오케스트레이터(`ddalkak`)가 각 단계 후 [계속 / skip / 중단]을 사용자에게 확인하고
결과를 `ddalkak.config.json`에 기록한다. 개별 스킬 단독 호출도 가능.

## `<name>` 규칙
Figma 페이지/섹션 이름을 kebab-case로. 한 파이프라인 실행 내 모든 산출물이 동일 `<name>` 공유.
