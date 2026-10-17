// error codes
export { ERRORS } from './shared/index.js';

// types
export type { IBuildServiceWorkerOptions } from './shared/index.js';

// config
export {
  ServiceWorkerConfigSchema,
  readServiceWorkerConfig,
  type IServiceWorkerConfig,
} from './config/index.js';

// generation
export { buildServiceWorker, writeServiceWorker } from './service-worker/index.js';

// Vite plugin
export { serviceWorkerPlugin } from './plugin/index.js';
