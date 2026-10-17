// the path the runtime registers the worker from, and the Vite plugin serves it at in development
export const DEFAULT_SERVICE_WORKER_PATH = '/sw.js';

// the scope the runtime registers the worker with
export const DEFAULT_SERVICE_WORKER_SCOPE = '/';

// the name of the file the generator writes into the config's outDir
export const SERVICE_WORKER_FILE_NAME = 'sw.js';

// the type of the message the runtime posts to make a waiting worker activate
export const SKIP_WAITING_MESSAGE_TYPE = 'JG_SW_SKIP_WAITING';
