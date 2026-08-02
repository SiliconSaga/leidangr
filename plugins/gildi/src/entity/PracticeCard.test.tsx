import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import { entityRouteRef, EntityProvider } from '@backstage/plugin-catalog-react';
import { PracticeCard } from './PracticeCard';

const practice = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'security-practice',
    title: 'Security practice',
    description: 'Keeps software safe.',
    annotations: { 'siliconsaga.org/aspect': 'security' },
  },
  spec: { type: 'practice', owner: 'group:default/security-gildi' },
} as any;

describe('PracticeCard', () => {
  it('renders description, the maintained aspect, and the running guild crest', async () => {
    await renderInTestApp(
      <EntityProvider entity={practice}>
        <PracticeCard />
      </EntityProvider>,
      { mountedRoutes: { '/catalog/:namespace/:kind/:name': entityRouteRef } },
    );
    expect(await screen.findByText('Keeps software safe.')).toBeInTheDocument();
    expect(screen.getByText('security aspect')).toBeInTheDocument();
    // the run-by line reuses the guild's crest, keyed by the owner group name
    expect(screen.getByRole('img', { name: 'Arms of security-gildi' })).toBeInTheDocument();
  });
});
