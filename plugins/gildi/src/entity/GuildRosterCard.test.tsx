import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/frontend-test-utils';
import { catalogApiRef, entityRouteRef, EntityProvider } from '@backstage/plugin-catalog-react';
import { GuildRosterCard } from './GuildRosterCard';

const guild = {
  apiVersion: 'backstage.io/v1alpha1', kind: 'Group',
  metadata: { name: 'security-gildi', title: 'Security guild', annotations: { 'siliconsaga.org/stewards': 'aspect:security' } },
  spec: { type: 'guild' },
} as any;

const catalogApi = {
  getEntities: async ({ filter }: any) => {
    if (filter['spec.type'] === 'practice') {
      return { items: [{
        apiVersion: 'backstage.io/v1alpha1', kind: 'Component',
        metadata: { name: 'security-practice', title: 'Security practice', annotations: { 'siliconsaga.org/aspect': 'security' } },
        spec: { type: 'practice', owner: 'group:default/security-gildi' },
      }] };
    }
    return { items: [] };
  },
};

describe('GuildRosterCard', () => {
  it('lists a linked practice and an aspect chip', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[catalogApiRef, catalogApi]]}>
        <EntityProvider entity={guild}>
          <GuildRosterCard />
        </EntityProvider>
      </TestApiProvider>,
      { mountedRoutes: { '/catalog/:namespace/:kind/:name': entityRouteRef } },
    );
    expect(await screen.findByText('Security practice')).toBeInTheDocument();
    expect(screen.getByText('security aspect')).toBeInTheDocument();
  });
});
