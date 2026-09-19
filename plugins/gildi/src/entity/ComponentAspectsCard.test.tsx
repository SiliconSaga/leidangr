import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/frontend-test-utils';
import { catalogApiRef, entityRouteRef, EntityProvider } from '@backstage/plugin-catalog-react';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { ComponentAspectsCard } from './ComponentAspectsCard';

// The trials endpoint, faked at the fetch boundary so the badge is exercised
// through the same hook the real card uses rather than around it.
const discovery = { getBaseUrl: async () => 'http://x/api/gildi' } as any;

const trials = (body: unknown, status = 200) =>
  ({
    fetch: async () =>
      ({
        ok: status === 200,
        status,
        json: async () => body,
      }) as any,
  }) as any;

// 404 is the NORMAL state for a component the sweep has not reached, not an
// error — and it is what every test that is not about the badge should see.
const noRuns = trials(undefined, 404);

const practices = {
  getEntities: async () => ({
    items: [
      {
        apiVersion: 'backstage.io/v1alpha1', kind: 'Component',
        metadata: {
          name: 'security-practice', title: 'Security practice',
          annotations: {
            'siliconsaga.org/aspect': 'security',
            'siliconsaga.org/module-release': '1.4',
          },
        },
        spec: { type: 'practice', owner: 'group:default/security-gildi' },
      },
    ],
  }),
} as any;

const component = (annotations: Record<string, string>) => ({
  apiVersion: 'backstage.io/v1alpha1', kind: 'Component',
  metadata: { name: 'a-component', annotations },
  spec: { type: 'service' },
}) as any;

const render = async (entity: any, catalogApi: any = practices, fetchApi: any = noRuns) =>
  renderInTestApp(
    <TestApiProvider
      apis={[
        [catalogApiRef, catalogApi],
        [discoveryApiRef, discovery],
        [fetchApiRef, fetchApi],
      ]}
    >
      <EntityProvider entity={entity}>
        <ComponentAspectsCard />
      </EntityProvider>
    </TestApiProvider>,
    { mountedRoutes: { '/catalog/:namespace/:kind/:name': entityRouteRef } },
  );

const enrolled = () =>
  component({
    'siliconsaga.org/aspects': 'security',
    'siliconsaga.org/aspect-versions': 'security@1.4',
  });

const run = (over: Record<string, unknown> = {}) => ({
  entityRef: 'component:default/a-component',
  aspectId: 'security',
  runAt: '2026-09-18T10:00:00.000Z',
  kind: 'evaluated',
  medal: 'gold',
  suppressedReasons: null,
  applicable: 4,
  passing: 4,
  outcomes: [],
  ...over,
});

