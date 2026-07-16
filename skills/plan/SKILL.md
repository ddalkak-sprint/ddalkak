---
name: plan
description: 디자인 브릿지(JSON)를 읽어 코드 생성 계획서 plan.md를 만든다. 컴포넌트 분해, 파일 구조, 디자인 토큰 매핑, 구현 순서를 정리한다. 딸깍 파이프라인 2단계, 또는 사용자가 bridge JSON으로 계획을 세울 때 사용.
---

# [2] plan.md 생성

브릿지 JSON을 입력으로 **무엇을 / 어디에 / 어떤 순서로** 만들지 계획서를 산출한다.
있으면 `design.md` 팀 컨벤션을 반영한다. plan.md는 다음 단계(code)의 입력이자,
사용자가 **검토하는 게이트 문서**다 — 코드를 미리 쓰지 말고 계획만 명확히 적는다.

- 노드→컴포넌트 매핑 규칙 SSOT: `${CLAUDE_PLUGIN_ROOT}/shared/plan-rules.md`
- 브릿지 스키마 SSOT: `${CLAUDE_PLUGIN_ROOT}/shared/bridge.schema.json`
- 단계 계약 SSOT: `${CLAUDE_PLUGIN_ROOT}/shared/pipeline.md`

## 입력
- `.ddalkak/bridge/<name>.bridge.json` (필수)
- (선택) 프로젝트 루트 `design.md` — 팀 컨벤션. 없으면 기본 베이스(React 18 + TS + Tailwind) 가정 (plan-rules §8)

## 출력
- `.ddalkak/plan/<name>.plan.md`
  - 골격 템플릿: `${CLAUDE_PLUGIN_ROOT}/skills/plan/reference/plan.template.md`
  - 작성 예시: `${CLAUDE_PLUGIN_ROOT}/shared/examples/login-page.plan.md`
- `<name>`은 입력 브릿지 파일명을 그대로 승계 (plan-rules §1)

## 절차
1. 브릿지 JSON 로드 → `tokens` / `screens` / `assets` 파악. `design.md` 있으면 함께 읽어 컨벤션 확정 (§8).
2. screen → 페이지 컴포넌트 매핑, 노드 트리 순회하며 노드→코드 타깃 매핑 (§1·§2).
3. `component` 노드는 재사용(import) vs 신규 생성 판별 (§3), 중복 인스턴스는 축약 (§6).
4. 토큰→코드 매핑 계획 (§4), 반응형 `variantGroup`이 있으면 하나의 컴포넌트+반응형으로 계획 (§5).
5. **인터랙션 & 상태 전환 도출 (§11)**: 상태 variant·프로토타입 reaction으로 "무엇을 누르면 무엇이 되는지"를 표로. 트리거·조건이 불명확하면 추측 말고 §13으로.
6. **기존 소스 통합 스캔 (§12)**: 이 화면이 건드리는 기존 화면·라우트·API·l10n·**테스트**를 찾아 대체/수정/공존/신규 판정 + 회귀 경계(보존할 동작·Key·테스트) 명시. 그린필드면 "해당 없음".
7. 에셋 배치 계획 (§9), 의존성 기준 구현 순서 도출 (§7). 템플릿 골격을 채워 plan.md 저장 (§10).
8. **자동 검증**: `node ${CLAUDE_PLUGIN_ROOT}/scripts/validate-plan.mjs <plan.md> <bridge.json>`을 실행한다.
   - error가 나오면(구조·커버리지 위반) 고쳐서 다시 저장하고 재검증한다 — error를 남긴 채 넘어가지 않는다.
   - 완결성 경고(토큰/raw 값이 표에 없음 등)는 plan-rules §4의 결정론 게이트이므로, 지적된 값을 토큰 매핑 표에 채워 없앤다.
     남길 수밖에 없는 경고는 "결정·추가정보 요청"(⚠)에 사유를 적는다.
9. **사용자 게이트 (§13)**: ⚠(결정·추가정보 요청) 항목이 있으면 **구체적 선택지로** 사용자에게 묻고 답을 받아 "✅ 확정"으로 바꾼 뒤에 code로 넘어간다(gated). ⚠가 비어야 code 게이트가 열린다.
10. 사용자에게 요약 보고(컴포넌트 수, 파일 수, 재사용/신규, 인터랙션·브라운필드 요지, 검증 결과, **미해결 ⚠ 목록**).
