# bridge 개선 TODO

`bridge` 스킬 + `figma-extractor` 앞으로 해볼 것. 규칙 SSOT는 [../../shared/figma-extraction-rules.md](../../shared/figma-extraction-rules.md),
스키마는 [../../shared/bridge.schema.json](../../shared/bridge.schema.json). 우선순위 P1(높음)~P3(낮음).

> 이미 된 것(참고): 무손실 v2.0, 캐시 record/replay(§10), 비전 의미 레이어(§11),
> 구조 추론(§12), 수치 정규화(§13). pc-home 실물 검증 통과(소수점 27→0).

---

## 1. 토큰 최적화 (출력 JSON이 제일 큰 비용)
- [ ] **P1 · 저장은 compact, 사람용은 pretty 분리** — 현재 pretty-print라 pc-home 39KB(compact ~20KB, 약 2배).
      plan/code가 읽는 정본은 무들여쓰기로 저장, 필요 시 `--pretty`로만 예쁘게. (근거: 실측 39376B)
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
- [ ] **P2 · verify가 vision/inferred 노드 우선 대조** — §11/§12 추론 결과는 추정이므로
      verify(글랜·렉스)가 먼저 확인하도록. 규칙엔 있으나 verify SKILL엔 아직 없음.

## 6. 정확도/기술부채
- [ ] **P2 · §11·§12 다양한 화면으로 검증** — 지금은 pc-home 1케이스만. 폼 많은 화면,
      반응형 여러 브레이크포인트, 다크모드 등에서 semanticRole/suggested 품질 확인.
- [ ] **P3 · 스케일 아티팩트(§13) 원인 추적** — pc-home의 ≈0.909 배율이 어디서 생기는지
      (프레임 스케일? export 설정?) 근본 원인 확인해 애초에 안 생기게 할 수 있는지.
- [ ] **P3 · gradient/이미지 fill 무손실 재현** 실제 케이스 검증 (지금 스키마엔 있으나 실물 미검증).
