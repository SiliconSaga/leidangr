import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { GuildCharterCard } from './GuildCharterCard';

const guildEntity = (metadata: Record<string, unknown>) =>
  ({
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Group',
    metadata: { name: 'security-gildi', title: 'Security guild', ...metadata },
    spec: { type: 'guild' },
  } as any);

const renderCard = (entity: any) =>
  renderInTestApp(
    <EntityProvider entity={entity}>
      <GuildCharterCard />
    </EntityProvider>,
  );

describe('GuildCharterCard', () => {
  it('renders the charter annotation over the description, plus a steward chip', async () => {
    await renderCard(
      guildEntity({
        description: 'Fallback description.',
        annotations: {
          'siliconsaga.org/stewards': 'aspect:security',
          'siliconsaga.org/charter': 'The chartered mission.',
        },
      }),
    );
    expect(await screen.findByText('The chartered mission.')).toBeInTheDocument();
    expect(screen.queryByText('Fallback description.')).not.toBeInTheDocument();
    expect(screen.getByText('security aspect')).toBeInTheDocument();
  });

  it('falls back to the description when no charter annotation is set', async () => {
    await renderCard(
      guildEntity({
        description: 'Keeps things safe.',
        annotations: { 'siliconsaga.org/stewards': 'aspect:security' },
      }),
    );
    expect(await screen.findByText('Keeps things safe.')).toBeInTheDocument();
  });

  it('falls back past a blank charter annotation to the description', async () => {
    await renderCard(
      guildEntity({
        description: 'Keeps things safe.',
        annotations: { 'siliconsaga.org/charter': '   ' },
      }),
    );
    expect(await screen.findByText('Keeps things safe.')).toBeInTheDocument();
  });

  it('shows a placeholder when neither charter nor description is set', async () => {
    await renderCard(guildEntity({ annotations: {} }));
    expect(await screen.findByText('No charter recorded yet.')).toBeInTheDocument();
  });
});
