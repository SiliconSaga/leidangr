import { fireEvent, screen } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import { AdoptAspectCard } from './AdoptAspectCard';

// Renders the router's current location so a click can be observed as
// navigation rather than inferred from markup.
function LocationProbe() {
  const { pathname, search } = useLocation();
  return <span data-testid="location">{`${pathname}${search}`}</span>;
}

describe('AdoptAspectCard', () => {
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
    // /create/templates, not /create — /create redirects to the list and the
    // redirect drops the query string, so the filter silently never applies.
    expect(url.pathname).toBe('/create/templates');
    expect(url.searchParams.get('filters[type]')).toBe('aspect');
  });

  it('navigates client-side on click rather than reloading the page', async () => {
    await renderInTestApp(
      <>
        <AdoptAspectCard />
        <LocationProbe />
      </>,
    );
    const cta = screen.getByRole('button', { name: /adopt an aspect/i });

    // Still an anchor, so middle-click and open-in-new-tab work.
    expect(cta.tagName).toBe('A');

    // The load-bearing assertion. tagName and href alone are satisfied by a
    // plain <a href>, which would full-page-reload — the pattern the
    // 2026-07-22 review flagged on the Actions panel. Only a react-router Link
    // moves the router in place, so observing useLocation change is what
    // actually distinguishes the two.
    fireEvent.click(cta);
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/create/templates?filters[type]=aspect',
    );
  });
});
