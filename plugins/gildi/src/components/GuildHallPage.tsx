import { Content, Header, Page } from '@backstage/core-components';

export function GuildHallPage() {
  return (
    <Page themeId="home">
      <Header title="Guild Hall" subtitle="The practice layer — guilds, their practices and aspects, drives, and sagas" />
      <Content>
        <p>The Guild Hall is taking shape. Guilds, drives, chronicle, and actions arrive next.</p>
      </Content>
    </Page>
  );
}
