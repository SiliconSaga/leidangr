import '@testing-library/jest-dom';

// MUI v4's focus-visible and Tooltip helpers call findDOMNode, and React logs a
// deprecation warning for it on every render. Nothing in this plugin can fix it
// short of leaving MUI v4, and the volume is high enough to bury real assertion
// output in a full-suite run. Swallow that one warning; everything else still
// reaches the console.
// eslint-disable-next-line no-console -- filtering console.error is the point
const realConsoleError = console.error;
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (typeof args[0] === 'string' && args[0].includes('findDOMNode is deprecated')) return;
    realConsoleError(...args);
  });
});
afterAll(() => jest.restoreAllMocks());
