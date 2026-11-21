// errors
export { ERRORS } from './errors.js';

// archive inspection
export { type INpmTarballLimits, inspectNpmTarball } from './archive/index.js';

// packed consumers
export {
  type IPackedConsumer,
  type IPackedConsumerManager,
  type IPackedConsumerOptions,
  withPackedConsumer,
} from './consumer/index.js';

// export checks
export { type IPackedExportCheck, checkPackedExports } from './exports/index.js';
