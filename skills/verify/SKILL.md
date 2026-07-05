---
name: verify
description: 생성된 코드가 Figma 디자인과 같은지 검증한다. 코드 렌더링 결과와 Figma 스크린샷/브릿지 스펙을 대조해 차이를 리포트한다. 딸깍 파이프라인 4단계, 또는 사용자가 구현이 디자인과 맞는지 확인할 때 사용.
---

# [4] 검증 (code ↔ figma)  (글랜·렉스)

구현 결과가 원본 디자인과 일치하는지 확인한다.

## 입력
- 생성된 코드 (렌더링 가능하면 스크린샷 캡처)
- `.ddalkak/bridge/<name>.bridge.json` + Figma 스크린샷

## 동작
1. 코드 렌더 결과 vs Figma 시각 대조 (레이아웃/간격/색/타이포).
2. 브릿지 스펙 대비 누락·불일치 항목 목록화.
3. 심층 대조는 `ddalkak:design-verifier` 서브에이전트에 위임.
4. 결과를 `.ddalkak/reports/<name>.verify.md`에 기록.

## 출력
- `.ddalkak/reports/<name>.verify.md` — 통과/불일치 항목, 심각도, 제안 수정.

<!-- TODO: 스크린샷 캡처 방식, diff 기준(허용 오차) 채우기 -->
