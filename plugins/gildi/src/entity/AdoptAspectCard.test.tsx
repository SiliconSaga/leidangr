import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import { AdoptAspectCard } from './AdoptAspectCard';

describe('AdoptAspectCard', () => {
  // MUI v4's focus-visible helper calls findDOMNode on the rendered anchor, and
  // React logs a deprecation warning for it on every render — third-party noise
  // that buries this suite's real failure output. Swallow only that warning;
  // anything else still reaches the console.
  let consoleError: jest.SpyInstance;
  beforeAll(() => {
    // eslint-disable-next-line no-console -- deliberately filtering console.error
    const real = console.error;
    consoleError = jest.spyOn(console, 'error').mockImplementation((...args) => {
      if (typeof args[0] === 'string' && args[0].includes('findDOMNode is deprecated')) return;
      real(...args);
    });
  });
  afterAll(() => consoleError.mockRestore());

  it('invites adoption and routes to the Create page filtered to aspect templates', async () => {
    await renderInTestApp(<AdoptAspectCard />);
    expect(await screen.findByText('Not enrolled in any aspect.')).toBeInTheDocument();

    // MUI v4's Button stamps an explicit role="button" on the anchor it renders
    // for `component`, so this is NOT queryable as a link despite being an <a>.
    const cta = screen.getByRole('button', { name: /adopt an aspect/i });
    // `filters[type]` is the qs-bracket form useEntityListProvider parses into
    // queryParameters, which useEntityTypeFilter (the Create page's category
    // picker) seeds its selection from. Aspect templates are spec.type: aspect.
    //
    // Assert the MEANING, not the encoding: react-router may pass the search
    // through verbatim or percent-encode the brackets, and qs.parse accepts
    // either — so pinning one literal form would test an incidental detail.
    const url = new URL(cta.getAttribute('href')!, 'http://localhost');
    expect(url.pathname).toBe('/create');
    expect(url.searchParams.get('filters[type]')).toBe('aspect');
  });

  it('routes without a full page reload', async () => {
    await renderInTestApp(<AdoptAspectCard />);
    const cta = screen.getByRole('button', { name: /adopt an aspect/i });
    // A react-router Link renders an anchor with an app-relative href; an
    // <a href> to an absolute URL would full-page-reload — the pattern the
    // 2026-07-22 review flagged on the Actions panel.
    expect(cta.tagName).toBe('A');
    expect(cta.getAttribute('href')).toMatch(/^\/create/);
  });
});
