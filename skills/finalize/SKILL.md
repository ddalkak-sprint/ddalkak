---
name: finalize
description: 검증 리포트를 바탕으로 파이프라인을 마무리한다. 남은 불일치 수정 여부를 확인하고, 산출물을 정리하며 최종 요약을 낸다. 딸깍 파이프라인 5단계에서 사용.
---

# [5] 마무리 검증  (글랜·렉스)

파이프라인을 닫는 단계. verify가 만든 `visual.json`을 기준으로 최종 구현율과 남은 불일치를 고정 포맷으로 정리한다.

## 입력
- `.ddalkak/reports/<name>.<breakpoint>.visual.json`
- 보조 확인용 `.ddalkak/reports/<name>.verify.md`

## 동작
1. `visual.json.implementationRate`를 최종 구현율로 사용한다. 없으면 하위 호환을 위해 `confidence * 100`으로 계산한다.
2. `.ddalkak/reports/<name>.final.json`과 `.ddalkak/reports/<name>.final.md`를 생성한다.
3. 최종 산출물에는 판정, 구현율, pass/fail 기준, 주요 mismatch region, anchor coverage, 자동 수정 제외 후보를 포함한다.
4. fail/conditional이어도 finalize 산출물은 남긴다. 설정 오류로 `visual.json`이 없으면 실패한다.

## 실행
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/finalize-report.mjs --project <project> --name <name>
```