describe('ComponentAspectsCard', () => {
  it('marks an adoption at the current release as current, and links its record', async () => {
    await render(component({
      'siliconsaga.org/aspects': 'security',
      'siliconsaga.org/aspect-versions': 'security@1.4',
      'siliconsaga.org/adoption-record': 'security: https://git.example/x/pull/412',
    }));
    expect(await screen.findByText('Security')).toBeInTheDocument();
    expect(screen.getByText('v1.4')).toBeInTheDocument();
    expect(screen.getByText('current')).toBeInTheDocument();
    // core-components' Link appends a visually-hidden ", Opens in a new window"
    // to external anchors, and that counts toward the accessible name — so this
    // must match by prefix, not equality.
    expect(screen.getByRole('link', { name: /^record/ })).toHaveAttribute(
      'href', 'https://git.example/x/pull/412',
    );
  });

  it('pills the current release alongside the adopted one when behind, without claiming a distance', async () => {
    await render(component({
      'siliconsaga.org/aspects': 'security',
      'siliconsaga.org/aspect-versions': 'security@1.2',
    }));
    expect(await screen.findByText('v1.2')).toBeInTheDocument();
    // Leads with 'behind', not 'current', so the two states differ by wording
    // and not only by colour — the card must read in greyscale.
    expect(screen.getByText('behind · 1.4')).toBeInTheDocument();
    expect(screen.queryByText(/release behind/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^record/ })).not.toBeInTheDocument();
  });

  it('links the maintaining practice as a pill and shows its guild crest', async () => {
    await render(component({ 'siliconsaga.org/aspects': 'security' }));
    const practice = await screen.findByRole('link', { name: 'Security practice' });
    expect(practice).toHaveAttribute('href', '/catalog/default/component/security-practice');
    expect(screen.getByLabelText('Arms of security-gildi')).toBeInTheDocument();
  });

  it('titles the aspect slug rather than showing raw metadata', async () => {
    await render(component({ 'siliconsaga.org/aspects': 'operational-readiness' }));
    expect(await screen.findByText('Operational readiness')).toBeInTheDocument();
    expect(screen.queryByText('operational-readiness')).not.toBeInTheDocument();
  });

  it('renders an aspect with no practice as enrolled only — no link, no verdict', async () => {
    await render(component({ 'siliconsaga.org/aspects': 'operational-readiness' }));
    expect(await screen.findByText('Operational readiness')).toBeInTheDocument();
    expect(screen.getByText('enrolled')).toBeInTheDocument();
    expect(screen.queryByText(/^current/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^behind/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders one row per aspect, resolving each independently', async () => {
    await render(component({
      'siliconsaga.org/aspects': 'security, operational-readiness',
      'siliconsaga.org/aspect-versions': 'security@1.4',
    }));
    expect(await screen.findByText('Security')).toBeInTheDocument();
    expect(screen.getByText('Operational readiness')).toBeInTheDocument();
    expect(screen.getByText('current')).toBeInTheDocument();
    expect(screen.getByText('enrolled')).toBeInTheDocument();
  });

  // The cell is present on every row whether or not a badge lands in it, so the
  // grid keeps its four columns and the rows stay aligned. (What goes IN it is
  // the badge suite below; this is the structural half, which is why it still
  // holds now that the cell can be filled.)
  it('keeps the badge cell on every row so the columns stay aligned', async () => {
    await render(component({ 'siliconsaga.org/aspects': 'security' }));
    expect(await screen.findByTestId('aspect-badge-security')).toBeInTheDocument();
  });

  it('joins and compares through padded practice annotations', async () => {
    const padded = {
      getEntities: async () => ({
        items: [
          {
            apiVersion: 'backstage.io/v1alpha1', kind: 'Component',
            metadata: {
              name: 'security-practice', title: 'Security practice',
              annotations: {
                'siliconsaga.org/aspect': '  security  ',
                'siliconsaga.org/module-release': ' 1.4 ',
              },
            },
            spec: { type: 'practice', owner: 'group:default/security-gildi' },
          },
        ],
      }),
    } as any;
    await render(component({
      'siliconsaga.org/aspects': 'security',
      'siliconsaga.org/aspect-versions': 'security@1.4',
    }), padded);
    // Untrimmed, the join would miss entirely and this would read 'enrolled';
    // trimmed-on-one-side-only, ' 1.4 ' !== '1.4' would read 'behind'.
    expect(await screen.findByText('current')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Security practice' })).toBeInTheDocument();
  });

  it('drops a record link whose URL is not http(s)', async () => {
    await render(component({
      'siliconsaga.org/aspects': 'security',
      'siliconsaga.org/adoption-record': 'security: javascript:alert(1)',
    }));
    expect(await screen.findByText('Security')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^record/ })).not.toBeInTheDocument();
  });

  it('shows a spinner while the practices load', async () => {
    await render(component({ 'siliconsaga.org/aspects': 'security' }), {
      getEntities: () => new Promise(() => {}),
    } as any);
    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('shows an error panel when the catalog query fails', async () => {
    await render(component({ 'siliconsaga.org/aspects': 'security' }), {
      getEntities: async () => { throw new Error('catalog boom'); },
    } as any);
    expect((await screen.findAllByText(/catalog boom/)).length).toBeGreaterThan(0);
  });

  // THE BADGE. The row-level states are unit-tested in ../badge; these assert
  // the wiring — that the card reaches the endpoint for its own aspect and puts
  // the result in the reserved cell.
  describe('the earned badge', () => {
    it('renders the medal a run earned', async () => {
      await render(enrolled(), practices, trials(run({ medal: 'gold' })));
      expect(await screen.findByTestId('medal-gold')).toBeInTheDocument();
      expect(screen.getByText('gold')).toBeInTheDocument();
    });

    // A component the sweep has not reached is not a finding. The cell stays
    // empty rather than showing a placeholder, which is the promise the
    // reserved cell made before anything could fill it.
    it('draws nothing at all when no run exists yet', async () => {
      await render(enrolled(), practices, noRuns);
      expect(await screen.findByText('Security')).toBeInTheDocument();
      expect(screen.getByTestId('aspect-badge-security')).toBeEmptyDOMElement();
    });

    // The distinction the outcome model exists for, asserted where a user would
    // actually see it: a withheld medal must not render as `none`.
    it('separates a withheld medal from a measured none', async () => {
      await render(
        enrolled(),
        practices,
        trials(run({ medal: null, suppressedReasons: ['no-resolver'], passing: 3 })),
      );
      expect(await screen.findByTestId('medal-withheld')).toBeInTheDocument();
      expect(screen.queryByTestId('medal-none')).not.toBeInTheDocument();
      expect(screen.getByText('withheld')).toBeInTheDocument();
    });

    it('names an unevaluated run rather than leaving it blank', async () => {
      await render(
        enrolled(),
        practices,
        trials(run({ kind: 'unevaluated', medal: null, applicable: null, passing: null })),
      );
      expect(await screen.findByTestId('medal-unevaluated')).toBeInTheDocument();
      expect(screen.getByText('not evaluated')).toBeInTheDocument();
    });

    it('explains the medal on hover, counting the trials behind it', async () => {
      await render(enrolled(), practices, trials(run({ medal: 'silver', passing: 3 })));
      expect(await screen.findByTestId('medal-silver')).toHaveAttribute(
        'title',
        'Silver — 3 of 4 applicable trials passed',
      );
    });
  });
});
