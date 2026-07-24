import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/frontend-test-utils';
import { catalogApiRef, entityRouteRef } from '@backstage/plugin-catalog-react';
import { DrivesBand } from './DrivesBand';

const catalogApi = {
  getEntities: async ({ filter }: any) => {
    if (filter.kind === 'Cycle' && filter['spec.type'] === 'drive') {
      return {
        items: [{
          apiVersion: 'backstage.io/v1alpha1',
          kind: 'Cycle',
          metadata: {
            name: 'dependency-scanning-drive',
            title: 'Dependency scanning drive',
            description: 'Roll out automated dependency scanning across active repos.',
          },
          spec: {
            type: 'drive',
            owner: 'group:default/security-gildi',
            timeframe: { start: '2026-05-01', end: '2099-12-31' },
          },
        }],
      };
    }
    return { items: [] };
  },
};

describe('DrivesBand', () => {
  it('renders a curated drive card with title and description', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[catalogApiRef, catalogApi]]}>
        <DrivesBand />
      </TestApiProvider>,
      { mountedRoutes: { '/catalog/:namespace/:kind/:name': entityRouteRef } },
    );
    expect(await screen.findByText('Dependency scanning drive')).toBeInTheDocument();
    expect(screen.getByText('Roll out automated dependency scanning across active repos.')).toBeInTheDocument();
  });
});
