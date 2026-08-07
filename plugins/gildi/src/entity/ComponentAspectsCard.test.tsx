import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/frontend-test-utils';
import { catalogApiRef, entityRouteRef, EntityProvider } from '@backstage/plugin-catalog-react';
import { ComponentAspectsCard } from './ComponentAspectsCard';

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

const render = async (entity: any, catalogApi: any = practices) =>
  renderInTestApp(
    <TestApiProvider apis={[[catalogApiRef, catalogApi]]}>
      <EntityProvider entity={entity}>
        <ComponentAspectsCard />
      </EntityProvider>
    </TestApiProvider>,
    { mountedRoutes: { '/catalog/:namespace/:kind/:name': entityRouteRef } },
  );

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

  it('reserves the badge cell on every row without rendering anything in it', async () => {
    await render(component({ 'siliconsaga.org/aspects': 'security' }));
    const badge = await screen.findByTestId('aspect-badge-security');
    expect(badge).toBeInTheDocument();
    expect(badge).toBeEmptyDOMElement();
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
});
