// the address waitForPort connects to unless another is given
export const DEFAULT_READINESS_HOST = '127.0.0.1';

// the seconds between readiness probes unless the caller sets them
export const DEFAULT_READINESS_INTERVAL_SECONDS = 0.25;

// the seconds one connection attempt or one request can take unless the caller sets them
export const DEFAULT_CONNECT_TIMEOUT_SECONDS = 1;
export const DEFAULT_REQUEST_TIMEOUT_SECONDS = 2;

// the highest TCP port
export const MAX_READINESS_PORT = 65_535;
