# 딸깍 데모 런북 — 구조·시나리오·데모 전 수정 목록

이 문서는 최종 데모 발표를 준비하며 파이프라인 전 영역을 오케스트레이션 감사(서브에이전트 69개, 발견 40건 반박검증)로 훑은 결과를 정리한 것입니다. 세 가지를 담습니다. 파이프라인이 실제로 어떻게 흘러가는지, 어떤 동선으로 데모하면 안전한지, 발표 전에 반드시 손봐야 할 지점이 무엇인지입니다.

감사 기준 시점은 2026-07-11, 브랜치는 `kgt_bridge`입니다.

---

## 0. 먼저 정할 것 — 데모할 아키텍처를 하나 고릅니다

감사 도중 가장 큰 변수가 드러났습니다. 코드↔디자인 매칭에 쓰는 `data-dk` 앵커 방식이 두 갈래로 갈라져 있습니다.

- `main`과 `kgt_bridge`(현재): 생성 코드에 `data-dk` 속성을 직접 붙여서 verify가 그 앵커로 매칭합니다. 확정 발견의 상당수(sandbox 앵커 0개, code 게이트 실패, fix 루프 0건 수정)가 전부 이 방식의 미완성 상태에서 나옵니다.
- `origin/feat/verify-observe`(미병합, main보다 7커밋 앞섬): `data-dk`를 **전면 폐지**하고 Babel 플러그인이 빌드 시 소스 위치를 자동 주입하는 방식으로 대체했습니다. verify-static 1,383줄을 삭제했고, 생성 코드를 더럽히지 않으면서 같은 목적을 달성합니다. 이 브랜치는 `main`에도 `kgt_bridge`에도 병합되지 않았습니다.

즉 확정 발견 40건 중 data-dk 관련 8~9건은 verify-observe를 병합하면 통째로 사라집니다. 따라서 발표 아키텍처를 먼저 정해야 손볼 목록이 확정됩니다.

권장은 **verify-observe를 데모 브랜치로 병합한 뒤 그 위에서 발표**하는 것입니다. 서사도 더 강합니다("앵커로 코드를 더럽히던 방식을 하루 만에 버리고 컴파일러 주입으로 갈아탔다"가 그대로 데모 스토리가 됩니다). 다만 그 브랜치의 verify-observe 엔진은 이번 감사 범위 밖이므로, 병합하기로 하면 그 엔진만 따로 한 번 리허설로 돌려봐야 합니다. verify-observe를 데모에 못 올린다면 아래 P0 목록의 data-dk 항목들을 반드시 손봐야 합니다.

---

## 1. 파이프라인이 흘러가는 구조

Figma URL 하나를 넣으면 여섯 단계가 이어 돌며 실제 렌더되는 코드까지 나옵니다. 단계 사이의 계약은 전부 파일로 고정돼 있어서, 앞 단계가 없어도 목업 파일만 있으면 각 단계를 독립 실행할 수 있습니다.

```
        design.md            bridge.json              plan.md                소스코드            verify.md
 [0] ─────────────▶ [1] ─────────────▶ [2] ─────────────▶ [3] ─────────────▶ [4] ─────────────▶ [5]
 design-md          bridge             plan               code               verify             finalize
 팀 컨벤션 추출      Figma→무손실 IR    코드 생성 계획     React+TS+Tailwind   픽셀 diff 검증     마무리·요약
                    (JSON)                                                        │
                                                                                  │ 불일치가 있으면
                                                                                  ▼
                                                              [3] code (fix 모드)로 짚어진 곳만 수정
                                                              → [4] 재검증  (통과 또는 2회 연속 무개선까지 반복)
```

단계별 입출력은 다음과 같습니다. 산출물은 전부 대상 프로젝트의 `.ddalkak/` 아래에 쌓입니다.

| 단계 | 스킬 | 입력 | 출력 |
|---|---|---|---|
| 0 | `design-md` | 프로젝트(실제로는 템플릿 생성) | `./design.md` |
| 1 | `bridge` | Figma URL + mode(section/page) | `.ddalkak/bridge/<name>.bridge.json` |
| 2 | `plan` | bridge.json + design.md | `.ddalkak/plan/<name>.plan.md` |
| 3 | `code` | plan.md + design.md, 또는 fix 모드 시 verify의 `visual.json` | 프로젝트 소스 파일 |
| 4 | `verify` | 코드 + bridge.json | `.ddalkak/reports/<name>.verify.md` (+ `<name>.<breakpoint>.visual.json`) |
| 5 | `finalize` | verify.md | 최종 요약 + config 완료 표기 |

