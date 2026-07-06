import { createBackendModule } from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node';
import { CycleProcessor } from './CycleProcessor';

export const catalogModuleCycle = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'cycle',
  register(reg) {
    reg.registerInit({
      deps: { catalog: catalogProcessingExtensionPoint },
      async init({ catalog }) {
        catalog.addProcessor(new CycleProcessor());
      },
    });
  },
});

export default catalogModuleCycle;
