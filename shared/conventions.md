# 딸깍 개발 컨벤션 (플러그인 자체)

- 스킬 이름 = 디렉토리 이름 = frontmatter `name` 일치.
- 스킬 간 공유 스펙은 이 `shared/`에만 둔다 (중복 금지). 스킬에서 `${CLAUDE_PLUGIN_ROOT}/shared/...`로 참조.
- 브릿지 스키마 변경 시: `shared/bridge.schema.json` 하나만 수정하면 전 단계 반영.
- Codex 미러는 `codex/`에 이식 (Claude 스킬 안정화 후).
- 산출물은 항상 대상 프로젝트 `.ddalkak/`에 저장. 플러그인 레포에는 저장하지 않는다.
