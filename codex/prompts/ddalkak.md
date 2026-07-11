# Codex Prompt: ddalkak

실제 Figma URL에서 최종 구현율까지 닫는 전체 파이프라인을 실행한다.

## Sequence
1. bridge: Figma URL → `.ddalkak/bridge/<name>.bridge.json`
2. plan: bridge → `.ddalkak/plan/<name>.plan.md`
3. code: plan → project source
4. static gate: `validate-bridge`, `validate-plan`, `validate-code`
5. verify: rendered URL → `.ddalkak/reports/<name>.<breakpoint>.visual.json`
6. finalize: visual JSON → `.final.json`, `.final.md`

## Thin Runner
이미 산출물이 준비된 프로젝트에서는 다음 명령으로 4~6단계를 연결한다.

```bash
node scripts/ddalkak-run.mjs --project <project> --name <name> --url <render-url>
```

`validate-code`가 실패하면 verify로 넘어가지 않는다. verify가 fail/conditional이어도 `visual.json`이 생성됐으면 finalize까지 실행해 최종 구현율을 남긴다.
