/**
 * Jest config for the DevEx envelope + BDD acceptance tests.
 *
 * Separate from `backstage-cli repo test` (which only discovers tests inside
 * packages/* and plugins/*). This config covers the envelope tooling under
 * scripts/ and the jest-cucumber acceptance specs under tests/.
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/scripts', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.steps.ts'],
  // The config:check acceptance scenario spawns the Backstage CLI, which is slow to boot.
  testTimeout: 60000,
  // The shared package ships TypeScript source rather than a build, and Jest
  // will not transform through the node_modules symlink yarn creates for a
  // workspace. Resolving the name to the source keeps it inside rootDir, where
  // the transform below already applies.
  moduleNameMapper: {
    '^@siliconsaga/plugin-gildi-common$': '<rootDir>/plugins/gildi-common/src/index.ts',
  },
  transform: {
    '^.+\\.(t|j)s$': [
      '@swc/jest',
      { jsc: { parser: { syntax: 'typescript' }, target: 'es2022' } },
    ],
  },
};
