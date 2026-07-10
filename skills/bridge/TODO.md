# bridge 개선 TODO

`bridge` 스킬 + `figma-extractor` 앞으로 해볼 것. 규칙 SSOT는 [../../shared/figma-extraction-rules.md](../../shared/figma-extraction-rules.md),
스키마는 [../../shared/bridge.schema.json](../../shared/bridge.schema.json). 우선순위 P1(높음)~P3(낮음).

> 이미 된 것(참고): 무손실 v2.0, 캐시 record/replay(§10), 비전 의미 레이어(§11),
> 구조 추론(§12), 수치 정규화(§13). pc-home 실물 검증 통과(소수점 27→0).

---

## 1. 토큰 최적화 (출력 JSON이 제일 큰 비용)
- [x] **P1 · 저장은 compact, 사람용은 pretty 분리** — 완료(rules §14, `scripts/bridge-format.mjs`).
      실측: pc-home pretty 94KB(≈24k 토큰) → compact 23KB(≈6k 토큰), 4배. emoji-extract도 compact 저장으로 수정.
- [ ] **P1 · 래퍼 프레임 접기** — pc-home 83노드 중 frame 32개. 자식 1개짜리 + layout/style 의미 없는
      순수 래퍼는 부모로 병합해 트리 축소 (무손실 지키려면 접는 프레임에 실제 속성 있으면 보존). 코드 중첩도 얕아짐.
- [ ] **P2 · bbox 다이어트** — 오토레이아웃 컨테이너 안 자식은 layout이 위치를 결정하므로 bbox 생략 가능
      (절대배치/inferred만 bbox 유지). 좌표 배열이 노드마다 반복돼 무거움.
- [ ] **P2 · `fidelity: summary` 실제 규칙화** — 지금 개념만 있음. plan 단계가 "구조만 빨리" 필요할 때
      쓸 축약 프로파일 정의(스타일 요약, 반복 자식 대표 1개 + count 등).
- [ ] **P3 · 토큰 사전 중복 제거** — 같은 raw 색/값이 여러 노드에 리터럴로 반복되면 임계치 넘을 때
      자동 토큰화 제안(§4 무손실 유지, 이름은 `raw-*`).

## 2. 토큰 계측 (얼마 쓰는지 보이게)
- [ ] **P1 · 산출 요약에 토큰 추정치 표기** — bridge 완료 보고에 "브릿지 JSON ≈ Nk 토큰,
      비전 패스 ≈ Nk"를 함께 출력. 사용자가 화면 추가 전에 비용 감을 잡게.
- [ ] **P2 · `scripts/bridge-stats.mjs` 추가** — 브릿지 파일 넣으면 노드수/깊이/타입분포/바이트/추정토큰/
      소수점 잔여/semanticRole·suggested 수를 한 번에 출력 (지금 임시로 하던 분석을 도구화).
- [ ] **P3 · 캡처별 MCP 콜 소모량 기록** — `manifest.json`에 콜 수 집계 → 남은 한도 관리에 활용.

## 2.5. 완료된 정확도·시간 개선 (2026-07-09)
- [x] **재조합(re-extract) 서브트리 confidence 마킹 의무화** — rules §8-1, figma-extractor 계약. 스키마 무변경(confidence 재사용).
- [x] **validate-bridge 불변식 3종** — 오토레이아웃 산술 / 부모⊇자식 / row·column 겹침 (rules §9-1).
- [x] **bbox↔스크린샷 edge 대조** — 전이 검사 + fill 일치 2중 신호. 1차 런의 좌표 결함 4건 전부 + 미발견 2건 검출 실증.
- [x] **수치 기계 추출 스켈레톤** — `scripts/bridge-skeleton.mjs` (rules §8-2). metadata 좌표계(부모 상대,
      group 자식은 공유 좌표) 해석을 기계에 고정 — CTA x=102 오추출의 원인이 좌표계 오해석이었음을 실증.
