# shared/examples — 단계별 목업 산출물

각 단계 담당자가 **선행 단계 결과물 없이 병렬로 착수**할 수 있게 만든 예시 세트.
소재는 가상의 로그인 화면(`login-page`), 기본 베이스는 **React 웹**(`design.md.template` 참고).

| 파일 | 무엇의 목업인가 | 만드는 사람 | 쓰는 사람 |
|------|-----------------|-------------|-----------|
| `login-page.bridge.json` | bridge 단계 출력 (스키마 준수) | 닉·초록 | 퓨리(plan 입력), 글랜·렉스(verify 기준) |
| `login-page.plan.md` | plan 단계 출력 | 퓨리 | 퓨리(code 입력) |
| `login-page.verify.md` | verify 단계 출력 리포트 | 글랜·렉스 | 글랜·렉스(finalize 입력) |
| `ddalkak.config.json` | 오케스트레이터 상태 파일 | — | 전원 |

## 사용 규칙
- 담당 단계의 **출력 포맷을 바꾸면 여기 예시도 같이 갱신**한다. (예시 = 계약의 살아있는 스펙)
- 스키마·계약의 SSOT는 `shared/bridge.schema.json`, `shared/pipeline.md`. 예시가 스키마와 어긋나면 스키마가 우선.
- 브릿지 예시는 `node scripts/validate-bridge.mjs shared/examples/login-page.bridge.json`으로 검증 가능.
