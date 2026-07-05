# 딸깍 팀 작업 가이드 — 나는 뭘 하면 되나?

> 각 담당자가 **어디서, 어떤 파일을 가지고, 뭘 만들면 되는지** 정리한 문서.
> 계약(입출력)의 SSOT는 [shared/pipeline.md](shared/pipeline.md), 예시(정답지)는 [shared/examples/](shared/examples/)에 있다.

## 큰 그림

```
Figma URL ──[1 bridge]──> bridge.json ──[2 plan]──> plan.md ──[3 code]──> React 코드
                                │                                            │
                                └────────────[4 verify]── 대조 ──────────────┘
                                                  │
                                            verify.md ──[5 finalize]──> 완료
```

- 단계마다 **입력/출력이 파일로 고정**되어 있어서, 선행 단계가 안 끝나도 목업 파일로 개발·테스트 가능.
- 목업 세트: `shared/examples/` (로그인 화면 `login-page` 소재, 전 단계 공통)
- 테스트장: `sandbox/` — 목업이 미리 주입된 React 앱. 여기서 자기 스킬을 실행해본다.

## 공통 준비 (전원, 처음 1회)

```bash
cd sandbox
npm install
claude                # 샌드박스 폴더에서 Claude Code 실행
```
Claude Code 안에서:
```
/plugin marketplace add C:\project\teo_sprint\ddalkak     # 본인 로컬 경로
/plugin install ddalkak@ddalkak-marketplace
```

**빠르게 반복 개발할 때(추천)** — SKILL.md/agents를 자주 고칠 거면 마켓플레이스 add/install 대신
아예 세션을 이 옵션으로 켠다. 재설치 없이 즉시 반영된다:
```bash
claude --plugin-dir C:\project\teo_sprint\ddalkak    # sandbox에서 이 옵션으로 실행
```
스킬/서브에이전트 파일을 고친 뒤에는 재시작 없이:
```
/reload-plugins
```

**로드 확인:**
```
/mcp     # figma가 Connected인지 확인 (bridge 작업자는 필수)
/ddalkak 까지 타이핑 → 자동완성에 ddalkak:bridge / ddalkak:plan / ddalkak:code / ddalkak:verify / ddalkak:finalize / ddalkak:design-md 가 뜨는지 확인
```

---

## 닉 · 초록 — [1] bridge

| | |
|---|---|
| 만들 것 | `skills/bridge/SKILL.md` 구현 (+ `agents/figma-extractor.md`) |
| 입력 | Figma URL + 모드(`section`/`page`) — Figma MCP 필요 |
| 출력 | `.ddalkak/bridge/<name>.bridge.json` |
| 출력 스펙 | `shared/bridge.schema.json` (SSOT) |
| 기대 결과 예시 | `shared/examples/login-page.bridge.json` — **이런 모양이 나오면 성공** |

**MCP 호출 절약 (중요 — 호출 한도 있음):** 라이브 호출을 매번 하면 한도가 금방 소진된다.
**한 번만 정성껏 캡처 → 캐시 재생**으로 개발한다 (rules §10, `fixtures/figma/README.md`):
1. Figma MCP 연결: `claude mcp add --transport http figma https://mcp.figma.com/mcp` → 세션 재시작 → `/mcp`로 인증
2. 골든 캡처(호출 소모): `/ddalkak:bridge <page-url> --source live --cacheDir fixtures/figma/<name>`
   → 모든 원시 응답이 캐시에 기록됨. `node scripts/mcp-cache.mjs check fixtures/figma/<name>`로 완결 확인
3. 이후 개발은 **호출 0회**: `/ddalkak:bridge <page-url> --source cache --cacheDir fixtures/figma/<name>`

**테스트:** 재생으로 나온 `.ddalkak/bridge/<name>.bridge.json`을
`node scripts/validate-bridge.mjs <path>`로 검증 (미해결 `@ref`=무손실 위반).
기대 모양은 `shared/examples/login-page.bridge.json`(v2.0).

**완료 기준:** 캐시된 실물 응답으로 스키마 통과 + 스크린샷 교차검증(§8)까지 되는 브릿지가 나온다.

---

## 퓨리 — [2] plan · [3] code

| | |
|---|---|
| 만들 것 | `skills/plan/SKILL.md`, `skills/code/SKILL.md` 구현 |
| plan 입력 | `.ddalkak/bridge/login-page.bridge.json` (목업 주입돼 있음) + `design.md` |
| plan 출력 | `.ddalkak/plan/<name>.plan.md` — 템플릿: `skills/plan/reference/plan.template.md` |
| code 입력 | plan.md + `design.md` |
| code 출력 | `src/` 소스 파일 (React + TS + Tailwind — `design.md` 컨벤션 준수) |
| 기대 결과 예시 | `shared/examples/login-page.plan.md`, `sandbox/src/` 전체 |

**테스트 (plan):** `rm .ddalkak/plan/login-page.plan.md` → `/ddalkak:plan` → 예시와 비교.
**테스트 (code):** `rm -r src/pages src/components` → `/ddalkak:code` → `npm run dev`로 렌더 확인.

**완료 기준:** 목업 브릿지만 넣고 돌리면 렌더되는 로그인 화면 코드가 나온다.

---

## 글랜 · 렉스 — [4] verify · [5] finalize

| | |
|---|---|
| 만들 것 | `skills/verify/SKILL.md`, `skills/finalize/SKILL.md` 구현 (+ `agents/design-verifier.md`) |
| verify 입력 | `sandbox/src/` 코드 + `.ddalkak/bridge/login-page.bridge.json` (둘 다 준비돼 있음) |
| verify 출력 | `.ddalkak/reports/<name>.verify.md` |
| 기대 결과 예시 | `shared/examples/login-page.verify.md` — 리포트 포맷 기준 |

**테스트:** 지울 것 없이 sandbox에서 바로 `/ddalkak:verify`.
샌드박스 코드에 **의도적 불일치 2건**이 심어져 있다 — 이걸 잡으면 성공:
1. `src/components/TextField/TextField.tsx` — 인풋 높이 44px (스펙 48px)
2. `src/pages/LoginPage.tsx` — 회원가입 링크 색 text-muted (스펙 primary)

**완료 기준:** 위 2건이 리포트에 잡히고, finalize가 리포트를 요약·config에 완료 표기한다.

---

## 규칙

1. **출력 포맷을 바꾸면 `shared/examples/`의 예시도 같이 갱신** — 예시가 곧 팀 간 계약이다. 브릿지 구조 변경은 `shared/bridge.schema.json`부터.
2. 테스트 끝나면 리셋: `npm run seed` (`.ddalkak` 복원) + `git checkout -- src/` (코드 복원)
3. 브랜치: 각자 담당 스킬 브랜치에서 작업 → `main`으로 PR.

## 막히면
- 파이프라인 계약 전체: `shared/pipeline.md`
- 샌드박스 상세: `sandbox/README.md`
- 코드 생성 컨벤션(기본 React 웹): `skills/design-md/reference/design.md.template`
