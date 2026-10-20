// types
export type {
  IByteCache,
  IByteCacheOptions,
  IByteCacheRetention,
  IClickEvent,
  IMarkedRegion,
  IRegionMarkers,
  IRunInOrderOptions,
  IRunWhileCurrentOptions,
  ITakeWithinByteBudgetOptions,
  ICursorCodec,
  ICursorCodecOptions,
  ICloseTaskRunnerOptions,
  IDeadline,
  IDeadlineOptions,
  IDeadlineStopReason,
  IDelayOptions,
  IDownloadBlobOptions,
  IDownloadJsonOptions,
  IFilterByQueryOptions,
  IRequestCoordinator,
  IRequestCoordinatorOptions,
  IRetryAsyncFunctionOptions,
  IRunRequestOptions,
  IRunTaskOptions,
  IEventBus,
  IEventBusOptions,
  ISortDirection,
  ITaskRunner,
  ITaskRunnerOptions,
  IUtcDateRange,
  IWaitUntilOptions,
} from './types.js';

// async utilities
export { abortable, delay, retryAsyncFunction, waitUntil } from './async.js';

// ordered runs
export { runInOrder } from './run-in-order.js';

// work tied to the current state
export { runWhileCurrent } from './run-while-current.js';

// byte caches
export { createByteCache } from './byte-cache.js';

// marked regions
export { findMarkedRegion, upsertMarkedRegion } from './marked-region.js';

// collection utilities
export {
  applyDefaults,
  deepFreeze,
  isEqual,
  omitProps,
  pickProps,
  shuffleArray,
  splitArrayIntoBatches,
  takeWithinByteBudget,
} from './collections.js';

// environment checks
export {
  hasNavigator,
  hasWindow,
  isIndexedDbAvailable,
  isPrimaryClick,
  prefersReducedMotion,
} from './environment.js';

// deadlines
export { createDeadline } from './deadline.js';

// downloads
export { downloadBlob, downloadJson } from './download.js';

// events
export { createEventBus } from './event-bus.js';

// extractors
export {
  extractEmailUsername,
  extractTokenFromAuthorizationHeader,
  getInitials,
} from './extractors.js';

// filtering utilities
export { filterByQuery } from './filtering.js';

// navigation utilities
export { resolveSafeInternalPath } from './internal-path.js';

// generators
export {
  generateDateId,
  generateRandomFloat,
  generateRandomInteger,
  generateRandomString,
  generateSequence,
  generateUtcDateSequence,
  generateUuid,
  getTrailingUtcDateRange,
} from './generators.js';

// Markdown utilities
export {
  escapeMarkdownInline,
  extractFirstMarkdownHeadingName,
  extractSubstitutionPlaceholderNames,
} from './markdown.js';

// request coordination
export { createRequestCoordinator } from './request-coordinator.js';

// background tasks
export { createTaskRunner } from './task-runner.js';

// cursor codecs
export { createCursorCodec } from './cursor-codec.js';

// pagination utilities
export { getNextPageParam } from './pagination.js';

// reading utilities
export { estimateReadingTime } from './reading.js';

// YouTube utilities
export { parseYouTubeVideoId, toYouTubeEmbedUrl, toYouTubeWatchUrl } from './youtube.js';

// sorting utilities
export {
  sortPrimitives,
  sortRecords,
  sortRecordsWithBigIntString,
  sortRecordsWithDateValue,
} from './sorting.js';
