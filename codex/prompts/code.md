# Codex Prompt: code

`.ddalkak/plan/<name>.plan.md`를 읽어 실제 프로젝트 소스를 생성하거나 수정한다.

## Rules
- `../skills/code/SKILL.md`와 `../shared/code-rules.md`를 따른다.
- plan의 파일 계획 범위 밖 파일을 수정하지 않는다.
- 브릿지 렌더 노드의 루트 요소에는 `data-dk`를 붙인다. 전면 누락은 차단 실패다.
- verify 리포트를 입력으로 받은 fix 모드에서도 `data-dk-exact`로 특정되는 항목만 자동 수정한다.

## Gate
```bash
node scripts/validate-code.mjs \
  <project>/.ddalkak/plan/<name>.plan.md \
  <project>/.ddalkak/bridge/<name>.bridge.json \
  <project>
```

`validate-code`가 실패하면 verify로 넘어가지 않는다.
