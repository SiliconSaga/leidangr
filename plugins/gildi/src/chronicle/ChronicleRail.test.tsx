import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/frontend-test-utils';
import { catalogApiRef, entityRouteRef } from '@backstage/plugin-catalog-react';
import { ChronicleRail } from './ChronicleRail';

const catalogApi = {
  getEntities: async ({ filter }: any) => {
    if (filter.kind === 'Saga') {
      return {
        items: [
          {
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'Saga',
            metadata: {
              name: 'saga-tracking-2026-2',
              title: 'Tracking saga, chapter 2',
              description: 'The guild tracks down a lingering regression.',
            },
            spec: {
              skald: 'user:default/runa',
              touches: ['group:default/security-gildi'],
              timeframe: { end: '2026-06-30' },
            },
          },
          {
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'Saga',
            metadata: {
              name: 'saga-dependency-scanning-drive',
              title: 'The dependency scanning drive',
              description: 'How the security guild rolled out automated scanning.',
            },
            spec: {
              skald: 'user:default/astrid',
              touches: ['group:default/security-gildi'],
              timeframe: { end: '2026-07-31' },
            },
          },
        ],
      };
    }
    return { items: [] };
  },
};

describe('ChronicleRail', () => {
  it('renders sagas newest-first with a skald byline', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[catalogApiRef, catalogApi]]}>
        <ChronicleRail />
      </TestApiProvider>,
      { mountedRoutes: { '/catalog/:namespace/:kind/:name': entityRouteRef } },
    );

    const newer = await screen.findByText('The dependency scanning drive');
    const older = screen.getByText('Tracking saga, chapter 2');
    expect(newer).toBeInTheDocument();
    expect(older).toBeInTheDocument();
    // newer should precede older in DOM order
    // eslint-disable-next-line no-bitwise
    expect(newer.compareDocumentPosition(older) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(screen.getByText('astrid')).toBeInTheDocument();
    expect(screen.getByText('runa')).toBeInTheDocument();
  });
});
