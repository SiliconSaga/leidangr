export interface ToolCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface DoctorDeps {
  which: (bin: string) => string | null;
  nodeVersion: () => string;
  portFree: (port: number) => boolean;
}

export function checkNode(version: string, minMajor: number): ToolCheck {
  const major = Number(version.replace(/^v/, '').split('.')[0]);
  const ok = Number.isFinite(major) && major >= minMajor;
  return {
    name: 'node',
    ok,
    detail: ok ? version : `need >= v${minMajor}, found ${version}`,
  };
}

export function runDoctor(deps: DoctorDeps): ToolCheck[] {
  const bin = (name: string): ToolCheck => {
    const path = deps.which(name);
    return { name, ok: path !== null, detail: path ?? 'not found on PATH' };
  };
  const port = (p: number): ToolCheck => ({
    name: `port:${p}`,
    ok: deps.portFree(p),
    detail: deps.portFree(p) ? 'free' : 'in use',
  });
  return [
    checkNode(deps.nodeVersion(), 22),
    bin('corepack'),
    bin('bao'),
    port(3000),
    port(7007),
  ];
}
