import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/frontend-test-utils';
import { catalogApiRef, entityRouteRef, EntityProvider } from '@backstage/plugin-catalog-react';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import type { TrialRun } from '@siliconsaga/plugin-gildi-common';
import { ComponentTrialHistoryCard } from './ComponentTrialHistoryCard';

const discovery = { getBaseUrl: async () => 'http://x/api/gildi' } as any;

const histories = (body: unknown, status = 200) =>
  ({
    fetch: async () => ({ ok: status === 200, status, json: async () => body }) as any,
  }) as any;

const practices = { getEntities: async () => ({ items: [] }) } as any;

const component = (annotations: Record<string, string>) =>
  ({
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name: 'a-component', annotations },
    spec: { type: 'service' },
  }) as any;

const enrolled = (aspects = 'security') =>
  component({ 'siliconsaga.org/aspects': aspects });

const run = (over: Partial<TrialRun> = {}): TrialRun => ({
  entityRef: 'component:default/a-component',
  aspectId: 'security',
  runAt: '2026-09-01T00:00:00.000Z',
  kind: 'evaluated',
  medal: 'gold',
  suppressedReasons: null,
  applicable: 4,
  passing: 4,
  outcomes: [],
  ...over,
});

const at = (day: number, over: Partial<TrialRun> = {}) =>
  run({ runAt: `2026-09-0${day}T00:00:00.000Z`, ...over });

const render = (entity: any, fetchApi: any) =>
  renderInTestApp(
    <TestApiProvider
      apis={[
        [catalogApiRef, practices],
        [discoveryApiRef, discovery],
        [fetchApiRef, fetchApi],
      ]}
    >
      <EntityProvider entity={entity}>
        <ComponentTrialHistoryCard />
      </EntityProvider>
    </TestApiProvider>,
    { mountedRoutes: { '/catalog/:namespace/:kind/:name': entityRouteRef } },
  );

describe('ComponentTrialHistoryCard', () => {
  it('charts an aspect with enough measured history', async () => {
    await render(
      enrolled(),
      histories({ runs: [at(2), at(1)], events: [] }),
    );
    expect(await screen.findByTestId('medal-history')).toBeInTheDocument();
  });

  it('renders one section per adopted aspect', async () => {
    await render(
      enrolled('security, operational-readiness'),
      histories({ runs: [at(2), at(1)], events: [] }),
    );
    expect(await screen.findByTestId('history-security')).toBeInTheDocument();
    expect(screen.getByTestId('history-operational-readiness')).toBeInTheDocument();
  });

  // ⚠ The trap `canChart` exists for. The chart element is created whether or
  // not it will draw, so a card that rendered it and hoped would show a blank
  // panel with no explanation. Asked beforehand, it can say why.
  it('explains a blank instead of showing one when history is too short', async () => {
    await render(enrolled(), histories({ runs: [at(1)], events: [] }));
    expect(await screen.findByText(/Not enough measured runs/)).toBeInTheDocument();
    expect(screen.queryByTestId('medal-history')).not.toBeInTheDocument();
  });

  it('says the sweep has not arrived rather than drawing an empty axis', async () => {
    await render(enrolled(), histories({ runs: [], events: [] }));
    expect(await screen.findByText(/sweep has not reached/)).toBeInTheDocument();
  });

  // A 404 is the normal state for an unswept aspect, not a failure.
  it('treats a missing history as absence, not as an error', async () => {
    await render(enrolled(), histories(undefined, 404));
    expect(await screen.findByText(/sweep has not reached/)).toBeInTheDocument();
    expect(screen.queryByText(/not a verdict about the component/)).not.toBeInTheDocument();
  });

  // Supplementary, so it says so in a line rather than stacking red panels —
  // and keeps the model's wording: a failed fetch is OUR gap.
  it('reports a failed fetch as our gap, in prose rather than a panel', async () => {
    await render(enrolled(), histories(undefined, 500));
    expect(
      await screen.findByText(/not a verdict about the component/),
    ).toBeInTheDocument();
  });

  it('renders nothing at all for a component with no aspects', async () => {
    await render(component({}), histories({ runs: [], events: [] }));
    expect(screen.queryByText('Medal history')).not.toBeInTheDocument();
  });
});
