import { readFileSync } from 'fs';
import { loadFeature, defineFeature } from 'jest-cucumber';

const feature = loadFeature(
  'tests/acceptance/checkpoint-3-community-domain.feature',
);

defineFeature(feature, test => {
  let seed = '';
  let appConfig = '';

  test('the seed declares the MTL org Group tree', ({ given, then, and }) => {
    given('the MTL seed file', () => {
      seed = readFileSync('examples/mtl.yaml', 'utf-8');
    });
    then(/^it declares a Group "(.*)" of type "(.*)"$/, (name, type) => {
      expect(seed).toMatch(new RegExp(`kind:\\s*Group[\\s\\S]*?name:\\s*${name}\\b`));
      expect(seed).toMatch(new RegExp(`type:\\s*${type}\\b`));
    });
    and(/^it declares a Group "(.*)" of type "(.*)"$/, (name, type) => {
      expect(seed).toMatch(new RegExp(`name:\\s*${name}\\b`));
      expect(seed).toMatch(new RegExp(`type:\\s*${type}\\b`));
    });
  });

  test('the seed declares a season Cycle wired to its league and field', ({ given, then, and }) => {
    given('the MTL seed file', () => {
      seed = readFileSync('examples/mtl.yaml', 'utf-8');
    });
    then(/^it declares a Cycle "(.*)" of type "(.*)"$/, (name, type) => {
      expect(seed).toMatch(/kind:\s*Cycle/);
      expect(seed).toMatch(new RegExp(`name:\\s*${name}\\b`));
      expect(seed).toMatch(new RegExp(`type:\\s*${type}\\b`));
    });
    and(/^that Cycle is "of" group "(.*)"$/, group => {
      expect(seed).toMatch(new RegExp(`of:\\s*group:default/${group}\\b`));
    });
    and(/^that Cycle "happensAt" resource "(.*)"$/, res => {
      expect(seed).toMatch(new RegExp(`happensAt:\\s*\\[resource:default/${res}\\]`));
    });
  });

  test('the catalog allows the Cycle kind', ({ given, then }) => {
    given('the app-config catalog rules', () => {
      appConfig = readFileSync('app-config.yaml', 'utf-8');
    });
    then(/^the "(.*)" location allows the "(.*)" kind$/, (loc, kind) => {
      expect(appConfig).toMatch(new RegExp(`${loc.replace('.', '\\.')}`));
      expect(appConfig).toMatch(new RegExp(`allow:\\s*\\[[^\\]]*\\b${kind}\\b`));
    });
  });
});
