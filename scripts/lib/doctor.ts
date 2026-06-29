/** Result of a single toolchain check (no secret values ever go in `detail`). */
export interface ToolCheck {
  name: string;
  ok: boolean;
  detail: string;
}

/** Injected probes so the doctor logic stays pure and unit-testable. */
export interface DoctorDeps {
  which: (bin: string) => string | null;
  nodeVersion: () => string;
  portFree: (port: number) => boolean;
}

/** Check a Node version string (e.g. "v22.3.0") against a minimum major version. */
export function checkNode(version: string, minMajor: number): ToolCheck {
  const major = Number(version.replace(/^v/, '').split('.')[0]);
  const ok = Number.isFinite(major) && major >= minMajor;
  return {
    name: 'node',
    ok,
    detail: ok ? version : `need >= v${minMajor}, found ${version}`,
  };
}

/**
 * Run all toolchain checks (Node, Corepack, bao, the dev ports) using injected
 * probes. Returns one ToolCheck per item and never includes secret values.
 */
export function runDoctor(deps: DoctorDeps): ToolCheck[] {
  const bin = (name: string): ToolCheck => {
    const path = deps.which(name);
    return { name, ok: path !== null, detail: path ?? 'not found on PATH' };
  };
  const port = (p: number): ToolCheck => {
    const free = deps.portFree(p);
    return { name: `port:${p}`, ok: free, detail: free ? 'free' : 'in use' };
  };
  return [
    checkNode(deps.nodeVersion(), 22),
    bin('corepack'),
    bin('bao'),
    port(3000),
    port(7007),
  ];
}
