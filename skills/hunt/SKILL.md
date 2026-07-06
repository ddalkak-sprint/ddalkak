---
name: hunt
description: 자동사냥 — 내게 배정된 GitHub 이슈를 골라 브랜치 생성 → 구현 → 검증 → "Closes #N" PR 생성까지 자동 진행한다. "이슈 잡아줘", "#N 처리해", "자동사냥 돌려"에 사용. review와 merge는 사람이 한다.
---

# 자동사냥 — 배정 → 구현 → PR

배정된 이슈 하나를 잡아 PR까지 끝낸다. 컨벤션 SSOT: 프로젝트 루트 `AGENT.md` — 먼저 읽는다.

## 입력

- (선택) 이슈 번호. 없으면 `gh issue list --assignee @me --state open`에서 고른다
  — 여러 개면 목록을 보여주고 사용자에게 고르게 한다.

## 절차

1. **이슈 파악** — `gh issue view <N>` 으로 본문·코멘트를 읽고 할 일과 완료 기준을 확정한다.
   본문이 모호해서 구현 방향이 갈리면 시작 전에 사용자에게 확인한다.
2. **작업 트리 확인** — `git status`가 dirty면 중단하고 보고한다 (남의 변경을 커밋에 섞지 않는다).
3. **브랜치** — 최신 main 기준:
   ```bash
   git fetch origin main
   git switch -c <feat|fix|chore>/<slug> origin/main
   ```
4. **구현** — 이슈에 적힌 범위만. 관련 규칙 문서(`shared/*-rules.md`, `shared/pipeline.md`)와
   기존 코드 스타일을 따른다.
   - 도중에 **범위 밖 버그를 발견하면 고치지 말고** `/ddalkak:issue`로 등록만 한다 (AGENT.md 원칙 2).
5. **검증** — 변경이 실제로 동작하는지 확인하고 결과를 기록한다:
   - 스킬/규칙 변경 → sandbox에서 해당 스킬 실행해 산출물 확인
   - 브릿지 산출물 → `node scripts/validate-bridge.mjs <path>`
   - 샌드박스 코드 → `cd sandbox && npm run dev` 렌더 확인
   - `shared/examples/` 포맷이 바뀌면 예시도 같이 갱신 (GUIDE.md 규칙 1)
6. **커밋** — `Feat:`/`Fix:`/`Chore:`/`Docs:` 프리픽스, 한국어로 무엇을·왜.
7. **PR**:
   ```bash
   git push -u origin <브랜치>
   gh pr create --title "<커밋 제목과 동일>" --body "<요약 + 검증 방법/결과 + Closes #<N>>"
   ```
   - `Closes #<N>` 필수. 라벨은 labeler, 리뷰어는 CODEOWNERS가 자동 처리.
8. **보고** — PR URL, 검증 결과, 다음 배정 이슈가 남아 있으면 목록을 알려준다.

## 규칙

- **merge는 하지 않는다.** review·merge는 사람 몫이다.
- 이슈 1개 = 브랜치 1개 = PR 1개. 여러 이슈를 한 PR에 섞지 않는다.
- 완료 기준을 충족 못 한 채 PR을 올려야 하면 PR 본문에 남은 일을 명시하고 Draft로 올린다.
