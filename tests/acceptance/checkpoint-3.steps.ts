import { readFileSync } from 'node:fs';
import { loadFeature, defineFeature } from 'jest-cucumber';

const feature = loadFeature(
  'tests/acceptance/checkpoint-3-community-domain.feature',
);

// Escape a captured value before using it inside a RegExp.
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Split a multi-document YAML string into its individual documents so a check
// can be scoped to the one entity it means (rather than matching name/type
// independently anywhere in the file).
const yamlDocs = (yaml: string) => yaml.split(/^---\s*$/m);

const findDoc = (yaml: string, kind: string, name: string) =>
  yamlDocs(yaml).find(
    d =>
      new RegExp(`kind:\\s*${esc(kind)}\\b`).test(d) &&
      new RegExp(`name:\\s*${esc(name)}\\b`).test(d),
  );

defineFeature(feature, test => {
  let seed = '';
  let appConfig = '';
  let cycleDoc: string | undefined;

  test('the seed declares the MTL org Group tree', ({ given, then, and }) => {
    given('the MTL seed file', () => {
      seed = readFileSync('examples/mtl.yaml', 'utf-8');
    });
    then(/^it declares a Group "(.*)" of type "(.*)"$/, (name, type) => {
      const doc = findDoc(seed, 'Group', name);
      expect(doc).toBeDefined();
      expect(doc!).toMatch(new RegExp(`type:\\s*${esc(type)}\\b`));
    });
    and(/^it declares a Group "(.*)" of type "(.*)"$/, (name, type) => {
      const doc = findDoc(seed, 'Group', name);
      expect(doc).toBeDefined();
      expect(doc!).toMatch(new RegExp(`type:\\s*${esc(type)}\\b`));
    });
  });

  test('the seed declares a season Cycle wired to its league and field', ({ given, then, and }) => {
    given('the MTL seed file', () => {
      seed = readFileSync('examples/mtl.yaml', 'utf-8');
    });
    then(/^it declares a Cycle "(.*)" of type "(.*)"$/, (name, type) => {
      cycleDoc = findDoc(seed, 'Cycle', name);
      expect(cycleDoc).toBeDefined();
      expect(cycleDoc!).toMatch(new RegExp(`type:\\s*${esc(type)}\\b`));
    });
    and(/^that Cycle is "of" group "(.*)"$/, group => {
      expect(cycleDoc!).toMatch(new RegExp(`of:\\s*group:default/${esc(group)}\\b`));
    });
    and(/^that Cycle "happensAt" resource "(.*)"$/, res => {
      // Match the resource within the happensAt array, tolerating extra
      // entries / reflowed formatting rather than only a single inline item.
      expect(cycleDoc!).toMatch(
        new RegExp(`happensAt:\\s*\\[[^\\]]*\\bresource:default/${esc(res)}\\b[^\\]]*\\]`),
      );
    });
  });

  test('the catalog allows the Cycle kind', ({ given, then }) => {
    given('the app-config catalog rules', () => {
      appConfig = readFileSync('app-config.yaml', 'utf-8');
    });
    then(/^the "(.*)" location allows the "(.*)" kind$/, (loc, kind) => {
      // Scope the allow-list to the same location stanza that targets `loc`,
      // so the kind can't be satisfied by a different location's rules.
      expect(appConfig).toMatch(
        new RegExp(
          `target:\\s*\\S*${esc(loc)}[\\s\\S]{0,200}?allow:\\s*\\[[^\\]]*\\b${esc(kind)}\\b`,
        ),
      );
    });
  });
});
