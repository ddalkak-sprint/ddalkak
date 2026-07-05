---
name: figma-extractor
description: Figma MCP로 대량의 노드/스타일/스크린샷을 추출해 무손실 디자인 브릿지 데이터로 반환하는 서브에이전트. bridge 스킬이 컨텍스트 격리를 위해 호출한다.
tools: ["*"]
---

# figma-extractor 서브에이전트

Figma MCP 호출이 반환하는 대용량 원본을 이 에이전트 안에서 처리하고, 상위에는
**브릿지 스키마(v2.0)에 맞는 정규화 결과만** 반환한다 (원본 덤프로 상위 컨텍스트를 오염시키지 않음).

규칙 SSOT: `${CLAUDE_PLUGIN_ROOT}/shared/figma-extraction-rules.md` (§6에 아래 절차의 근거).
원칙: **토큰을 쓰되 무손실** — 구조는 접어도 속성·자산·텍스트는 전량 캡처(§0).

## source: live / cache (MCP 호출 절약, rules §10)
- `live`: 아래 각 패스의 MCP 도구를 실제 호출하고, **원시 응답을 받는 즉시 `cacheDir`에 기록**한다
  (`get_metadata.json`, `get_variable_defs.json`, `sections/<section>/get_design_context.json`, `screenshot.png` …)
  + `manifest.json`에 콜 로그(도구/args/파일/scope) 추가. 호출 한도에 도중 걸려도 그때까지 받은 건 남는다.
- `cache`: **MCP를 호출하지 않는다.** `cacheDir/manifest.json`을 읽어 각 도구 응답 파일을 찾아 그 내용을
  MCP 응답 대신 사용한다. 병합·정규화(아래)는 라이브와 동일 → 호출 0회로 스키마 산출·교차검증 테스트.

## 절차 — 6개 패스를 병렬로 실행 후 병합
| 패스 | MCP 도구 | 채우는 필드 |
|------|----------|-------------|
| `structure` | `get_metadata` | `screens[].nodes` 트리 + `bbox` (가지치기 전) |
| `detail` | `get_design_context` | 노드별 `style`(fills/strokes/effects/cornerRadius/opacity), `layout`(오토레이아웃 §7), `constraints`(§5), text `typography`/`runs` |
| `tokens` | `get_variable_defs` | `tokens.color/type/spacing/radius/effect`. detail 값 중 매핑되는 것을 `@ref`로 치환 (rules §4) |
| `component-map` | `get_code_connect_map` + 인스턴스 메타 | `componentName`/`isDesignSystemComponent`/`mappedCodeComponent`/`componentProps` (rules §3) |
| `assets` | `download_assets` | 장식 벡터·이미지 fill 실제 파일 export → 프로젝트 `.ddalkak/assets/<name>/`에 적재, `export`는 프로젝트 상대경로 → `assets[]` (rules §2, 무손실) |
| `screenshots` | `get_screenshot` | 화면 스크린샷 → `assets[](kind=screenshot)` + `screens[].screenshot` |

한 패스가 실패해도 나머지 병합은 계속하고, 실패한 패스는 상위(`bridge` 스킬)에 보고한다.

## 병합 후 처리
1. `structure` 트리에 `detail`·`component-map` 결과를 노드 단위로 부착.
2. `tokens` 치환 — 매핑되는 값은 `@ref`, 아니면 raw 리터럴로 style을 **빠짐없이** 채운다 (§0-1, §4).
3. 가지치기(§2) — 장식 서브트리를 vector/image 노드로 접고 `download_assets`로 export.
4. 오토레이아웃(§7) + 반응형 그룹핑(§5, breakpoint/variantGroup) + 노드 constraints 부착.
5. **스크린샷 교차검증(§8)** — 각 screen 구조를 스크린샷과 대조해 missing/extra/mismatch를 잡고,
   재추출로 보정한 뒤 `screens[].reconciliation`에 결과 기록. 이게 "퍼블 누락 없음"의 안전망.

## 반환 계약
- `${CLAUDE_PLUGIN_ROOT}/shared/bridge.schema.json` (v2.0)를 따르는 JSON 오브젝트.
- `meta.schemaVersion: "2.0"`, 모든 style 값은 `@ref` 또는 리터럴로 채워짐(미해결 참조 0), 각 screen에 screenshot + reconciliation 포함.
- 모든 자산은 대상 프로젝트의 `.ddalkak/assets/<name>/`에 실제 파일로 적재되고, `assets[].export`는 **프로젝트 상대경로**로 채워짐(캐시/`fixtures` 경로를 가리키지 않음 — rules §2/§10). cache(replay) 산출 시에도 cacheDir 사본을 이 폴더로 복사한다.
