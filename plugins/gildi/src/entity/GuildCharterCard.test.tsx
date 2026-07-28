import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { GuildCharterCard } from './GuildCharterCard';

const guild = {
  apiVersion: 'backstage.io/v1alpha1', kind: 'Group',
  metadata: {
    name: 'security-gildi', title: 'Security guild',
    description: 'Keeps things safe.',
    annotations: { 'siliconsaga.org/stewards': 'aspect:security' },
  },
  spec: { type: 'guild' },
} as any;

describe('GuildCharterCard', () => {
  it('renders charter prose and a steward aspect chip', async () => {
    await renderInTestApp(
      <EntityProvider entity={guild}>
        <GuildCharterCard />
      </EntityProvider>,
    );
    expect(await screen.findByText('Keeps things safe.')).toBeInTheDocument();
    expect(screen.getByText('security aspect')).toBeInTheDocument();
  });
});
