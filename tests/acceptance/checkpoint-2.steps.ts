import { loadFeature, defineFeature } from 'jest-cucumber';
import { readFileSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { resolveTarget, validateKeys, renderEnvLocal } from '../../scripts/lib/dev-secrets';

// The @live scenario is the real end-to-end proof (plan Task 8) — excluded here.
const feature = loadFeature('tests/acceptance/checkpoint-2-openbao-gitea.feature', {
  tagFilter: 'not @live',
});

defineFeature(feature, test => {
  test('dev-secrets renders .env.local from an OpenBao KV response', ({ given, when, then, and }) => {
    let data: Record<string, string>;
    let rendered: ReturnType<typeof renderEnvLocal>;
    given('an OpenBao KV response containing a "gitea_token" key', () => {
      data = { gitea_token: 'super-secret' };
    });
    when('dev-secrets renders the local environment file', () => {
      rendered = renderEnvLocal(data, { gitea_token: 'GITEA_TOKEN' });
    });
    then('the rendered file sets GITEA_TOKEN to the gitea_token value', () => {
      expect(rendered.content).toBe("GITEA_TOKEN='super-secret'\n");
    });
    and('the summary reports gitea_token as present without printing its value', () => {
      expect(rendered.presentKeys).toEqual(['gitea_token']);
      expect(rendered.presentKeys.join(',')).not.toContain('super-secret');
    });
  });

  test('dev-secrets fails clearly when a required key is missing', ({ given, when, then, and }) => {
    let data: Record<string, string>;
    let result: ReturnType<typeof validateKeys>;
    given('an OpenBao KV response missing the "gitea_token" key', () => {
      // Has the user but not the token, so the runner fails specifically on the
      // missing gitea_token rather than on any early/empty-payload error.
      data = { gitea_user: 'alice' };
    });
    when('dev-secrets validates the required keys', () => {
      result = validateKeys(data, ['gitea_token']);
    });
    then('validation fails', () => {
      expect(result.ok).toBe(false);
    });
    and('it reports that the required key "gitea_token" is missing', () => {
      expect(result.missing).toContain('gitea_token');
    });
    and('no environment file is written', () => {
      // Drive the actual writer (run-dev-secrets.mjs) with the missing-key payload in a
      // throwaway cwd and confirm it exits non-zero WITHOUT creating .env.local.
      const tmp = mkdtempSync(join(tmpdir(), 'leidangr-dev-secrets-'));
      const mjs = resolve(__dirname, '../../scripts/lib/run-dev-secrets.mjs');
      let stderr = '';
      try {
        execFileSync(process.execPath, [mjs], { input: JSON.stringify({ data: { data } }), cwd: tmp, stdio: 'pipe' });
      } catch (error) {
        stderr = String((error as { stderr?: Buffer }).stderr ?? '');
      }
      // Prove it failed on THIS path (missing gitea_token), not any early error.
      expect(stderr).toContain('missing required key(s): gitea_token');
      expect(existsSync(join(tmp, '.env.local'))).toBe(false);
      rmSync(tmp, { recursive: true, force: true });
    });
  });

  test('dev-secrets selects the target without the app knowing', ({ given, when, then, and }) => {
    let target: ReturnType<typeof resolveTarget>;
    given('the BAO_ADDR environment variable is set to a direct URL', () => {});
    when('dev-secrets resolves the OpenBao target', () => {
      target = resolveTarget({ BAO_ADDR: 'https://openbao.cmdbee.org' });
    });
    then('it uses the direct URL', () => {
      expect(target).toEqual({ mode: 'direct', addr: 'https://openbao.cmdbee.org' });
    });
    and('it does not start a port-forward', () => {
      expect(target.mode).not.toBe('port-forward');
    });
  });

  test('dev-secrets falls back to a port-forward when no direct URL is set', ({ given, when, then }) => {
    let target: ReturnType<typeof resolveTarget>;
    given('the BAO_ADDR environment variable is not set', () => {});
    when('dev-secrets resolves the OpenBao target', () => {
      target = resolveTarget({});
    });
    then('it selects the port-forward target', () => {
      expect(target).toEqual({ mode: 'port-forward' });
    });
  });

  // Catalog-SOURCE/config contract check, NOT real ingestion — the real token-backed
  // Gitea ingestion is covered live by `make smoke-gitea` (a startTestBackend port is
  // tracked as phase-3 hardening).
  test('Contract check: the Gitea catalog overlay is wired and the seed declares two entities', ({ given, when, then, and }) => {
    let fixture: string;
    let giteaConfig: string;
    given('the Gitea catalog overlay and the catalog-seed fixture', () => {
      fixture = readFileSync('tests/acceptance/fixtures/gitea-catalog-info.yaml', 'utf8');
      giteaConfig = readFileSync('app-config.gitea.yaml', 'utf8');
    });
    when('I inspect the source wiring', () => {});
    then('the overlay defines a token-authenticated Gitea url location', () => {
      expect(giteaConfig).toMatch(/gitea:/);
      expect(giteaConfig).toMatch(/username:\s*\$\{GITEA_USER\}/);
      expect(giteaConfig).toMatch(/password:\s*\$\{GITEA_TOKEN\}/);
      expect(giteaConfig).toMatch(/type:\s*url/);
    });
    and('the seed fixture declares two entities', () => {
      const entityCount = (fixture.match(/^apiVersion:/gm) || []).length;
      expect(entityCount).toBe(2);
      // Pin the names too: scripts/smoke-gitea.sh hard-codes these, so a fixture
      // rename must break here on the fast path, not later in the @live smoke.
      // Anchor the whole line so a suffixed rename (leidangr-portal-v2) still fails.
      expect(fixture).toMatch(/^\s*name:\s*leidangr-portal\s*$/m);
      expect(fixture).toMatch(/^\s*name:\s*gear-swap\s*$/m);
    });
  });
});
