import { createFrontendPlugin, PageBlueprint } from '@backstage/frontend-plugin-api';
import ShieldIcon from '@material-ui/icons/Security';
import { rootRouteRef } from './routes';
import {
  guildOverviewLayout, practiceOverviewLayout,
  componentAspectsCard, componentAdoptCard,
} from './entity';

// NOTE: `NavItemBlueprint` was removed in @backstage/frontend-plugin-api@0.17.0
// (BREAKING). Nav items are now discovered from `PageBlueprint` extensions via
// their `title`/`icon` params, so the page below doubles as the sidebar entry.
const guildHallPage = PageBlueprint.make({
  params: {
    path: '/guild-hall',
    title: 'Guild Hall',
    icon: <ShieldIcon fontSize="inherit" />,
    routeRef: rootRouteRef,
    loader: () => import('./components/GuildHallPage').then(m => <m.GuildHallPage />),
  },
});

export const gildiPlugin = createFrontendPlugin({
  pluginId: 'gildi',
  extensions: [
    guildHallPage, guildOverviewLayout, practiceOverviewLayout,
    componentAspectsCard, componentAdoptCard,
  ],
  routes: { root: rootRouteRef },
});
