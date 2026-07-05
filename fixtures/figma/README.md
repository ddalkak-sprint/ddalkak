# fixtures/figma — MCP 캡처 골든 픽스처 (record / replay)

Figma MCP 호출은 유한한 자원(월 N회)이라, **한 번 정성껏 뜬 원시 응답을 여기 캐시**해두고
bridge 스킬 개발·디버깅은 이 캐시로 **호출 0회** 반복한다. 규칙 SSOT: [../../shared/figma-extraction-rules.md](../../shared/figma-extraction-rules.md) §10.

## 폴더 구조
```
fixtures/figma/<capture-name>/
  manifest.json                 # source URL/page, 섹션 목록, 콜 로그 (어느 파일이 어느 도구/노드 응답인지)
  get_metadata.json             # 페이지 스코프 원시 응답 (1콜로 전 섹션 트리)
  get_variable_defs.json        # 페이지 스코프 변수 (1콜)
  sections/<section-slug>/
    get_design_context.json     # 섹션별 상세 (넓은 콜로 부족할 때만)
    screenshot.png              # 섹션별 스크린샷
```

## 캡처 절차 (호출 한도가 빡빡할 때)
목표: **가장 적은 콜로 4개 섹션 전부를 덮기.** 넓은 스코프부터 시도하고, 부족할 때만 섹션 단위로 내려간다.

1. bridge 스킬을 `source: live`로 실행 (인증된 세션에서):
   ```
   /ddalkak:bridge <page-url> --source live --cacheDir fixtures/figma/<capture-name>
   ```
2. 권장 콜 순서 (넓은 스코프 우선):
   - `get_metadata`  → 페이지 루트 1콜 (전 섹션 트리)
   - `get_variable_defs` → 페이지 루트 1콜 (전 변수)
   - `get_screenshot` → 가능하면 페이지 1콜, 섹션별 시각이 필요하면 섹션당 1콜
   - `get_design_context` → 페이지 스코프로 먼저 시도, 상세가 부족하면 섹션당 1콜
3. **모든 응답은 받는 즉시 캐시에 기록된다(record-always)** — 도중에 한도에 걸려도 받은 만큼은 보존.
4. 캡처 완결성 확인:
   ```
   node scripts/mcp-cache.mjs check fixtures/figma/<capture-name>
   ```

## 재생 (이후 개발은 전부 이걸로)
```
/ddalkak:bridge <page-url> --source cache --cacheDir fixtures/figma/<capture-name>
```
MCP를 호출하지 않고 캐시된 원시 응답으로 정규화·교차검증을 수행한다. 스키마 매핑 로직을
고치고 다시 돌리는 이터레이션을 **호출 0회**로 무한 반복할 수 있다.

## 커밋 정책
골든 픽스처는 **팀 공유 자산이므로 커밋**한다(스크린샷 png 포함). 모두 같은 입력으로 개발/디버깅하기 위함.
민감한 실서비스 디자인이면 캡처 이름/내용을 정리한 뒤 커밋할 것.

## 지금 쓸 수 있는 캡처 (다른 사람은 여기서 골라서 재생만 하면 됨)

| 캡처 이름 | 화면/소재 | 재생 명령 | 캡처한 사람 | 날짜 |
|-----------|-----------|-----------|-------------|------|
| main | Rolling 롤링페이퍼 랜딩([PC] /, 1920×1080 데스크톱) | `/ddalkak:bridge https://www.figma.com/design/5If4sXvCThGCdlvVJmxgUZ/딸깍-목업?node-id=9-565 --source cache --cacheDir fixtures/figma/main` | 김규태 | 2026-07-05 |

**캡처를 새로 추가하는 사람**: 위 §캡처 절차대로 `--source live`로 한 번 뜨고
`mcp-cache.mjs check`로 완결 확인한 뒤, 이 표에 아래 형식으로 한 줄 추가해서 커밋하세요.
```
| login-page | 로그인 화면 | `/ddalkak:bridge <url 또는 생략> --source cache --cacheDir fixtures/figma/login-page` | 이름 | 2026-07-05 |
```
**남이 만든 캡처를 쓰는 사람**: 표에서 이름 골라 위 "재생 명령" 열을 그대로 복사해서 실행하면 끝 —
자기 Figma 계정·MCP 호출 한도를 전혀 쓰지 않는다.
