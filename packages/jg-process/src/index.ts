// types
export type {
  IProcessOutput,
  IProcessOutputEncoding,
  IProcessResult,
  IRunProcessOptions,
  IStartProcessCommand,
  IStartProcessOptions,
} from './shared/index.js';

// constants
export { DEFAULT_GRACE_PERIOD_SECONDS, DEFAULT_MAX_OUTPUT_BYTES } from './shared/index.js';

// error codes
export { ERRORS } from './shared/index.js';

// process runs
export { runProcess } from './run-process/index.js';

// process trees
export { isProcessRunning, startProcess, stopProcessTree } from './process-tree/index.js';

// port reservations
export {
  type IPortReservation,
  type IReservePortOptions,
  reservePort,
} from './reserve-port/index.js';

// package manager commands
export {
  type IPackageManager,
  type IPackageManagerCommand,
  type IResolvePackageManagerOptions,
  resolvePackageManagerCommand,
} from './package-manager/index.js';

// readiness waits
export {
  type IReadinessWaitOptions,
  type IReadyWhen,
  type IStartProcessAndWaitOptions,
  type IWaitForPortOptions,
  type IWaitForUrlOptions,
  startProcessAndWait,
  waitForPort,
  waitForUrl,
} from './readiness/index.js';

// shutdown signals
export {
  DEFAULT_SHUTDOWN_SIGNALS,
  type IShutdownSignal,
  type IShutdownSignalOptions,
  createShutdownSignal,
} from './shutdown-signal/index.js';

// command-line scripts
export {
  type IReadStdinOptions,
  type IStrictArgOption,
  type IStrictArgValues,
  isMainModule,
  parseStrictArgs,
  readStdin,
} from './command-line/index.js';
