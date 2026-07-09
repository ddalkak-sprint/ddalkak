# Codex Prompt: bridge

Figma URL에서 `.ddalkak/bridge/<name>.bridge.json`을 만든다.

## Rules
- `../skills/bridge/SKILL.md`, `../shared/figma-extraction-rules.md`, `../shared/bridge.schema.json`을 따른다.
- 실제 제품 검증에서는 Figma screenshot asset을 bridge `assets[]`에 `kind: "screenshot"`으로 기록하고 파일을 `.ddalkak/assets/<name>/`에 저장한다.
- fixture나 렌더 결과로 baseline을 대체하지 않는다.

## Gate
```bash
node scripts/validate-bridge.mjs <project>/.ddalkak/bridge/<name>.bridge.json
```