핵심 설계 사상 네 가지가 데모의 셀링 포인트입니다.

첫째, MCP 호출 한도를 아끼는 골든 캡처 방식입니다. 누군가 한 번 실제로 뜬 Figma MCP 원시 응답을 `fixtures/figma/`에 캐시해두고, sha1 지문으로 소스가 안 변했으면 추출·교차검증을 통째로 스킵합니다. 재실행 시 bridge 단계가 수 분에서 0.4초로 줄고 MCP 호출은 0회가 됩니다.

둘째, LLM 없는 정적 검증입니다. verify는 LLM 판단이 아니라 Playwright 캡처 + pixelmatch 픽셀 diff + bridge bbox 영역별 mismatch로 판정하고, DOM computed style은 참고 증거로만 리포트합니다.

셋째, 각 단계 앞에 결정론적 게이트가 있습니다. validate-bridge(ajv 스키마 + 시맨틱 4종) → validate-plan(에러 9종 + 경고 10종) → validate-code + tsc → visual-verify로 이어지는 4단 게이트가 다음 단계로 넘기기 전에 산출물을 거릅니다.

넷째, 생성에서 멈추지 않고 수렴합니다. verify가 불일치를 짚으면 code를 fix 모드로 다시 돌려 짚어진 곳만 고치고 재검증하며, 통과하거나 개선 없는 반복이 2회 이어질 때까지 오케스트레이터가 이 루프를 조율합니다.

---

## 2. 데모 시나리오 — 안전한 동선

라이브 데모의 지뢰는 대부분 "환경 가정"에서 터집니다. 아래 동선으로 고정하면 감사에서 확인된 크래시를 거의 다 피합니다.

### 데모 환경 고정

레포 안 `sandbox/`를 대상 프로젝트로 씁니다. 외부 프로젝트를 즉석에서 대상으로 삼으면 경로 검사와 npm 스크립트 부재로 여러 명령이 깨집니다. 플러그인은 `--plugin-dir`로 레포를 직접 가리켜 로드하고, cwd는 레포 루트에 고정합니다.

### 데모 직전 준비 (리허설로 1회 실행해 산출물을 남겨둡니다)

1. 레포 루트에서 `npm install` — 검증기(ajv)와 Playwright가 이때 깔립니다.
2. `sandbox`에서 `npm install` 후 `npm run seed` — verify baseline 스크린샷(`.ddalkak/assets/login-page/`)이 이때 생성됩니다. 이걸 빼먹으면 verify 첫 실행이 baseline 없음으로 즉사합니다.
3. bridge 캐시 재생을 한 번 미리 돌려 `.ddalkak/assets`를 채워둡니다(원격 자산 URL이 만료되기 전에 로컬로 내려받아 고정하는 효과).
4. `sandbox`에서 `npm run dev`를 **미리 띄워둡니다**. auto 모드는 dev 서버를 스스로 켜지 않아서, 안 띄우면 verify에서 멈춥니다. 기본 포트 5173이 점유돼 있을 수 있으니 실제 뜬 포트를 verify에 넘길 URL로 확인합니다.

### 권장 발표 동선

전체를 `--auto`로 한 번에 돌리는 그림이 제일 세지만, 그건 위 준비가 완벽할 때만 안전합니다. 발표에서는 단계별 단독 실행으로 각 산출물을 보여주는 편이 통제하기 쉽습니다.

