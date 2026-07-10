// 공유 실행 컨텍스트 — 모듈 전역 가변 상태를 한 객체에 모아 각 모듈이 호출 시점에 읽는다.
// (ctx 프로퍼티를 재할당이 아니라 변형(Object.assign)으로만 갱신해 ESM 라이브 바인딩을 보존)

export const ctx = {
  projectRoot: null,
  name: null,
  bridge: null,
  schemaVersion: null,
  isV21: false,
  theme: null,
  bridgeColorTokens: null,
  bridgeTypeTokens: null,
  planTsx: null,
  allSrcTsx: null,
  fallbackTsx: null,
  planDeviations: [],
  checklist: [],
  treeCache: new Map(),
  srcCache: new Map(),
};

export function initContext(values) {
  Object.assign(ctx, values);
}

// v2.1: "@그룹.이름" 참조를 tokens 사전에서 원본 리터럴로 복원 (rules §4 무손실 규약)
export function resolveRef(val) {
  if (typeof val !== "string" || !val.startsWith("@")) return val;
  let cur = ctx.bridge.tokens ?? {};
  for (const key of val.slice(1).split(".")) {
    cur = cur?.[key];
    if (cur == null) return null; // 미해결 @ref — validate-bridge가 잡을 영역이지만 방어
  }
  return cur;
}
