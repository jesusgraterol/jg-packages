// the only host address startContainer publishes ports on
export const LOOPBACK_ADDRESS = '127.0.0.1';

// a container name Docker accepts
export const CONTAINER_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/;

// a full container ID, as `docker create` writes it
export const CONTAINER_ID_PATTERN = /^[0-9a-f]{64}$/;

// the seconds removeContainer gives a container to stop before Docker kills it
export const STOP_TIMEOUT_SECONDS = 10;

// the most bytes of output the owner process's docker commands may write
export const OWNER_MAX_OUTPUT_BYTES = 65_536;
