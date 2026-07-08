import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import { navModule } from './modules/nav';
import { cycleModule } from './modules/cycle';

export default createApp({
  features: [catalogPlugin, navModule, cycleModule],
});
