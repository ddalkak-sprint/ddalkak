import { existsSync, readFileSync } from "node:fs";
import { resolve, relative, sep } from "node:path";

export class VisualVerifyConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "VisualVerifyConfigError";
  }
}

export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      throw new VisualVerifyConfigError(`알 수 없는 인자: ${arg}`);
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

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function toProjectRelative(projectRoot, path) {
  const rel = relative(projectRoot, path).split(sep).join("/");
  return rel.startsWith("..") ? path : rel;
}

export function resolveRunConfig(args) {
  const projectRoot = resolve(args.project ?? process.cwd());
  const configPath = resolve(projectRoot, ".ddalkak", "ddalkak.config.json");
  const config = existsSync(configPath) ? readJson(configPath) : {};
  const name = args.name ?? config.name;
  if (!name) {
    throw new VisualVerifyConfigError("--name 또는 .ddalkak/ddalkak.config.json.name이 필요합니다.");
  }

  const bridgePath = resolve(projectRoot, ".ddalkak", "bridge", `${name}.bridge.json`);
  if (!existsSync(bridgePath)) {
    throw new VisualVerifyConfigError(`bridge 파일 없음: ${bridgePath}`);
  }
  const bridge = readJson(bridgePath);
  const target = selectVerifyTarget(bridge, args);
  const screen = selectScreen(bridge, args.screen ?? target?.screen);
  const breakpoint = screen.breakpoint ?? args.screen ?? "default";
  const viewport = resolveViewport(screen, target);
  const baseline = resolveBaseline(projectRoot, bridge, screen);
  const outputDir = resolve(projectRoot, args.output ?? ".ddalkak/reports");

  return {
    projectRoot,
    configPath,
    config,
    name,
    bridgePath,
    bridge,
    screen,
    breakpoint,
    target,
    viewport,
    baseline,
    outputDir,
    url: args.url ?? target?.entry?.url ?? defaultUrl(projectRoot),
    selector: args.selector ?? "body",
    thresholds: {
      pass: numberArg(args.pass, 0.995, "--pass"),
      conditional: numberArg(args.conditional, 0.98, "--conditional"),
      pixelmatch: numberArg(args["pixel-threshold"], 0.1, "--pixel-threshold")
    },
    timeoutMs: numberArg(args.timeout, 30000, "--timeout")
  };
}

function defaultUrl(projectRoot) {
  return projectRoot.endsWith(`${sep}sandbox`) ? "http://localhost:5173" : undefined;
}

function numberArg(value, fallback, label) {
  if (value === undefined || value === true) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new VisualVerifyConfigError(`${label} 값이 숫자가 아닙니다: ${value}`);
  return n;
}

function selectVerifyTarget(bridge, args) {
  const targets = bridge.verify?.targets ?? [];
  if (args.target) {
    const match = targets.find((target) => target.id === args.target || target.platform === args.target);
    if (!match) throw new VisualVerifyConfigError(`verify target not found: ${args.target}`);
    return normalizeTarget(match);
  }
  if (args.platform) {
    return normalizeTarget({ id: args.platform, platform: args.platform });
  }
  const defaultTargetId = bridge.verify?.defaultTarget;
  if (defaultTargetId) {
    const match = targets.find((target) => target.id === defaultTargetId);
    if (!match) throw new VisualVerifyConfigError(`verify.defaultTarget not found: ${defaultTargetId}`);
    return normalizeTarget(match);
  }
  return normalizeTarget(targets.find((target) => target.platform === "web") ?? { id: "web", platform: "web" });
}

function normalizeTarget(target) {
  return {
    id: target.id ?? target.platform ?? "web",
    platform: target.platform ?? "web",
    device: target.device,
    screen: target.screen,
    density: target.density,
    safeArea: target.safeArea,
    entry: target.entry,
    screenshotProvider: target.screenshotProvider ?? defaultProvider(target.platform ?? "web"),
    ignoreRegions: target.ignoreRegions ?? [],
    viewport: target.viewport
  };
}

function defaultProvider(platform) {
  if (platform === "web") return "playwright";
  if (platform === "ios" || platform === "ios-native") return "simctl";
  if (platform === "android" || platform === "android-native") return "adb";
  if (platform === "flutter") return "flutter";
  if (platform === "react-native") return "detox";
  return "manual";
}

function selectScreen(bridge, requested) {
  const screens = bridge.screens ?? [];
  if (!screens.length) throw new VisualVerifyConfigError("bridge.screens가 비어 있습니다.");
  if (requested) {
    const exact = screens.find((s) => s.breakpoint === requested || s.name === requested);
    if (!exact) throw new VisualVerifyConfigError(`요청한 screen을 찾을 수 없습니다: ${requested}`);
    return exact;
  }
  return screens.find((s) => s.breakpoint === "desktop") ?? screens[0];
}

function resolveViewport(screen, target) {
  const width = target?.viewport?.w ?? screen.frame?.w;
  const height = target?.viewport?.h ?? screen.frame?.h;
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new VisualVerifyConfigError(`screen.frame.w/h가 필요합니다: ${screen.name ?? "(unknown)"}`);
  }
  return { width: Math.round(width), height: Math.round(height) };
}

function resolveBaseline(projectRoot, bridge, screen) {
  if (!screen.screenshot) {
    throw new VisualVerifyConfigError(`screen.screenshot 누락: ${screen.name ?? "(unknown)"}`);
  }
  const asset = (bridge.assets ?? []).find((item) => item.id === screen.screenshot);
  if (!asset) {
    throw new VisualVerifyConfigError(`screenshot asset을 찾을 수 없습니다: ${screen.screenshot}`);
  }
  if (!asset.export) {
    throw new VisualVerifyConfigError(`screenshot asset.export 누락: ${screen.screenshot}`);
  }
  const path = resolve(projectRoot, asset.export);
  if (!existsSync(path)) {
    throw new VisualVerifyConfigError(`baseline screenshot 파일 없음: ${path}`);
  }
  return { id: asset.id, path, asset };
}
