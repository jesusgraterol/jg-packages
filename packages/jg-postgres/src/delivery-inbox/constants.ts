// the most characters a delivery's key may hold, its column's length
export const MAX_DELIVERY_KEY_LENGTH = 512;

// the most keys listDue returns at once
export const MAX_DUE_LIMIT = 8_192;

// the most seconds a lease, retry, or expiry may last, make_interval's integer maximum
export const MAX_DELIVERY_SECONDS = 2_147_483_647;

// a lowercase hex SHA-256 digest
export const DIGEST_PATTERN = /^[0-9a-f]{64}$/;

// a lease's id, a UUID
export const LEASE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
