---
name: design-md
description: 프로젝트의 팀 컨벤션 파일 design.md를 추출·확인한다. 이미 있으면 읽어서 요약하고, 없으면 템플릿으로 생성한다. 사용자가 "design.md 만들어줘/추출해줘", 또는 딸깍 파이프라인 0단계에서 사용.
---

# [0] design.md 추출/생성  (오픈소스)

design.md는 코드 생성 시 따라야 할 **팀 컨벤션**(디렉토리 구조, 네이밍, 컴포넌트
규칙, 스타일 시스템 등)을 담는다. 없어도 파이프라인은 진행 가능하다.

## 동작
1. 프로젝트 루트에서 `design.md` 존재 확인.
2. 있으면 → 핵심 컨벤션을 요약해 사용자에게 보고.
3. 없으면 → `reference/design.md.template` 기반으로 초안 생성 후 사용자 검토 요청.

## 참고
- 원본 컨벤션 포맷: https://github.com/google-labs-code/design.md
- 템플릿: `${CLAUDE_PLUGIN_ROOT}/skills/design-md/reference/design.md.template`

<!-- TODO: 기존 코드베이스에서 컨벤션을 자동 추론하는 로직 채우기 -->
