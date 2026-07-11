# Codex Mirror Instructions

이 디렉토리는 딸깍 파이프라인을 Codex에서 실행하기 위한 미러다.

## Source of Truth
- 단계 계약은 `../shared/pipeline.md`를 따른다.
- bridge 스키마는 `../shared/bridge.schema.json`을 따른다.
- plan/code/verify/finalize 세부 규칙은 `../shared/*`와 `../skills/*/SKILL.md`를 따른다.
- 이 디렉토리의 프롬프트는 새 스펙을 만들지 않고, 기존 계약을 Codex 실행 순서로 연결한다.

## Required Gates
- code 단계 후 verify 전에 반드시 `node scripts/validate-code.mjs <plan.md> <bridge.json> <projectRoot>`를 실행한다.
- `validate-code`가 실패하면 verify로 넘어가지 않는다.
- 최종 구현율은 `visual.json.implementationRate`를 사용한다. 없을 때만 `confidence * 100`으로 계산한다.
- 노드 단위 구현율은 공식 지표가 아니다. `data-dk` coverage는 보조 진단으로만 보고한다.

## Output Discipline
- 산출물은 대상 프로젝트의 `.ddalkak/` 아래에 둔다.
- verify가 fail/conditional이어도 `visual.json`이 있으면 finalize를 실행해 `.final.json`과 `.final.md`를 남긴다.
- 설정 오류로 `visual.json`이 없으면 finalize를 실행하지 않는다.