- [x] **입력 불변 스킵** — `mcp-cache.mjs fingerprint` + `meta.sourceFingerprint` (rules §10). 캐시가 안 변했으면 브릿지 단계 스킵.
- [x] **bridge-autofix.mjs (차선 보정 도구)** — 오토레이아웃 산술은 포뮬러로 직접 치환(결정론), 스크린샷 색상영역
      매칭은 배경과 안 구분되는 색·같은 색/크기 형제가 여럿이면 확신 없어 스스로 보류하도록 가드 2개 추가.
      단 **정본이 아니다** — §2.6 참고, 개별 `get_design_context` 호출이 항상 1순위.
- 효과 실측: verify 1라운드 95.756% → 98.715%, 수렴 5라운드+사용자 지적 2건 → 2라운드·지적 0건.

## 2.6. 중요 실측 — "메타데이터가 부족해서 픽셀 추측한 게 아니라, 개별 호출을 안 해서였다" (2026-07-09)
img_01(leaf 인스턴스)을 라이브 `get_design_context(nodeId: 9:571)`로 **개별 호출**해보니, 카드 3장 중
실제로 틀렸던 값은 `add-card`의 x좌표 **1개**뿐이었다 — 나머지 카드 위치·크기·avatar가 pill이라는 것·
tag 색까지 전부 정확했고, 심지어 최초 브릿지의 detail 패스가 놓친 카드 내부 구분선(#E1E1E1, 실측으로
발견)까지 나왔다. 그런데 최초 브릿지는 **전체 섹션 1회 `get_design_context` 호출**(`codeSummary` 자연어
요약만 반환, 좌표 없음)만으로 이 leaf 서브트리 전체를 재구성했었다 — 그 요약을 보고 LLM이 좌표를
지어낸 것이 진짜 원인이다. **결론: leaf마다 개별 `get_design_context` 호출이 항상 1순위**(rules §8-1
갱신 완료, agents/figma-extractor.md `detail` 패스도 갱신). `bridge-autofix.mjs`의 스크린샷 매칭은
그 개별 호출이 실패/rate-limit일 때만 쓰는 차선책이다.
- [ ] **P1 · img_02/header 개별 재호출 대기** — 이번 세션에서 Figma MCP(Starter plan) 호출 한도에 걸려
      `get_design_context(9:579)`(img_02), `get_design_context(9:586)`(header)는 아직 실측하지 못했다.
      한도가 풀리면 이 두 leaf부터 개별 재호출 → `confidence: 0.7`로 남아있는 좌표를 실측치로 교체.

## 2.7. 2번째 실물 파일로 하네스 교차검증 (fixtures/figma/untitled-1-858, 2026-07-09)
다른 팀(계정 gyutae kim, 권한 있는 새 파일)의 "[PC] /post/{id}/edit (image case)" 섹션으로
`design-context-parse.mjs`를 재검증. **이번엔 섹션 전체 1회 호출이 요약이 아니라 전체 좌표 코드를
반환했다** — §8-1의 "요약이면 leaf 개별 호출" 대체 경로가 필요 없는 사례도 실측으로 확인(호출 3회로
구조+토큰+스크린샷까지 완료, 에셋 10개 다운로드는 한도 절약차 보류).
- [x] **퍼센트 calc 위치 지원 추가** — `left-[calc(66.67%-104px)]`류(중앙정렬 아닌 임의 퍼센트+오프셋)를
      pc-home에서 본 `50%-N + translate` 중앙정렬 패턴과 통합해 하나의 앵커+translate보정 로직으로 재작성.
- [x] **루트 크기 판정 버그 수정** — "첫 태그 = 루트"로 판정했다가 코드 앞쪽의 헬퍼 컴포넌트 함수(아이콘 등)에
      `size-full` 대체값을 잘못 씌우는 버그 발견·수정 — 이제 `cache.nodeId`로 정확히 매칭.
- [x] **앵커 원형 보존 (rules §8-3, 2026-07-10)** — 사용자 지적으로 발견한 무손실 위반: 퍼센트/중앙/반대변
      앵커(`calc(66.67%-104px)`, `left-1/2+translate`, `right-[N]`)를 px로 환산만 하고 원형을 버려서
      반응형 정보가 브릿지에서 증발했었다. 파서가 `constraints.anchorX/anchorY`(원형) + §5 열거값을
      함께 내보내도록 수정, 스키마에 `$defs/anchor` 추가. translate 플래그는 hug라 수치 보정 못 해도
      무조건 기록(center 판정 근거). pc-post-edit 브릿지 재생성 — constraints 7노드(카드 4, 배경, 헤더 바 2).
