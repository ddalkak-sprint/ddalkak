# Codex Prompt: finalize

verify 산출물을 읽어 최종 구현율과 남은 불일치를 정리한다.

## Rules
- `../skills/finalize/SKILL.md`를 따른다.
- 공식 구현율은 `visual.json.implementationRate`다. 없을 때만 `confidence * 100`으로 fallback한다.
- fail/conditional이어도 `visual.json`이 있으면 final 산출물을 남긴다.

## Run
```bash
node scripts/finalize-report.mjs --project <project> --name <name>
```

## Output
- `.ddalkak/reports/<name>.final.json`
- `.ddalkak/reports/<name>.final.md`
