import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import gildiPlugin from '@siliconsaga/plugin-gildi';
import { navModule } from './modules/nav';
import { cycleModule } from './modules/cycle';

export default createApp({
  features: [catalogPlugin, gildiPlugin, navModule, cycleModule],
});