- [x] **detail 코드 → 브릿지 초안 컴파일러 (rules §8-2 확장, 2026-07-10)** — `scripts/design-context-to-bridge.mjs`.
      스켈레톤·좌표 파서 이후에도 남아 있던 마지막 수작업 구간(구조·스타일·텍스트·에셋을 브릿지 노드로
      옮기는 병합 = LLM 전사)을 결정론으로 대체. 헬퍼 컴포넌트 인라인 + 호출부 props/파생 불리언
      (`const isOther = badge === "other"`)으로 조건식 텍스트·클래스까지 확정, 못 푸는 식은 `contentExpr`로
      원식 보존(조용한 소실 금지). **실측**: pc-post-edit 204노드·에셋 10·constraints 24를 0.24초에 컴파일,
      수작업 병합에서 났던 결함 4건(아바타 스택 누락/카드별 아바타 ref/앵커 소실/gap 오류)을 전부 처음부터
      정답으로 산출. pc-home leaf(9-571)도 36노드 회귀 없음 — 시간·정확도 병목이 같은 지점이었다는 실증.
- **교차검증 결과**: 퍼센트 calc로 계산한 카드 6개 좌표가 완전히 독립된 `get_metadata` 응답의 좌표와
  소수점 이하 오차로 일치 — 파서가 정확하다는 근거.
- [ ] **P2 · 다음 확장 대상**: grid(`col-N row-N`) 배치, `calc()` 중첩식. 지금은 미지원(순수 flex 흐름
      자식은 애초에 bbox 불필요라 문제 없음 — layout 필드로 표현).

## 2.8. 플랫폼 중립 적응형 Bridge IR (2026-07-10)
- [x] **P1 · 적응형 계약 추가** — `adaptive`/`environment`/`matchKey`와 플랫폼 중립
      `sizing`/`behavior`/`textBehavior`/`assetFit`을 v2.1 선택 필드로 추가.
- [x] **P1 · 추출기-스키마 정합성 복구** — `grid`, `stretch`, `nodeId`, `size`, `contentExpr`를 정식 정의하고
      `design-context-to-bridge.mjs`와 `design-context-parse.mjs`의 앵커 형식을 통일.
- [x] **P1 · JSON Schema 실검증 + 캐시 회귀 테스트** — Ajv 검증을 연결하고
      `npm run test:bridge:cache`로 204노드/10에셋 결정성 및 적응형 필드 보존을 검사.
- [x] **P1 · cache→final 무인 runner** — `npm run bridge:cache -- --cache <dir> --project <dir> --name <name>`으로
      노드 컴파일, 10개 원격 자산 로컬화, screenshot 복사, compact 저장, 검증을 원자적으로 수행.
      pc-post-edit 실측 204노드/14자산, 경고 0, 재생성 0.41초·재사용 0.30초.
- [x] **P1 · 추출기 지문 추가** — sourceFingerprint가 같아도 스키마·규칙·변환기가 바뀌면 재생성해
      오래된 bridge를 잘못 재사용하지 않도록 `meta.extractorFingerprint`를 함께 비교.
- [ ] **P1 · 다중 변형 fixture 확보** — 같은 화면의 mobile/tablet/desktop 또는 portrait/landscape 캡처로
      `matchKey` 대응과 adaptive 조건 검증을 실물 교차검증.
- [ ] **P2 · 앱 환경 fixture 확보** — iOS/Android safe area, density, colorScheme가 명시된 Figma 파일로 검증.

## 3. 에러 처리 (실행 중 실패했을 때)
- [ ] **P1 · MCP 호출 실패 표기 규약** — 패스 하나 실패 시 그냥 죽지 말고, 브릿지 `meta.errors[]`에
      `{ pass, tool, reason }` 기록 + 사용자에게 "어느 패스가 왜 실패, 나머지는 살림" 요약.
      (rules §6에 "실패해도 생존"은 있으나 표기 스키마가 없음 → 스키마에 `meta.errors` 추가 필요)
