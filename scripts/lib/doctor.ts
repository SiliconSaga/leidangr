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
 * TechDocs shells out to `mkdocs` **without a shell**, so Node has to exec the
 * file directly. A pyenv shim (`mkdocs.bat`, or the extensionless `mkdocs`
 * launcher) cannot be exec'd that way and fails at render time with a bare
 * `spawn mkdocs ENOENT` — long after `make dev` looked healthy.
 *
 * This is deliberately harsher than a presence check: a shim on PATH is worse
 * than nothing there, because it reports as installed while never working.
 */
export function checkMkdocs(resolved: string | null): ToolCheck {
  if (resolved === null) {
    return { name: 'mkdocs', ok: false, detail: 'not found on PATH (TechDocs will not render)' };
  }
  // Only Windows shims are the problem. A `.bat`/`.cmd` needs a shell, which the
  // spawn deliberately does not use, and pyenv-win's extensionless launcher is
  // no better — Windows can only exec a real executable. A POSIX pyenv shim is
  // an ordinary shebang script that execvp runs happily, so flagging every
  // `shims/` path would fail this check on macOS and Linux where it works.
  const isWindowsBatch = /\.(bat|cmd)$/i.test(resolved);
  const isPyenvWinShim = /pyenv-win/i.test(resolved) && /[\\/]shims[\\/]/i.test(resolved);
  const isShim = isWindowsBatch || isPyenvWinShim;
  return {
    name: 'mkdocs',
    ok: !isShim,
    detail: isShim
      ? `${resolved} is a shim — make dev wraps this, a direct launch fails with "spawn mkdocs ENOENT"`
      : resolved,
  };
}

/**
 * Run all toolchain checks (Node, Corepack, bao, mkdocs, the dev ports) using
 * injected probes. Returns one ToolCheck per item and never includes secret
 * values.
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
    checkMkdocs(deps.which('mkdocs')),
    port(3000),
    port(7007),
  ];
}
