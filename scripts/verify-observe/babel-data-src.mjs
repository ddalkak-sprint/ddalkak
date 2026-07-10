// 다리 B — 컴파일러 주입 소스 위치.
// JSX 트랜스파일 시점에 모든 호스트 요소(div, h3 등 소문자 태그)에
// data-src="<파일>:<줄>:<칼럼>"을 기계적으로 부착한다.
//
// 신뢰의 근거: 위치는 파서가 파싱을 위해 어차피 기록하는 AST loc에서 그대로 읽는다.
// 컴파일러는 JSX 요소를 구조적으로 전부 방문하므로 누락이 불가능하고, 지금 서 있는
// 노드의 loc을 지금 서 있는 노드에 넣으므로 오부착도 불가능하다 — 생성 LLM이 기억해서
// 붙이던 data-dk와 달리 실패가 코드 오류와 상관되지 않는다.
//
// 소스 파일에는 아무것도 적히지 않는다. 검증 빌드(DDALKAK_VERIFY=1)에서만 켠다.
export default function dataSrcPlugin({ types: t }) {
  return {
    name: "ddalkak-data-src",
    visitor: {
      JSXOpeningElement(path, state) {
        const node = path.node;
        const loc = node.loc;
        if (!loc) return;
        // 호스트 요소만 — 컴포넌트(<HomeButton>)에 붙이면 DOM에 닿지 않는 prop이 될 뿐이고,
        // 컴포넌트 내부의 실제 호스트 요소가 자기 위치를 따로 받는다.
        if (!t.isJSXIdentifier(node.name) || !/^[a-z]/.test(node.name.name)) return;
        // HMR 재변환 등으로 이미 붙어 있으면 중복 부착 방지
        if (node.attributes.some((a) => t.isJSXAttribute(a) && a.name?.name === "data-src")) return;
        const filename = state.file.opts.filename ?? "";
        const root = (state.opts?.root ?? process.cwd()) + "/";
        const rel = filename.startsWith(root) ? filename.slice(root.length) : filename;
        node.attributes.push(
          t.jsxAttribute(
            t.jsxIdentifier("data-src"),
            t.stringLiteral(`${rel}:${loc.start.line}:${loc.start.column}`),
          ),
        );
      },
    },
  };
}
