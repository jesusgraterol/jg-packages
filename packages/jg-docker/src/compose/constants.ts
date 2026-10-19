// the host addresses that only this machine can reach
export const LOOPBACK_ADDRESSES: ReadonlySet<string> = new Set(['127.0.0.1', '::1']);

// a Compose project's name: lowercase letters, digits, dashes, and underscores
export const PROJECT_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

// a Compose service's or profile's name
export const SERVICE_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
