import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/frontend-test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { ActionsPanel } from './ActionsPanel';

const catalogApi = {
  getEntities: async ({ filter }: any) => {
    if (filter.kind === 'Template') {
      return {
        items: [
          {
            apiVersion: 'scaffolder.backstage.io/v1beta3',
            kind: 'Template',
            metadata: {
              name: 'charter-a-practice',
              title: 'Charter a practice',
              description: 'Stand up a new practice and its guild — the Guild Hall dogfooding its own model.',
              tags: ['guild-hall'],
            },
            spec: { type: 'guildhall-action', owner: 'group:default/team-devex' },
          },
          {
            apiVersion: 'scaffolder.backstage.io/v1beta3',
            kind: 'Template',
            metadata: {
              name: 'establish-a-guild',
              namespace: 'custom',
              title: 'Establish a guild',
              tags: ['guild-hall'],
            },
            spec: { type: 'guildhall-action', owner: 'group:default/team-devex' },
          },
        ],
      };
    }
    return { items: [] };
  },
};

describe('ActionsPanel', () => {
  it('renders a curated action as a button linking to its Create page', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[catalogApiRef, catalogApi]]}>
        <ActionsPanel />
      </TestApiProvider>,
    );

    const link = (await screen.findByText('Charter a practice')).closest('a');
    expect(link).toHaveAttribute('href', '/create/templates/default/charter-a-practice');

    // a non-default namespace is preserved in the Create link
    const nsLink = (await screen.findByText('Establish a guild')).closest('a');
    expect(nsLink).toHaveAttribute('href', '/create/templates/custom/establish-a-guild');
  });
});
