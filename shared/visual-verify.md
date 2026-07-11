# 딸깍 visual verify engine 입출력 계약

LLM 판단 없이 baseline screenshot과 렌더 screenshot을 비교하고, DOM computed style을 advisory evidence로 기록하는 결정론적 검증 엔진이다.
엔진은 Figma MCP를 호출하지 않고, 소스 코드를 수정하지 않으며, pass/fail 산출에 LLM이나 비전 모델을 사용하지 않는다.

이 엔진은 **검증 센서**다. `visual.json`, `diff.png`, `verify.md`를 후속 LLM/fix-agent가 읽고 수정 후보를 추론할 수는 있지만,
그 추론은 검증 결과가 아니다. 공식 gate 결과는 pixel confidence와 bridge bbox region mismatch로만 정한다.

## 모듈 API

```js
import { runVisualVerify, exitCodeForResult } from "./scripts/visual-verify/index.mjs";

const result = await runVisualVerify({
  project: "sandbox",
  name: "login-page",
  url: "http://127.0.0.1:5173",
  screen: "desktop",
  selector: "body",
  output: ".ddalkak/reports",
  pass: 0.995,
  conditional: 0.98,
  "pixel-threshold": 0.1
});
process.exit(exitCodeForResult(result));
```

## CLI

```bash
node scripts/visual-verify/cli.mjs \
  --project <project-root> \
  --name <screen-name> \
  --url <render-url> \
  [--screen desktop|mobile|default] \
  [--selector body] \
  [--output .ddalkak/reports] \
  [--pass 0.995] \
  [--conditional 0.98] \
  [--pixel-threshold 0.1]
```

엔진 자체가 실제로 판정 계약을 지키는지 확인하려면:

```bash
npm run test:visual:engine
```

이 테스트는 임시 프로젝트를 만들고 pixel pass, pixel fail, style advisory fail, selector error, missing baseline error를 검증한다.

## 입력

| 필드 | 필수 | 기본값 | 의미 |
|---|---:|---|---|
| `project` | 아니오 | 현재 작업 디렉토리 | 대상 프로젝트 루트 |
| `name` | 아니오 | `.ddalkak/ddalkak.config.json.name` | bridge 파일명과 화면 이름 |
| `url` | 예 | sandbox만 `http://localhost:5173` | 렌더 캡처 URL |
| `screen` | 아니오 | `desktop` breakpoint 우선, 없으면 첫 screen | 비교할 bridge screen |
| `selector` | 아니오 | `body` | v2.0은 `body`만 지원. 다른 값은 exit `2` |
| `output` | 아니오 | `.ddalkak/reports` | artifact 출력 폴더 |
| `pass` | 아니오 | `0.995` | pass confidence 기준 |
| `conditional` | 아니오 | `0.98` | conditional confidence 기준 |
| `pixel-threshold` | 아니오 | `0.1` | pixelmatch threshold |

## bridge 요구사항

- `.ddalkak/bridge/<name>.bridge.json`이 있어야 한다.
- 선택된 screen은 `frame.w`, `frame.h`, `screenshot`을 가져야 한다.
- `screen.screenshot`은 `assets[].id` 중 하나를 가리켜야 한다.
- 해당 asset은 `export` 파일이 실제 존재해야 한다.

baseline이 없으면 엔진은 exit `2`로 실패한다. v1에서는 fixture 자동 탐색, Figma MCP live 호출, 렌더 결과 기반 baseline 생성을 금지한다.

## 출력

엔진은 `<output>/<name>.<breakpoint>.*`와 `<output>/<name>.verify.md`를 쓴다.

```text
.ddalkak/reports/<name>.<breakpoint>.baseline.png
.ddalkak/reports/<name>.<breakpoint>.render.png
.ddalkak/reports/<name>.<breakpoint>.diff.png
.ddalkak/reports/<name>.<breakpoint>.visual.json
.ddalkak/reports/<name>.verify.md
```

`visual.json` 계약:

```json
{
  "name": "login-page",
  "screen": "desktop",
  "status": "fail",
  "passed": false,
  "version": "2.0",
  "confidence": 0.99453,
  "implementationRate": 99.453,
  "statuses": {
    "pixel": "fail",
    "style": "fail"
  },
  "thresholds": {
    "pass": 0.995,
    "conditional": 0.98,
    "pixelmatch": 0.1
  },
  "pixels": {
    "total": 1296000,
    "mismatch": 7089,
    "mismatchRatio": 0.00547
  },
  "viewport": {
    "width": 1440,
    "height": 900
  },
  "artifacts": {
    "baseline": ".ddalkak/reports/login-page.desktop.baseline.png",
    "actual": ".ddalkak/reports/login-page.desktop.render.png",
    "diff": ".ddalkak/reports/login-page.desktop.diff.png",
    "visual": ".ddalkak/reports/login-page.desktop.visual.json",
    "report": ".ddalkak/reports/login-page.verify.md"
  },
  "source": {
    "bridge": ".ddalkak/bridge/login-page.bridge.json",
    "baseline": ".ddalkak/assets/login-page/desktop.png",
    "url": "http://127.0.0.1:5173",
    "selector": "body"
  },
  "regions": [
    {
      "id": "login-page/LoginCard/email-field",
      "name": "email-field",
      "type": "instance",
      "bbox": [520, 348, 320, 76],
      "confidence": 0.958388,
      "mismatchRatio": 0.041612,
      "severity": "minor",
      "pixels": {
        "total": 24320,
        "mismatch": 1012
      }
    }
  ],
  "anchors": {
    "gating": false,
    "summary": {
      "bridge": 8,
      "dom": 7,
      "exact": 6,
      "missing": 2,
      "duplicate": 0,
      "unknown": 1
    },
    "duplicates": [],
    "missing": [
      {
        "dkPath": "children[0].children[4]",
        "nodePath": "login-page/LoginCard/password-field",
        "nodeType": "instance"
      }
    ],
    "unknown": [
      {
        "dataDk": "children[99]",
        "domIds": ["element:12"]
      }
    ]
  },
  "matches": [
    {
      "nodeId": "login-page/LoginCard/email-field",
      "nodePath": "login-page/LoginCard/email-field",
      "nodeName": "email-field",
      "nodeType": "instance",
      "matched": true,
      "domId": "element:7",
      "domKind": "element",
      "tag": "label",
      "dkPath": "children[0].children[3]",
      "dataDk": "children[0].children[3]",
      "text": "이메일",
      "bbox": [560, 348, 320, 72],
      "confidence": 1,
      "strategy": "data-dk-exact"
    }
  ],
  "checks": {
    "gating": false,
    "summary": { "total": 32, "pass": 24, "warn": 1, "fail": 7 },
    "items": [
      {
        "id": "login-page/LoginCard/email-field:geometry.height",
        "nodePath": "login-page/LoginCard/email-field",
        "kind": "geometry.height",
        "expected": 76,
        "actual": 72,
        "delta": -4,
        "tolerance": 2,
        "status": "fail",
        "severity": "minor"
      }
    ]
  }
}
```

## 판정

- `pass`: 전체 confidence가 `pass` 이상이고, mismatch `0.03` 이상인 region이 없다.
- `conditional`: 전체 confidence가 `conditional` 이상이거나, mismatch `0.03` 이상인 region이 있다.
- `fail`: 전체 confidence가 `conditional` 미만이거나, mismatch `0.10` 이상인 region이 있다.

`status`, `passed`, exit code는 위 pixel/region gate만 따른다.
`statuses.style`과 `checks.items[]`는 advisory evidence이며 최종 gate를 바꾸지 않는다.

픽셀 diff는 root cause 확정기가 아니다. 예를 들어 한 요소 높이 차이가 아래 영역을 밀면 주변 region도 mismatch로 잡힌다.
v2는 DOM/computed-style checks로 더 직접적인 수치 증거를 추가하지만, gate가 아니며 원인 "추론"도 하지 않는다.

Exit code:

- `0`: pass
- `1`: conditional 또는 fail
- `2`: 설정/실행 오류

## sandbox baseline

`shared/examples/assets/login-page/*.png`는 visual verify 엔진 실험용 synthetic baseline이다.
실제 제품 검증에서는 bridge 단계가 캡처한 Figma screenshot asset을 사용해야 한다.

## v2 style checks

v2는 Playwright 캡처 시점에 visible DOM element/text node의 bbox와 computed style을 수집한다.
DOM에 `data-dk`가 있으면 bridge node의 index path(`children[0].children[i]`)와 exact match를 먼저 수행한다.
`data-dk`가 없을 때만 text, bbox IoU, center distance, element kind 기반 fallback 매칭을 사용한다.
`anchors`는 `data-dk` 품질을 보는 advisory diagnostics다. duplicate/unknown/missing anchor는 code 단계 피드백 신호이며,
`status`, `passed`, exit code를 바꾸지 않는다.
`implementationRate`는 최종 구현율 공식 입력이며 `confidence * 100`을 소수점 셋째 자리까지 반올림한 값이다.
매칭 confidence가 낮은 항목은 check 가능한 기대값이 있는 경우에만 advisory warning으로 남긴다.
`image`, `vector`, style 없는 decorative node처럼 DOM 1:1 매칭이 불안정한 항목은 `matches`에는 남기되 check noise는 만들지 않는다.

기본 tolerance:

- position: `2px`
- size: `2px`
- color channel delta: `3`
- font size: `1px`
- font weight: exact
- border radius: `1px`

검사 범위:

- geometry: `x`, `y`, `width`, `height`
- typography: `fontSize`, `fontWeight`, `lineHeight`, `color`
- fill/stroke/radius: `backgroundColor`, `borderColor`, `borderWidth`, `borderRadius`
- text run: `runs[].text`별 color/font