1. `/ddalkak:bridge`를 **캐시 재생(`--source cache`)** 으로 돌려 Figma 응답에서 무손실 JSON IR이 나오는 장면을 보여줍니다. 이때 반드시 완결 판정을 받는 캡처(`untitled-1-858`)를 씁니다. README 표에 적힌 `main` 캡처는 완결성 게이트에서 거부됩니다(3장 참고).
2. `/ddalkak:plan`으로 bridge JSON이 파일 계획·토큰 매핑·구현 순서로 풀리는 걸 보여줍니다. 예시 브릿지는 validate-plan을 경고 0건으로 통과하므로 안전합니다.
3. `/ddalkak:code`로 코드가 나오고 `npm run dev`에 렌더되는 걸 보여줍니다.
4. `/ddalkak:verify`로 픽셀 diff가 의도적 불일치 2건(TextField 높이 44 대 48, 회원가입 링크 색)을 잡아내는 장면을 보여줍니다. 이게 "LLM 없이 눈으로 대조한다"의 하이라이트입니다.
5. fix 모드 수렴 루프를 보여줄지는 아키텍처 결정(0장)에 달렸습니다. data-dk 방식(현재 브랜치)에서는 sandbox 앵커가 0개라 자동 수정이 0건으로 끝나므로, verify-observe로 데모하거나 이 시연은 생략합니다.

---

## 3. 데모 전 반드시 손볼 것 (P0)

감사에서 확정된 high 8건은 실제로는 네 개의 문제로 묶입니다. 전부 "데모 중 청중 앞에서 크래시"로 이어지는 것들입니다.

### P0-A. 캐시 재생 데모 경로가 깨져 있습니다

README `fixtures/figma/README.md`가 유일하게 안내하는 재생 캡처 `main`이 캐시 완결성 게이트에서 거부됩니다(`node scripts/mcp-cache.mjs check fixtures/figma/main`이 codeSummary leaf 3개 누락으로 exit 1). 안내대로 실행하면 파이프라인이 1단계에서 멈춥니다. 게다가 실제로 완결 판정을 받는 `untitled-1-858` 캡처는 README 표에 아예 없습니다.

여기에 더해 재생 자산이 7일 유효 원격 URL fetch에 의존합니다(`scripts/bridge-from-cache.mjs`). 캡처가 2026-07-09이므로 약 07-16 이후에는 자산 10개 다운로드가 실패합니다. 문서(`figma-extraction-rules.md` §10)는 "replay 때 cacheDir의 자산 사본을 복사한다"고 약속하지만 러너에 그 복사 로직이 없습니다.

손볼 것은 세 가지입니다. README 표에 `untitled-1-858`을 재생 기본 캡처로 올리고, 데모 전에 그 캡처를 한 번 재생해 `.ddalkak/assets`를 로컬로 고정하고, `main`을 계속 쓰려면 누락 leaf 3개(9:568, 9:579, 9:586)를 라이브로 보충 캡처합니다.

### P0-B. sandbox 시드 코드에 data-dk 앵커가 0개라 code 게이트가 실패합니다

`GUIDE.md`가 "기대 결과 예시"로 지정한 `sandbox/src` 전체에 data-dk가 하나도 없습니다. `node scripts/validate-code.mjs sandbox/.ddalkak/plan/login-page.plan.md`가 "렌더 노드 13개인데 앵커 0개" error로 exit 1을 냅니다. code-rules는 모든 렌더 노드에 앵커를 의무화하는데 공식 예시가 그 규칙을 어깁니다. 게다가 시드 config는 code 단계를 "done"으로 표기해, 앵커 없는 코드가 완료 산출물로 간주됩니다.

0장에서 verify-observe로 가기로 하면 이 문제 자체가 사라집니다. data-dk 방식으로 남긴다면 sandbox 컴포넌트에 규칙에 맞는 앵커를 채워 게이트를 통과시켜야 합니다.

### P0-C. verify baseline 스크린샷이 git에 없어 fresh clone에서 verify가 즉사합니다

verify가 대조할 기준 스크린샷 `sandbox/.ddalkak/assets/login-page/`가 git에 추적되지 않습니다(pc-home만 추적됨). 없으면 엔진이 exit 2로 죽습니다. `sandbox/README.md`와 verify SKILL은 "지울 것 없이 바로 verify"라고 안내하지만 fresh clone에서는 깨집니다.

데모 전 `npm run seed`를 1회 돌리면 복구됩니다. 근본 해결은 baseline을 커밋하거나 문서에 seed 선행 조건을 명시하는 것입니다.

### P0-D. auto 모드에 dev 서버 기동 단계가 없어 verify에서 멈춥니다

`skills/ddalkak/SKILL.md`의 auto 모드는 단계 사이 게이트만 없앨 뿐, verify가 필요로 하는 dev 서버를 어디서도 켜지 않습니다. "--auto 딸깍 한 번" 시연에서 서버를 미리 안 띄웠으면 verify가 exit 2로 멈춰, 자동이 수동 개입으로 끝납니다.

