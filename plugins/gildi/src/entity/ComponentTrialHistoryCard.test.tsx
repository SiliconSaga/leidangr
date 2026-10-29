import { screen, waitFor } from '@testing-library/react';
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

  // ⚠ WAITS FOR THE CHARTS, not for the sections. Each section's wrapper div
  // renders as soon as the ASPECTS load, before its own history fetch resolves —
  // so asserting on the wrappers passed while both charts were still pending,
  // left their state updates landing after the test had finished (the act
  // warning that was the symptom), and would have gone on passing for a card
  // whose charts never drew at all.
  it('renders one section per adopted aspect', async () => {
    await render(
      enrolled('security, operational-readiness'),
      histories({ runs: [at(2), at(1)], events: [] }),
    );
    expect(await screen.findAllByTestId('medal-history')).toHaveLength(2);
    expect(screen.getByTestId('history-security')).toBeInTheDocument();
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

  // ⚠ WITHOUT THE WAIT THIS TEST PROVED NOTHING. The aspects resolve through
  // useAsync, so straight after `await render(...)` the card is still showing
  // Progress — measured, not assumed: the DOM at that point holds
  // `data-testid="progress"` and nothing else. "Medal history" was absent
  // because the card had not decided yet, so the test passed whatever it went
  // on to draw a tick later.
  //
  // The spinner is the anchor at both ends: present means the card is mounted,
  // gone means the aspects resolved. Only then does an absent title mean the
  // card chose to render nothing.
  it('renders nothing at all for a component with no aspects', async () => {
    await render(component({}), histories({ runs: [], events: [] }));
    expect(screen.getByTestId('progress')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByTestId('progress')).not.toBeInTheDocument(),
    );
    expect(screen.queryByText('Medal history')).not.toBeInTheDocument();
  });
});
