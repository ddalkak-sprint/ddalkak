---
name: code
description: plan.md를 읽어 실제 코드를 생성한다. 파일 계획·구현 순서를 따르고, 컴포넌트 재사용을 우선하며 디자인 토큰을 코드 스타일로 매핑한다. 있으면 design.md 팀 컨벤션을 따르고 없어도 동작한다. 딸깍 파이프라인 3단계, 또는 사용자가 plan.md로 구현을 요청할 때 사용.
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

## 절차
1. plan.md 로드 → 파일 계획·구현 순서·토큰 매핑 파악. design.md로 스택 확정 (code-rules §1).
2. 구현 순서대로 진행: 토큰/설정 → 잎 컴포넌트 → 상위·페이지 조립 → 에셋 → 레이아웃 확인 (§2).
3. `mappedCodeComponent`/재사용 표기 컴포넌트는 import, 신규 표기만 작성 (§3). 토큰은 매핑 표대로 구현 (§4).
4. 노드/레이아웃을 흐름 레이아웃 JSX로 구현(bbox는 참조값), 에셋 배치 (§5·§6), 컴포넌트 작성 규칙 준수 (§7).
5. 타입 체크/빌드 확인 → 생성·수정 파일 목록, 렌더 방법(`npm run dev`), 다음 단계(verify)를 사용자에게 보고 (§9).
