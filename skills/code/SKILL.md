---
name: code
description: plan.md를 읽어 실제 코드를 생성한다. 파일 계획·구현 순서를 따르고, 컴포넌트 재사용을 우선하며 디자인 토큰을 코드 스타일로 매핑한다. 있으면 design.md 팀 컨벤션을 따르고 없어도 동작한다. verify 리포트가 있으면 짚어진 불일치만 규칙대로 고치는 fix 모드로도 동작한다. 딸깍 파이프라인 3단계, 또는 사용자가 plan.md로 구현을 요청하거나 verify 결과를 반영해달라 할 때 사용.
---

# [3] code 추출  (퓨리)

`plan.md`를 **이미 사용자 검토를 통과한 실행 계획**으로 삼아 파일을 생성/수정한다.
새로 설계하지 말고 plan을 충실히 구현한다 — plan과 어긋나면 임의로 벗어나지 말고 사용자에게 알린다.

- 코드 생성 규칙 SSOT: `${CLAUDE_PLUGIN_ROOT}/shared/code-rules.md`
- 계획 산출 규칙(참고): `${CLAUDE_PLUGIN_ROOT}/shared/plan-rules.md`
- 단계 계약 SSOT: `${CLAUDE_PLUGIN_ROOT}/shared/pipeline.md`

## 입력
- `.ddalkak/plan/<name>.plan.md` (필수)
- (선택) 프로젝트 루트 `design.md` — 팀 컨벤션(스택/네이밍/구조/토큰 전략). 없으면 기존 패턴 추론 → 기본 베이스(React 18 + TS + Tailwind)
- (필요 시) `.ddalkak/bridge/<name>.bridge.json` — 토큰 원값·content 등 확인용

## 출력
- 프로젝트 소스 파일 (plan "파일 계획" 표의 파일만 생성/수정)

## 모드 판별
- 기본(생성): plan.md를 실행 계획으로 삼아 파일을 만든다 (아래 절차).
- **fix 모드**: `.ddalkak/reports/<name>.<breakpoint>.visual.json`이 있고 사용자가 verify 결과 반영을 원하면,
  새로 생성하지 말고 리포트가 짚은 불일치만 규칙대로 되돌린다 (code-rules §10). 오케스트레이터의 수렴 루프도 이 모드를 호출한다.

## 절차 (생성)
1. plan.md 로드 → 파일 계획·구현 순서·토큰 매핑 파악. design.md로 스택 확정 (code-rules §1).
2. 한 컨텍스트에서 구현 순서대로 진행: 토큰/설정 → 잎 컴포넌트 → 상위·페이지 조립 → 에셋 → 레이아웃 확인 (§2·§11).
3. `mappedCodeComponent`/재사용 표기 컴포넌트는 import, 신규 표기만 작성 (§3). 토큰은 매핑 표대로 구현 (§4).
4. 노드/레이아웃을 흐름 레이아웃 JSX로 구현(bbox는 참조값), 에셋 배치 (§5·§6), 컴포넌트 작성 규칙 준수 (§7).
5. **타입 체크**가 필수 게이트(§9) — full 프로덕션 빌드는 반복 게이트에서 생략.
6. **정적 게이트**: `node ${CLAUDE_PLUGIN_ROOT}/scripts/validate-code.mjs <plan.md>` 실행(§9). error는 고쳐 재실행하고,
   warning으로 나온 `.ddalkak/reports/<name>.code-gaps.json`(plan에 없어 즉석 환산한 값)은 plan 완결성 피드백으로 남긴다.
7. 생성·수정 파일 목록, data-dk 커버리지·gap 목록, 렌더 방법(`npm run dev`), 다음 단계(verify)를 사용자에게 보고.

## 절차 (fix — code-rules §10)
1. `.ddalkak/reports/<name>.<breakpoint>.visual.json` 로드 → `checks.items[]`에서 `status: "fail"` 항목 수집 (§10-1).
2. 각 항목의 `nodePath`로 `matches[]`를 조인해 `dkPath`·`strategy` 확보. `data-dk-exact`인 것만 자동 수정 대상,
   나머지는 제외 목록에 담는다 (§10-2·§10-4).
3. `data-dk="<dkPath>"` 요소를 특정해 짚어진 속성 **1개만** `expected` 목표로 규칙대로 교체 (§10-3). 새 설계 금지.
4. 빌드(§9) → verify 재실행으로 해당 항목 해소 확인. 개선 없이 2회 연속 실패면 중단 (§10-4).
5. 고친 항목·수정 파일·재검증 결과와 **제외한 항목·사유**를 보고 (§10-5).
