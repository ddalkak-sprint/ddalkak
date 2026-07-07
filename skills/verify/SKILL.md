---
name: verify
description: 생성된 코드가 Figma 디자인과 같은지 LLM 없이 정적 visual verification engine으로 검증한다. Playwright 캡처, 기준 screenshot 픽셀 diff, bridge bbox 영역별 mismatch로 판정하고, DOM computed style check는 advisory evidence로 리포트한다. 딸깍 파이프라인 4단계, 또는 사용자가 구현이 디자인과 맞는지 확인할 때 사용.
---

# [4] 검증 (code ↔ figma)  (글랜·렉스)

구현 결과가 원본 디자인과 일치하는지 **LLM 판단 없이** 확인한다.
verify는 검증 센서다. 후속 LLM/fix-agent가 `visual.json`과 `diff.png`를 읽고 수정 후보를 추론할 수는 있지만,
pass/fail 산출에는 관여하지 않는다. v2 style check도 gate가 아니라 advisory evidence다.

- 엔진: `${CLAUDE_PLUGIN_ROOT}/scripts/visual-verify/cli.mjs`
- 입출력 계약: `${CLAUDE_PLUGIN_ROOT}/shared/visual-verify.md`
- 브릿지 스키마 SSOT: `${CLAUDE_PLUGIN_ROOT}/shared/bridge.schema.json`
- 단계 계약 SSOT: `${CLAUDE_PLUGIN_ROOT}/shared/pipeline.md`

## 입력
- 프로젝트 루트. 기본은 현재 작업 디렉토리.
- `.ddalkak/ddalkak.config.json`의 `name`, 또는 명시 인자 `--name`.
- `.ddalkak/bridge/<name>.bridge.json`.
- bridge의 `screen.screenshot`이 가리키는 baseline screenshot 파일.
- 렌더 가능한 URL. sandbox 기본값은 `http://localhost:5173`.

## 동작
1. bridge에서 screen/frame/screenshot asset을 결정한다. `desktop` breakpoint 우선, 없으면 첫 screen.
2. baseline screenshot이 없으면 실패한다. Figma MCP 호출, fixture 자동 탐색, 렌더 기반 baseline 생성은 하지 않는다.
3. Playwright Chromium으로 지정 URL을 bridge frame 크기와 `deviceScaleFactor: 1`로 캡처한다.
4. baseline/render 크기가 frame과 정확히 일치하는지 확인한다. v1에서는 자동 resize를 금지한다.
5. `pixelmatch`로 전체 mismatch/confidence와 diff PNG를 만든다.
6. bridge node `bbox`를 화면 좌표로 변환해 영역별 mismatch를 집계한다.
7. DOM snapshot을 수집하고 bridge node와 deterministic하게 매칭해 advisory computed style checks를 만든다.
8. `visual.json`과 사람용 `verify.md`를 `.ddalkak/reports/`에 기록한다.

## 실행
```bash
npm run visual:verify -- \
  --project . \
  --name <name> \
  --url http://localhost:5173
```

sandbox에서는:
```bash
npm run visual:verify -- --project sandbox --name login-page --url http://localhost:5173
```

엔진 판정 계약 자체를 확인하려면:
```bash
npm run test:visual:engine
```

## 판정
- `pass`: 전체 confidence ≥ 0.995, 영역 mismatch ≥ 0.03 없음.
- `conditional`: 전체 confidence ≥ 0.98 또는 영역 mismatch 0.03 이상.
- `fail`: 전체 confidence < 0.98 또는 영역 mismatch 0.10 이상.
- exit code `0`: pass, `1`: conditional/fail, `2`: 실행·설정 오류.

## 출력
- `.ddalkak/reports/<name>.<breakpoint>.baseline.png`
- `.ddalkak/reports/<name>.<breakpoint>.render.png`
- `.ddalkak/reports/<name>.<breakpoint>.diff.png`
- `.ddalkak/reports/<name>.<breakpoint>.visual.json`
- `.ddalkak/reports/<name>.verify.md`

`visual.json`에는 v2부터 `version: "2.0"`, `statuses`, `matches`, `checks`가 포함된다.
`status`, `passed`, exit code는 pixel/region gate만 따르며, `checks.gating`은 `false`다.

## 원칙
- verify는 소스 코드를 수정하지 않는다.
- verify는 LLM/비전 모델 판단을 사용하지 않는다.
- fail/conditional 결과는 code/fix 루프의 입력일 뿐, 수정 책임은 verify가 갖지 않는다.
- pixel diff는 gate signal이고, style check는 root cause 확정기가 아닌 advisory evidence다.
