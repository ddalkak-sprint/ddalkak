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
| 0 | `/ddalkak:design-md` | 팀 컨벤션 design.md 추출/생성 | 오픈소스 |
| 1 | `/ddalkak:bridge`    | Figma MCP → 디자인 브릿지 JSON (section/page) | 닉·초록 |
| 2 | `/ddalkak:plan`      | 브릿지 → plan.md | 퓨리 |
| 3 | `/ddalkak:code`      | plan.md → 코드 | 퓨리 |
| 4 | `/ddalkak:verify`    | code ↔ figma 검증 | 글랜·렉스 |
| 5 | `/ddalkak:finalize`  | 마무리 검증 | 글랜·렉스 |
| — | `ddalkak`           | 전체 파이프라인 오케스트레이터 | — |

> **팀원이라면** → [GUIDE.md](GUIDE.md) 먼저 보세요. 담당별로 어디서 뭘 가지고 작업하는지 정리돼 있습니다.

## 사용법 (예정)
```
/ddalkak <figma-url>          # 전체 파이프라인 (게이트 확인하며 진행)
/ddalkak:bridge <figma-url>   # 특정 단계만 단독 실행 (플러그인 네임스페이스 포함)
```

## 요구사항
- Claude Code Figma 플러그인(MCP) — `get_design_context` / `get_screenshot` / `get_metadata`

## 기본 베이스
코드 생성의 기본 타깃은 **React 웹**(React 18 + TypeScript + Tailwind).
어떤 언어/스택으로 생성할지는 대상 프로젝트 루트의 `design.md`로 지정한다 —
`/ddalkak:design-md`가 기본값이 채워진 템플릿을 생성해주며, 수정해서 쓰면 된다.

## 단계별 목업 예시
선행 단계 결과물 없이도 각 담당자가 병렬 착수할 수 있게
`shared/examples/`에 로그인 화면 기준 예시 세트(bridge.json / plan.md / verify.md / config)를 제공한다.

## Figma MCP 골든 캡처 (호출 한도 절약)
Figma MCP 호출 한도(요금제별 월 N회)를 아끼기 위해, 누군가 한 번 실제로 뜬 원시 응답을
`fixtures/figma/`에 캐시해두고 나머지는 그걸 재생(`--source cache`)해서 호출 0회로 개발한다.
지금 쓸 수 있는 캡처 목록과 명령어는 [fixtures/figma/README.md](fixtures/figma/README.md) 참고.

## 샌드박스 (바로 테스트)
`sandbox/`는 목업이 미리 주입된 React 웹 프로젝트다. 자기 단계 스킬을 그 자리에서
실행하고 `npm run dev`로 결과를 확인할 수 있다. 역할별 테스트 방법은 [sandbox/README.md](sandbox/README.md) 참고.

## 구조
- `skills/` — 단계별 스킬  ·  `agents/` — 서브에이전트(추출/검증)
- `shared/` — 브릿지 스키마 등 단일 진실 소스  ·  `scripts/` — 검증기
- `.claude-plugin/` — 매니페스트/마켓플레이스  ·  `codex/` — Codex 미러(예정)

## 산출물 저장
대상 프로젝트 루트의 `.ddalkak/`에 저장 (`bridge/`, `plan/`, `reports/`, `ddalkak.config.json`).
자세한 계약은 [shared/pipeline.md](shared/pipeline.md) 참고.
