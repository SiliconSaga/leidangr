import { createBackendModule } from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node';
import { SagaProcessor } from './SagaProcessor';

export const catalogModuleSaga = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'saga',
  register(reg) {
    reg.registerInit({
      deps: { catalog: catalogProcessingExtensionPoint },
      async init({ catalog }) {
        catalog.addProcessor(new SagaProcessor());
      },
    });
  },
});

export default catalogModuleSaga;
