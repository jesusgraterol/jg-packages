// the bytes stdout and stderr can hold together when runProcess gets no maxOutputBytes (1 MiB)
export const DEFAULT_MAX_OUTPUT_BYTES = 1048576;

// the seconds stopProcessTree waits after SIGTERM before it sends SIGKILL
export const DEFAULT_GRACE_PERIOD_SECONDS = 5;

// the most seconds runProcess waits, the longest delay a Node.js timer keeps (2,147,483,647 ms)
export const MAX_TIMEOUT_SECONDS = 2_147_483;
