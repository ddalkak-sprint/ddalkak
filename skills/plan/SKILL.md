---
name: plan
description: 디자인 브릿지(JSON)를 읽어 코드 생성 계획서 plan.md를 만든다. 컴포넌트 분해, 파일 구조, 구현 순서를 정리한다. 딸깍 파이프라인 2단계, 또는 사용자가 bridge JSON으로 계획을 세울 때 사용.
---

# [2] plan.md 생성  (퓨리)

브릿지 JSON을 입력으로 **무엇을 어떻게 만들지** 계획서를 산출한다.
있으면 `design.md` 컨벤션을 반영한다.

## 입력
- `.ddalkak/bridge/<name>.bridge.json`
- (선택) 프로젝트 루트 `design.md`

## 출력
- `.ddalkak/plan/<name>.plan.md` (템플릿: `${CLAUDE_PLUGIN_ROOT}/skills/plan/reference/plan.template.md`)

## plan.md에 담기는 것
- 화면/컴포넌트 트리 분해
- 생성/수정할 파일 목록과 경로
- 디자인 토큰 → 코드 매핑
- 구현 순서 및 의존성

<!-- TODO: 브릿지 노드 → 컴포넌트 매핑 규칙 채우기 -->
