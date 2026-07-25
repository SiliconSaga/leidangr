import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/frontend-test-utils';
import { catalogApiRef, entityRouteRef, EntityProvider } from '@backstage/plugin-catalog-react';
import { GuildChronicleCard } from './GuildChronicleCard';

const guild = {
  apiVersion: 'backstage.io/v1alpha1', kind: 'Group',
  metadata: { name: 'security-gildi', title: 'Security guild' },
  spec: { type: 'guild' },
} as any;

const catalogApi = {
  getEntities: async ({ filter }: any) => {
    if (filter.kind === 'Saga') {
      return { items: [{
        apiVersion: 'backstage.io/v1alpha1', kind: 'Saga',
        metadata: { name: 'dep-scan-drive', title: 'Dependency scanning drive' },
        spec: { touches: ['group:default/security-gildi'], timeframe: { end: '2026-06-01' } },
      }] };
    }
    if (filter.kind === 'Cycle' && filter['spec.type'] === 'drive') {
      return { items: [{
        apiVersion: 'backstage.io/v1alpha1', kind: 'Cycle',
        metadata: { name: 'q2-hardening', title: 'Q2 hardening drive' },
        spec: { type: 'drive', owner: 'group:default/security-gildi', timeframe: { start: '2026-04-01', end: '2026-06-30' } },
      }] };
    }
    return { items: [] };
  },
};

describe('GuildChronicleCard', () => {
  it('lists a saga touching the guild and a drive it owns', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[catalogApiRef, catalogApi]]}>
        <EntityProvider entity={guild}>
          <GuildChronicleCard />
        </EntityProvider>
      </TestApiProvider>,
      { mountedRoutes: { '/catalog/:namespace/:kind/:name': entityRouteRef } },
    );
    expect(await screen.findByText('Dependency scanning drive')).toBeInTheDocument();
    expect(screen.getByText('Q2 hardening drive')).toBeInTheDocument();
  });
});
