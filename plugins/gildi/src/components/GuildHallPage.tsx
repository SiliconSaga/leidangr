import { Content, Header, Page } from '@backstage/core-components';
import { GuildsSection } from '../guilds/GuildsSection';

export function GuildHallPage() {
  return (
    <Page themeId="home">
      <Header title="Guild Hall" subtitle="The practice layer — guilds, their practices and aspects, drives, and sagas" />
      <Content>
        <h2 style={{ marginTop: 0 }}>Guilds</h2>
        <GuildsSection />
      </Content>
    </Page>
  );
}
