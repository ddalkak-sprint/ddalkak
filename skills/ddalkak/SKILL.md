---
name: ddalkak
description: Figma URL을 받아 코드까지 한 번에(딸깍) 뽑는 전체 파이프라인을 실행한다. design.md → 디자인 브릿지(JSON) → plan.md → code → 검증을 순서대로 돌리되, 각 단계 사이에서 [skip / 계속]을 사용자에게 확인한다. 사용자가 "figma에서 코드 뽑아줘", "딸깍 돌려줘" 같이 전체 흐름을 원할 때 사용.
---

# 딸깍 (오케스트레이터)

Figma → 코드 전체 파이프라인을 조율한다. 각 단계는 개별 스킬로 위임하고,
**단계 사이마다 사용자에게 결과를 보여주고 [skip / 계속 / 중단]을 확인**한다.

## 입력
- Figma URL (필수)
- 추출 모드: `section` | `page` (기본: `page`)

## 상태 파일
`.ddalkak/ddalkak.config.json` 에 figma url / mode / 각 단계 완료·skip 상태를 기록한다.
재실행 시 이 파일을 읽어 이어서 진행한다.

## 단계 (각 단계 후 사용자 확인)

| # | 스킬 | 입력 → 출력 | 담당 |
|---|------|-----------|------|
| 0 | `ddalkak:design-md` | (팀 컨벤션) → `design.md` | 오픈소스 |
| 1 | `ddalkak:bridge`     | Figma URL → `.ddalkak/bridge/<name>.bridge.json` | 닉·초록 |
| 2 | `ddalkak:plan`       | bridge.json → `.ddalkak/plan/<name>.plan.md` | 퓨리 |
| 3 | `ddalkak:code`       | plan.md (+design.md) → 실제 코드 | 퓨리 |
| 4 | `ddalkak:verify`     | code ↔ figma → `.ddalkak/reports/<name>.verify.md` | 글랜·렉스 |
| 5 | `ddalkak:finalize`   | 검증 리포트 → 마무리 정리 | 글랜·렉스 |

## 게이트 규칙
- 각 단계 완료 후: 산출물 요약을 보여주고 다음 중 하나를 묻는다.
  - **계속** — 다음 단계 진행
  - **skip** — 다음 단계 건너뛰기 (이유 기록)
  - **중단** — 현재 상태 저장 후 종료
- 특히 [1] bridge 산출 후에는 사용자의 **검토·확인**을 반드시 받고 [2]로 넘어간다.

<!-- TODO: 각 단계 위임 로직 / config 스키마 상세 / 재개(resume) 동작 채우기 -->
