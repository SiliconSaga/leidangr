import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/frontend-test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { GuildsSection } from './GuildsSection';

const catalogApi = {
  getEntities: async ({ filter }: any) => {
    if (filter['spec.type'] === 'guild') {
      return { items: [{ apiVersion: 'backstage.io/v1alpha1', kind: 'Group', metadata: { name: 'security-gildi', title: 'Security guild', description: 'Keeps things safe.', annotations: { 'siliconsaga.org/stewards': 'aspect:security' } }, spec: { type: 'guild' } }] };
    }
    return { items: [{ apiVersion: 'backstage.io/v1alpha1', kind: 'Component', metadata: { name: 'security-practice', title: 'Security practice', annotations: { 'siliconsaga.org/aspect': 'security' } }, spec: { type: 'practice', owner: 'group:default/security-gildi' } }] };
  },
};

describe('GuildsSection', () => {
  it('renders a curated guild card with name, description, practice and aspect', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[catalogApiRef, catalogApi]]}>
        <GuildsSection />
      </TestApiProvider>,
    );
    expect(await screen.findByText('Security guild')).toBeInTheDocument();
    expect(screen.getByText('Keeps things safe.')).toBeInTheDocument();
    expect(screen.getByText('Security practice')).toBeInTheDocument();
    expect(screen.getByText('security aspect')).toBeInTheDocument();
  });
});
