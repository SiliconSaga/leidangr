import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/frontend-test-utils';
import { catalogApiRef, entityRouteRef, EntityProvider } from '@backstage/plugin-catalog-react';
import { AdoptersCard } from './AdoptersCard';

const practice = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'security-practice', annotations: { 'siliconsaga.org/aspect': 'security' } },
  spec: { type: 'practice' },
} as any;

const catalogApi = {
  getEntities: async () => ({
    items: [
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'tracking-api',
          title: 'Tracking API',
          annotations: {
            'siliconsaga.org/aspects': 'security, operational-readiness',
            'siliconsaga.org/aspect-versions': 'security@1.4',
          },
        },
        spec: { type: 'service' },
      },
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: { name: 'unrelated', title: 'Unrelated', annotations: {} },
        spec: { type: 'service' },
      },
    ],
  }),
} as any;

describe('AdoptersCard', () => {
  it('lists components enrolled in the aspect with their version, excluding others', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[catalogApiRef, catalogApi]]}>
        <EntityProvider entity={practice}>
          <AdoptersCard />
        </EntityProvider>
      </TestApiProvider>,
      { mountedRoutes: { '/catalog/:namespace/:kind/:name': entityRouteRef } },
    );
    expect(await screen.findByText('Tracking API')).toBeInTheDocument();
    expect(screen.getByText('v1.4')).toBeInTheDocument();
    expect(screen.queryByText('Unrelated')).not.toBeInTheDocument();
  });

  it('distinguishes a practice that declares no aspect from one with zero adopters', async () => {
    const noAspect = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name: 'unconfigured-practice', annotations: {} },
      spec: { type: 'practice' },
    } as any;
    await renderInTestApp(
      <TestApiProvider apis={[[catalogApiRef, catalogApi]]}>
        <EntityProvider entity={noAspect}>
          <AdoptersCard />
        </EntityProvider>
      </TestApiProvider>,
      { mountedRoutes: { '/catalog/:namespace/:kind/:name': entityRouteRef } },
    );
    expect(
      await screen.findByText('This practice does not declare a maintained aspect.'),
    ).toBeInTheDocument();
  });

  it('shows a spinner while adopters load', async () => {
    const pending = { getEntities: () => new Promise(() => {}) } as any;
    await renderInTestApp(
      <TestApiProvider apis={[[catalogApiRef, pending]]}>
        <EntityProvider entity={practice}>
          <AdoptersCard />
        </EntityProvider>
      </TestApiProvider>,
      { mountedRoutes: { '/catalog/:namespace/:kind/:name': entityRouteRef } },
    );
    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('shows an error panel when the catalog query fails', async () => {
    const failing = {
      getEntities: async () => {
        throw new Error('catalog boom');
      },
    } as any;
    await renderInTestApp(
      <TestApiProvider apis={[[catalogApiRef, failing]]}>
        <EntityProvider entity={practice}>
          <AdoptersCard />
        </EntityProvider>
      </TestApiProvider>,
      { mountedRoutes: { '/catalog/:namespace/:kind/:name': entityRouteRef } },
    );
    expect((await screen.findAllByText(/catalog boom/)).length).toBeGreaterThan(0);
  });
});
