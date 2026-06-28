// Real-IO wiring for the `doctor` check (the testable logic lives in doctor.ts).
// Run by `make doctor` via Node's native type-stripping (Node 22+ / 24).
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { runDoctor } from './doctor.ts';

function whichSync(bin) {
  const exts = process.platform === 'win32' ? ['', '.cmd', '.exe', '.bat'] : [''];
  const dirs = (process.env.PATH ?? '').split(path.delimiter);
  for (const dir of dirs) {
    if (!dir) continue;
    for (const ext of exts) {
      const full = path.join(dir, bin + ext);
      try {
        if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
      } catch {
        // ignore unreadable PATH entries
      }
    }
  }
  return null;
}

function checkPortFree(port) {
  return new Promise(resolve => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}

const ports = [3000, 7007];
const free = new Set();
for (const p of ports) {
  if (await checkPortFree(p)) free.add(p);
}

const checks = runDoctor({
  which: whichSync,
  nodeVersion: () => process.version,
  portFree: p => free.has(p),
});

// node + corepack (which provides yarn) are required; bao + ports are advisory.
const required = new Set(['node', 'corepack']);
let fatal = false;
for (const c of checks) {
  const mark = c.ok ? 'ok  ' : required.has(c.name) ? 'FAIL' : 'warn';
  if (!c.ok && required.has(c.name)) fatal = true;
  console.log(`  ${mark}  ${c.name.padEnd(12)} ${c.detail}`);
}
console.log(fatal ? '\ndoctor: required tooling missing' : '\ndoctor: ok');
process.exit(fatal ? 1 : 0);
