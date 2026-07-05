# sandbox — 딸깍 파이프라인 테스트 베이스

목업 산출물(`shared/examples/`)이 **미리 주입된** 대상 프로젝트.
자기 단계 스킬을 여기서 바로 실행해보고, 결과를 렌더링으로 확인한다.

## 시작하기
```bash
cd sandbox
npm install
npm run dev        # http://localhost:5173 — 로그인 화면 렌더 확인
```

딸깍 플러그인 로드 (sandbox에서 claude 실행 후):
```
/plugin marketplace add C:\project\teo_sprint\ddalkak
/plugin install ddalkak@ddalkak-marketplace
```

## 미리 주입된 상태
`design.md`(React 웹 컨벤션) + `.ddalkak/`에 bridge·plan·config가 시드되어 있고,
코드는 code 단계까지 끝난 상태를 재현한다. **`reports/`만 비어 있다.**

## 역할별 테스트 방법
| 담당 | 테스트 | 방법 |
|------|--------|------|
| 닉·초록 (bridge) | 브릿지 산출 | `/ddalkak:bridge <figma-url>` 실행 → `.ddalkak/bridge/`에 생성 → `node ../scripts/validate-bridge.mjs`로 검증. 주입된 `login-page.bridge.json`이 기대 출력 예시 |
| 퓨리 (plan) | 브릿지 → plan | `.ddalkak/plan/login-page.plan.md` 삭제 후 `/ddalkak:plan` 실행 → 주입본과 비교 |
| 퓨리 (code) | plan → 코드 | `src/pages/`, `src/components/` 삭제 후 `/ddalkak:code` 실행 → `npm run dev`로 렌더 확인 |
| 글랜·렉스 (verify) | 코드 ↔ 브릿지 대조 | `/ddalkak:verify` 실행 → `reports/`에 리포트 생성. **코드에 의도적 불일치 2건**이 심어져 있어 이를 잡아내면 성공: ① `TextField.tsx` 인풋 높이 44px(스펙 48px) ② `LoginPage.tsx` 회원가입 링크 색 text-muted(스펙 primary) |
| 글랜·렉스 (finalize) | 마무리 | verify 리포트 생성 후 `/ddalkak:finalize` |

## 리셋
```bash
npm run seed                    # .ddalkak을 목업 초기 상태로 복원
git checkout -- src/            # 코드 원상복구
```
