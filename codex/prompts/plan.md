# Codex Prompt: plan

`.ddalkak/bridge/<name>.bridge.json`을 읽어 `.ddalkak/plan/<name>.plan.md`를 만든다.

## Rules
- `../skills/plan/SKILL.md`와 `../shared/plan-rules.md`를 따른다.
- bridge 값을 새로 해석해 바꾸지 않는다. plan은 code가 복사할 수 있는 코드 표현을 최대한 결정한다.

## Gate
```bash
node scripts/validate-plan.mjs <project>/.ddalkak/plan/<name>.plan.md <project>/.ddalkak/bridge/<name>.bridge.json
```