데모에서는 dev 서버 선기동으로 우회합니다. 근본 해결은 오케스트레이터가 verify 전에 dev 서버 기동·포트 확인을 책임지도록 하는 것입니다.

---

## 4. 데모 중 피해야 할 지뢰 (medium, 하면 터짐)

아래는 특정 행동을 할 때만 드러나는 것들입니다. 그 행동을 안 하면 안 터집니다.

- 외부 프로젝트를 대상으로 캐시 재생을 시연하면 `bridge-from-cache.mjs`의 cwd 경로 검사(`assertInside`)가 크래시합니다. 레포 안 sandbox로만 데모하면 안전합니다.
- replay로 뽑은 브릿지 JSON을 열어 "토큰 참조와 교차검증 기록이 이렇게 남습니다"라고 설명하면, 자동 러너가 tokens를 빈 객체로 두고 reconciliation을 검증 없이 "match"로 하드코딩한 게 노출됩니다. 이 설명은 LLM 추출 경로 산출물로 하거나 피합니다.
- 그리드형 목록·아바타 스택이 있는 디자인으로 라이브 bridge→plan을 돌리면, plan-rules에 `mode:"grid"`·`wrap` 처리 규칙이 없어 planner가 임의로 처리하고 verify에서 레이아웃 불일치가 납니다. 데모 디자인은 로그인 화면처럼 그리드가 없는 걸로 고정합니다.
- 일러스트·절대배치가 겹치는 디자인이면 plan이 존재하지 않는 `scripts/plan-extract.mjs`를 부르려다 좌표 표를 즉흥으로 만듭니다. 역시 데모 디자인 선택으로 회피합니다.
- 반응형(mobile breakpoint) 검증을 보여주면 data-dk 인덱스 경로가 breakpoint마다 달라 앵커 진단이 missing/unknown 투성이가 됩니다. desktop만 검증하거나 verify-observe로 갑니다.
- 규칙 문서를 화면에 띄우고 게이트를 함께 돌리면 문서와 도구가 어긋나는 장면이 몇 군데 있습니다. code-rules §9는 "data-dk 경로 오배치"를 error라 하지만 validate-code는 warning으로 통과시키고, pipeline.md 산출물 레이아웃에는 실제 존재하는 `.ddalkak/assets/`·`.ddalkak/mcp-cache/`가 빠져 있습니다. 문서를 띄울 거면 이 두 곳을 먼저 맞춰둡니다.

---

## 5. 데모 후 백로그 (low, 발표엔 영향 없음)

당장 데모를 막지는 않지만 정리하면 좋은 것들입니다. 예시 브릿지(`login-page.bridge.json`)가 자체 검증기에서 오토레이아웃 산술 경고 2건을 내고(mobile 루트가 hug 선언인데 자식 합과 bbox가 모순), 스키마에 `meta.sourceFingerprint`가 정의돼 있지 않으며(재사용 판정 핵심 필드), validate-plan이 text runs·배열형 cornerRadius를 완결성 검사에서 빠뜨리고, README 첫 화면이 아직 "사용법(예정)"으로 적혀 있으며, GUIDE가 브릿지 예시를 v2.0이라 하는데 실제 산출물은 전부 schemaVersion 2.1입니다. 이것들은 데모 후 이슈로 등록해 순차 처리하면 됩니다.

---

## 6. 발표 서사 — 무엇을 어떻게 이야기할지

이 프로젝트의 이야기는 "디자인을 코드로 옮기는 반복 작업을 딸깍 한 번으로"라는 목표를, 6일 스프린트에 커밋 약 50개·merge PR 16건으로 밀어붙인 과정입니다. 발표는 완성도 자랑보다 "무엇이 취약했고 어떻게 고쳤나"의 서사가 훨씬 설득력이 있습니다. 실제로 개선 이력이 그렇게 흘렀습니다.

### 마일스톤 흐름

