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
  transform: {
    '^.+\\.(t|j)s$': [
      '@swc/jest',
      { jsc: { parser: { syntax: 'typescript' }, target: 'es2022' } },
    ],
  },
};
