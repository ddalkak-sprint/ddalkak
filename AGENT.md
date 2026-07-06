# AGENT.md — 팀 공통 AI 작업 컨벤션 (자동사냥)

> 딸깍 팀의 모든 작업은 **이슈 단위**로 돌린다. 사람은 이슈 확인·리뷰·merge만 하고,
> 나머지는 각자의 AI가 수행한다.

## 루프

```
AI로 이슈 등록하기 → 배정 → 구현(시키고) → PR(시키고) → (review) → merge
   /ddalkak:issue              └────── /ddalkak:hunt ──────┘      사람       사람
```

## 원칙

1. **각자가 맡은 이슈는 각자의 AI로 해결한다.**
2. **내 이슈가 아닌데 버그를 발견하면 이슈 등록만 한다.** — 남의 영역 코드는 고치지 않는다.
   발견 즉시 `/ddalkak:issue`로 등록하고 담당자를 assign한 뒤 하던 일로 돌아간다.
3. 이슈에 적힌 범위만 구현한다. 범위 밖 개선거리는 새 이슈로 뺀다.

## 담당 (R&R)

| 영역 | 담당 | 소유 경로 |
|---|---|---|
| [1] bridge | 닉 · 초록 | `skills/bridge/`, `agents/figma-extractor.md`, `fixtures/figma/` |
| [2] plan · [3] code | 퓨리 (@hanseulhee) | `skills/plan/`, `skills/code/`, `shared/plan-rules.md`, `shared/code-rules.md` |
| [4] verify · [5] finalize | 글랜 · 렉스 | `skills/verify/`, `skills/finalize/`, `agents/design-verifier.md` |
| 공통 (스키마·샌드박스·CI) | 전원 — 변경 전 이슈로 합의 | `shared/bridge.schema.json`, `sandbox/`, `.github/` |

- GitHub 핸들 전체 목록: `.github/CODEOWNERS`. 닉네임↔핸들이 헷갈리면 assign 없이 등록하고 이슈 본문에 담당 닉네임을 적는다.

## 이슈 컨벤션

- **제목**: `[bug] …` / `[work] …` / `[doc] …` / `feat(<영역>): …` 프리픽스. 한 줄로 증상·목적이 드러나게.
- **본문**:
  - 버그 → 재현 절차 / 기대 동작 / 실제 동작 (+ 관련 파일 경로)
  - 작업 → 배경 / 할 일 체크리스트 / 완료 기준
- **라벨**: 영역 라벨(`skills`, `sandbox`, `bridge-schema`, `scripts`, `fixtures`, `agents`, `ci`, `documentation`) + 성격 라벨(`bug`, `enhancement`).
- **배정**: 위 R&R 표 기준. 내 영역이면 나를 assign.

## 브랜치 · 커밋 · PR 컨벤션

- **브랜치**: `feat/<slug>` · `fix/<slug>` · `chore/<slug>` — 항상 최신 `main`에서 딴다. 이슈 1개 = 브랜치 1개.
- **커밋**: `Feat: …` / `Fix: …` / `Chore: …` / `Docs: …` — 본문은 한국어로 무엇을·왜.
- **PR**:
  - 본문에 반드시 **`Closes #<이슈번호>`** — merge 시 이슈 자동 종료.
  - 영역 라벨은 labeler가 자동 부착, 리뷰어는 CODEOWNERS가 자동 지정.
  - 본문에 변경 요약 + 검증 방법(돌려본 명령·결과)을 적는다.
- **review · merge는 사람이 한다.** AI는 merge하지 않는다.

## 스킬 사용법

| 스킬 | 하는 일 |
|---|---|
| `/ddalkak:issue <설명>` | 대화 맥락·버그 발견 내용을 컨벤션에 맞는 이슈로 등록 (라벨·배정 포함) |
| `/ddalkak:hunt [이슈번호]` | 내게 배정된 이슈를 골라 브랜치 → 구현 → 검증 → `Closes #N` PR까지 자동 진행 |

번호 없이 `/ddalkak:hunt`만 치면 내게 배정된 열린 이슈 중 하나를 골라 잡는다. PR이 merge되면 다시 `/ddalkak:hunt` — 이게 자동사냥이다.
