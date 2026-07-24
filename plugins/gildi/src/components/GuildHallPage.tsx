import { Grid } from '@material-ui/core';
import { Content, Header, Page } from '@backstage/core-components';
import { DrivesBand } from '../drives/DrivesBand';
import { GuildsSection } from '../guilds/GuildsSection';
import { ActionsPanel } from '../actions/ActionsPanel';
import { ChronicleRail } from '../chronicle/ChronicleRail';

export function GuildHallPage() {
  return (
    <Page themeId="home">
      <Header title="Guild Hall" subtitle="The practice layer — guilds, their practices and aspects, drives, and sagas" />
      <Content>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <DrivesBand />
            <h2>Guilds</h2>
            <GuildsSection />
          </Grid>
          <Grid item xs={12} md={4}>
            <ActionsPanel />
            <ChronicleRail />
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
}
