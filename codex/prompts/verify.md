# Codex Prompt: verify

렌더된 앱과 Figma baseline screenshot을 비교해 `.ddalkak/reports/<name>.<breakpoint>.visual.json`을 만든다.

## Rules
- `../skills/verify/SKILL.md`와 `../shared/visual-verify.md`를 따른다.
- pass/fail은 pixel confidence와 region mismatch만 따른다.
- style checks와 anchor diagnostics는 advisory다.

## Run
```bash
npm run visual:verify -- \
  --project <project> \
  --name <name> \
  --url <render-url>
```

`visual.json.implementationRate`는 `confidence * 100`이다.
