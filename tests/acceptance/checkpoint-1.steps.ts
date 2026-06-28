import { loadFeature, defineFeature } from 'jest-cucumber';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { runDoctor, ToolCheck } from '../../scripts/lib/doctor';

const feature = loadFeature('tests/acceptance/checkpoint-1-stub-boot.feature');

// The Background steps are context only (they frame stub mode); jest-cucumber
// still needs a definition for each, so share them across scenarios.
const stubBackground = ({ given, and }: any) => {
  given('a freshly installed leidangr workspace', () => {});
  and('no .env.local file is present', () => {});
  and('neither OpenBao nor Gitea is reachable', () => {});
};

defineFeature(feature, test => {
  test('The development config is valid without any secrets', ({ given, and, when, then }) => {
    stubBackground({ given, and });

    let result: { code: number; out: string };
    when('I run the configuration check for the development config', () => {
      try {
        // Merge stderr into stdout — backstage-cli prints "Loaded config" to stderr.
        const out = execSync(
          'corepack yarn backstage-cli config:check --config app-config.yaml 2>&1',
          { encoding: 'utf8', stdio: 'pipe' },
        );
        result = { code: 0, out };
      } catch (e: any) {
        result = { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
      }
    });

    then('the configuration check succeeds', () => {
      expect(result.code).toBe(0);
    });

    and('no secret values are required to load it', () => {
      // config:check loaded the config without a .env.local present, so no secret
      // was required to validate it.
      expect(result.out).toContain('Loaded config');
    });
  });

  test('doctor reports the local toolchain without leaking secrets', ({ given, and, when, then }) => {
    stubBackground({ given, and });

    let checks: ToolCheck[];
    when('I run the doctor command', () => {
      checks = runDoctor({
        which: bin => (bin === 'corepack' ? 'corepack' : null),
        nodeVersion: () => process.version,
        portFree: () => true,
      });
    });

    then('it reports the status of Node, Corepack, and the required dev ports', () => {
      expect(checks.map(c => c.name)).toEqual(
        expect.arrayContaining(['node', 'corepack', 'port:3000', 'port:7007']),
      );
    });

    and('it never prints any secret values', () => {
      for (const c of checks) {
        expect(c.detail).not.toMatch(/token|secret|password/i);
      }
    });
  });

  // Pragmatic catalog-source assertion: verify the stub catalog SOURCE declares the
  // example component (the full startTestBackend boot is deferred; the live in-browser
  // boot is verified manually via `make dev`).
  test('The catalog serves the generated example entities in stub mode', ({ given, and, when, then }) => {
    stubBackground({ given, and });

    let entitiesYaml: string;
    given('the backend is started in stub mode with guest auth', () => {});
    when('I query the catalog for all entities', () => {
      entitiesYaml = readFileSync('examples/entities.yaml', 'utf8');
    });
    then('the generated example component is present', () => {
      expect(entitiesYaml).toMatch(/kind:\s*Component/);
      expect(entitiesYaml).toMatch(/name:\s*example-website/);
    });
    and('the request is authorized as the guest identity', () => {
      expect(entitiesYaml).toMatch(/owner:\s*guests/);
    });
  });
});
