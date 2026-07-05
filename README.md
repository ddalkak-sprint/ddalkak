# 딸깍 (ddalkak)

Figma URL을 한 번에(**딸깍**) 코드로 뽑아내는 디자인→코드 파이프라인 플러그인.
Claude Code 스킬로 제공하며(추후 Codex 미러), 개발 대상 폴더에서 슬래시 커맨드로 실행한다.

## 파이프라인
```
design.md → 디자인 브릿지(JSON) → plan.md → code → 검증 → 마무리
```
각 단계 사이에 **[skip / 계속 / 중단]** 게이트가 있다.

| # | 스킬 | 하는 일 | 담당 |
|---|------|---------|------|
| 0 | `ddalkak:design-md` | 팀 컨벤션 design.md 추출/생성 | 오픈소스 |
| 1 | `ddalkak:bridge`    | Figma MCP → 디자인 브릿지 JSON (section/page) | 닉·초록 |
| 2 | `ddalkak:plan`      | 브릿지 → plan.md | 퓨리 |
| 3 | `ddalkak:code`      | plan.md → 코드 | 퓨리 |
| 4 | `ddalkak:verify`    | code ↔ figma 검증 | 글랜·렉스 |
| 5 | `ddalkak:finalize`  | 마무리 검증 | 글랜·렉스 |
| — | `ddalkak`           | 전체 파이프라인 오케스트레이터 | — |

## 사용법 (예정)
```
/ddalkak <figma-url>          # 전체 파이프라인 (게이트 확인하며 진행)
/ddalkak:bridge <figma-url>   # 특정 단계만 단독 실행
```

## 요구사항
- Claude Code Figma 플러그인(MCP) — `get_design_context` / `get_screenshot` / `get_metadata`

## 구조
- `skills/` — 단계별 스킬  ·  `agents/` — 서브에이전트(추출/검증)
- `shared/` — 브릿지 스키마 등 단일 진실 소스  ·  `scripts/` — 검증기
- `.claude-plugin/` — 매니페스트/마켓플레이스  ·  `codex/` — Codex 미러(예정)

## 산출물 저장
대상 프로젝트 루트의 `.ddalkak/`에 저장 (`bridge/`, `plan/`, `reports/`, `ddalkak.config.json`).
자세한 계약은 [shared/pipeline.md](shared/pipeline.md) 참고.
