// 관찰 검증기 설정 — 인자 파싱과 실행 구성 (visual-verify의 config 관례를 따른다).
import { existsSync, readFileSync } from "node:fs";
import { resolve, sep } from "node:path";

export class ObserveVerifyConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ObserveVerifyConfigError";
  }
}

export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      throw new ObserveVerifyConfigError(`알 수 없는 인자: ${arg}`);
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

export function resolveRunConfig(args) {
  const projectRoot = resolve(args.project ?? process.cwd());
  const configPath = resolve(projectRoot, ".ddalkak", "ddalkak.config.json");
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8")) : {};
  const name = args.name ?? config.name;
  if (!name) {
    throw new ObserveVerifyConfigError("--name 또는 .ddalkak/ddalkak.config.json.name이 필요합니다.");
  }
  const bridgePath = resolve(projectRoot, ".ddalkak", "bridge", `${name}.bridge.json`);
  if (!existsSync(bridgePath)) {
    throw new ObserveVerifyConfigError(`bridge 파일 없음: ${bridgePath}`);
  }
  const bridge = JSON.parse(readFileSync(bridgePath, "utf8"));
  const screen = selectScreen(bridge, args.screen);
  const frame = screen.frame ?? {};
  const url = args.url ?? defaultUrl(projectRoot, screen.name ?? name);
  if (!url) {
    throw new ObserveVerifyConfigError("--url이 필요합니다 (렌더 중인 dev 서버 주소).");
  }
  return {
    projectRoot,
    name,
    bridge,
    screen,
    viewport: { width: frame.w ?? 1440, height: frame.h ?? 900 },
    url,
    outputDir: resolve(projectRoot, args.output ?? ".ddalkak/reports"),
    // 기하 판정 허용오차: tol 초과 = 위반, 위반 중 tolMinor 이하 = minor(렌더링 노이즈 가능성)
    tol: numberArg(args.tol, 3, "--tol"),
    tolMinor: numberArg(args["tol-minor"], 6, "--tol-minor"),
    annotate: !!args.annotate,
    timeoutMs: numberArg(args.timeout, 30000, "--timeout"),
  };
}

function defaultUrl(projectRoot, screenName) {
  // 샌드박스 App.tsx의 해시 라우팅 관례 (#<screen>)
  return projectRoot.endsWith(`${sep}sandbox`) ? `http://localhost:5173/#${screenName}` : undefined;
}

function selectScreen(bridge, requested) {
  const screens = bridge.screens ?? [];
  if (!screens.length) throw new ObserveVerifyConfigError("bridge.screens가 비어 있습니다.");
  if (requested) {
    const exact = screens.find((s) => s.breakpoint === requested || s.name === requested);
    if (!exact) throw new ObserveVerifyConfigError(`요청한 screen을 찾을 수 없습니다: ${requested}`);
    return exact;
  }
  return screens[0];
}

function numberArg(value, fallback, label) {
  if (value === undefined || value === true) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new ObserveVerifyConfigError(`${label} 값이 숫자가 아닙니다: ${value}`);
  return n;
}
