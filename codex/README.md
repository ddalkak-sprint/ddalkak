# Codex 미러

Claude Code 스킬(`../skills/`)의 파이프라인 계약을 Codex에서 실행할 수 있게 연결한 미러다.

- `prompts/` — 단계별 Codex 프롬프트 (ddalkak / bridge / plan / code / verify / finalize)
- `AGENTS.md` — Codex 실행 규칙

브릿지 스키마 등 공유 스펙은 `../shared/`를 단일 진실 소스로 재사용한다. Codex 프롬프트는 새 스펙을 만들지 않고 기존 계약과 실행 게이트를 연결한다.