7/5 하루에 플러그인 골격과 6단계 파이프라인, 스킬 7종을 세웠습니다. 이때 bridge 검증기는 25줄짜리였습니다. 이어서 브릿지를 "무손실화"하며 실물 Figma 골든 캡처를 record/replay 픽스처로 저장하기 시작했고(v2.0), 비전 의미 레이어와 수치 정규화를 더했습니다(v2.1). 7/6~7에 visual-verify 엔진을 만들어 Playwright + 픽셀 diff로 검증을 자동화했고, 팀 작업 자체도 이슈 자동사냥(hunt/issue) 워크플로로 묶었습니다. 7/8에 validate-plan 검증기와 code fix 모드를 도입해 "생성→검증"에서 멈춰 있던 파이프라인을 "생성→검증→자동수정→재검증"으로 닫았습니다. 7/9에 validate-code 정적 게이트와 오케스트레이터 auto 모드, 브릿지 캐시 자동화를 얹었고, 7/10에 관찰 기반 검증기(verify-observe)로 세대교체를 시작했습니다.

### 취약점을 찾아 고친 대표 사례 (감사와 별개로 개발 이력에 남은 것들)

브릿지는 처음에 섹션 전체를 좌표 없는 한 번의 호출로 받아 leaf를 재구성하다 좌표를 창작하는 결함이 있었습니다. leaf별 개별 호출을 1순위 규칙으로 재배치해 잡았고, 카드 3장 중 진짜 오류는 하나뿐이었음을 라이브 재호출로 판별했습니다. MCP rate limit이 라이브 호출 3회 중 2회를 막던 실측이 골든 캡처의 존재 이유가 됐습니다. code 단계에서는 값→Tailwind 클래스 환산을 code가 암산하다 틀리던 걸 plan으로 이관해 code는 복사만 하게 바꿨습니다.

가장 좋은 서사는 data-dk 앵커의 흥망입니다. 소스와 DOM 매칭 실패를 풀려고 생성 코드에 앵커 속성을 붙이는 규칙을 신설했는데, 곧 Babel 플러그인이 빌드 시 소스 위치를 자동 주입하게 되자 산출물을 더럽히지 않고 같은 목적이 달성됐고, 하루 만에 앵커 방식을 폐지하며 검증 코드 1,383줄을 과감히 버렸습니다. "생성 코드를 더럽히지 않는 검증으로 회귀"라는 이 이야기가 이번 감사가 짚은 data-dk 관련 결함들의 답이기도 합니다(0장).

### 수치로 말할 수 있는 것

| 항목 | 수치 |
|---|---|
| 스프린트 | 6일, 커밋 약 50개, merge PR 16건 |
| 스킬 | 9개(bridge/plan/code/verify/ddalkak/design-md/finalize/hunt/issue) |
| 검증 게이트 | 4단(validate-bridge → validate-plan → validate-code+tsc → visual-verify) |
| 캐시 효과 | 재실행 시 bridge 단계 수 분 → 0.4초, MCP 호출 0회 |
| 토큰 절약 | bridge compact 저장 24k → 6k 토큰 |
| 수렴 개선 | verify 5라운드+사용자 지적 2건(run1) → 1라운드 수렴, 총 312초(run3) |
| 픽셀 일치율 | 98.310%(run1) → 98.641%(run3, 폰트 미제공 상태) |
| 죽은 코드 정리 | data-dk 폐지로 verify-static 1,383줄 삭제 |

한 줄 요약 후보는 이렇습니다. "6일간 PR 16개로, 좌표를 지어내던 브릿지를 픽셀 98.6% 일치·312초 무개입 파이프라인으로 만들었습니다. verify는 5라운드에서 1라운드로, MCP 호출은 0으로 줄였고, 검증 코드 1,383줄은 과감히 버렸습니다."

---

## 부록. 감사 방법과 한계

이 문서의 발견은 서브에이전트 오케스트레이션으로 8개 영역(bridge/plan/code/verify·finalize/orchestrator/scripts/contracts/docs·sandbox)을 병렬 감사하고, 각 발견을 별도 에이전트가 파일을 직접 열어 반박검증한 결과입니다. 확정 40건(high 8, medium 23, low 9), 기각 20건입니다. 반박검증 단계 일부(18건)가 세션 사용량 한도로 못 돌았으나, 데모에 직결되는 high 발견은 전부 검증을 마쳤습니다. 감사 실행 중 sandbox에 seed 산출물이 생성돼 남아 있고, seed 과정에서 untracked였던 `reports/login-page.code-gaps.json`이 삭제됐으니 필요하면 재생성해야 합니다.
