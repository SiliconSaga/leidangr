import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import { GuildHallPage } from './components/GuildHallPage';

describe('GuildHallPage', () => {
  it('renders the Guild Hall header', async () => {
    await renderInTestApp(<GuildHallPage />);
    expect(await screen.findByText('Guild Hall')).toBeInTheDocument();
  });
});