- [ ] **P1 · 호출 한도 소진(rate limit) 전용 처리** — record-always(§10) 덕에 받은 건 남지만,
      "6/6 소진, 캐시로 이어서 하려면 --source cache" 같은 **행동 가능한 안내**로 표기.
- [ ] **P2 · 입력 검증 선제** — 잘못된 Figma URL / node-id 없음(page 모드 경고) / 접근 권한 없음을
      호출 전에 잡아 명확한 메시지로. (지금은 MCP가 던지는 raw 에러가 그대로 노출될 수 있음)
- [ ] **P2 · 부분 실패 시 브릿지 상태 표시** — `meta.completeness: "full" | "partial"` 필드로
      "이 브릿지는 스크린샷 누락으로 §8 교차검증 못 함" 같은 걸 downstream이 알게.
- [ ] **P3 · 자가검증 재시도(§9) 실패 로그** — 1회 재시도가 뭘 고치려다 실패했는지 남기기.

## 4. 사용자 편의
- [ ] **P1 · 완료 요약을 사람 친화적으로** — 화면 수 / 반응형 그룹 / 감지된 컴포넌트 목록 /
      교차검증 결과 / 경고를 한눈에 (지금도 일부 하지만 포맷 통일 + 다음 액션 제안).
- [ ] **P2 · dry-run / preview** — 실제 산출 전에 "이 URL은 page 모드, 프레임 N개, 예상 콜 N회,
      예상 토큰 Nk" 미리 보여주고 진행 확인 (특히 한도 아껴야 하므로).
- [ ] **P2 · 캡처 목록 보기 편하게** — `mcp-cache.mjs list`를 bridge 스킬에서 바로 부르거나,
      "쓸 수 있는 캐시" 안내를 실행 초입에 노출. (fixtures/figma/README 표와 연동)
- [ ] **P2 · 덮어쓰기 확인** — 기존 `.ddalkak/bridge/<name>.bridge.json`이 있으면 덮기 전 확인/백업.
- [ ] **P3 · 진행 표시** — 6~7패스가 도는 동안 어디까지 됐는지 진행 로그.

## 5. 파이프라인 연결 (bridge 밖이지만 bridge 가치가 여기서 실현됨)
- [ ] **P1 · plan/code가 semanticRole·suggestedComponent 소비** — 지금 bridge가 넣어주는데
      plan/code(퓨리)는 아직 안 읽음. 이거 연결돼야 "이쁜 코드" 효과가 실제로 남. (담당: 퓨리, 협의 필요)
- [ ] **P1 · plan/code가 constraints.anchorX/anchorY 소비** — §8-3으로 브릿지에 반응형 앵커 원형이
      들어가기 시작함(pc-post-edit 7노드). code가 이를 px 고정 대신 `left-[calc(P%±Npx)]`/중앙정렬로
      구현해야 단일 브레이크포인트 화면도 폭 가변에 자연 대응. verify도 다중 뷰포트 캡처 필요.
      (담당: 퓨리/글랜·렉스, 협의 필요)
- [ ] **P2 · verify가 vision/inferred 노드 우선 대조** — §11/§12 추론 결과는 추정이므로
      verify(글랜·렉스)가 먼저 확인하도록. 규칙엔 있으나 verify SKILL엔 아직 없음.

## 6. 정확도/기술부채
- [ ] **P2 · §11·§12 다양한 화면으로 검증** — 지금은 pc-home 1케이스만. 폼 많은 화면,
      반응형 여러 브레이크포인트, 다크모드 등에서 semanticRole/suggested 품질 확인.
- [ ] **P3 · 스케일 아티팩트(§13) 원인 추적** — pc-home의 ≈0.909 배율이 어디서 생기는지
      (프레임 스케일? export 설정?) 근본 원인 확인해 애초에 안 생기게 할 수 있는지.
- [ ] **P3 · gradient/이미지 fill 무손실 재현** 실제 케이스 검증 (지금 스키마엔 있으나 실물 미검증).
