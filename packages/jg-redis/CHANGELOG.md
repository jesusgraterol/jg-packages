# Changelog

## 0.4.0

### Added

- The `CONNECTION_FAILED` and `INVALID_CONNECT_TIMEOUT` error codes.

### Changed

- A failed first connection rejects with `CONNECTION_FAILED` instead of node-redis's own error, including when a custom `reconnectStrategy` gives up. Its cause is the error node-redis rejected with, or, at the deadline, the latest attempt's error.
- `connectRedis` refuses a `socket.connectTimeout` that isn't a whole number of milliseconds from 1 to 2,147,483,647 with `INVALID_CONNECT_TIMEOUT`, before it creates the client.

### Fixed

- The first connection gives up once `socket.connectTimeout` passes, as documented: node-redis only bounded each attempt, and its default reconnect strategy retried failed attempts forever, so an unreachable server kept `connectRedis` pending. After it gives up, no attempt outlives it, including one still connecting at the deadline, which `destroy()` alone would miss.

## 0.3.0

### Changed

- Supports Node.js 22.17.0 and later, down from 24.

## 0.2.0

### Added

- `createBlocklist(redis, { key })`, a list of blocked values, such as IP addresses, in one Redis SET: `has(value)`, `add(values)` and `remove(values)`, 1,000 values per command, and `replaceAll(values)`, which fills a staging SET and renames it over the list, so readers never see it half replaced, and deletes the list for no values. Every command failure throws `BLOCKLIST_FAILED`, with the cause, so callers can fail closed; a value that isn't 1 to 512 characters throws `BLOCKLIST_VALUE_INVALID`, and an empty key throws `INVALID_BLOCKLIST_KEY`.
- `IBlocklist` and `IBlocklistOptions`.
- A README section on the blocklist, which a flush or an eviction empties, and a recipe for an IP blocklist backed by a database table.

## 0.1.1

### Changed

- Published from CI with provenance, which 0.1.0, published by hand as the package's first version, lacks. The code is the same.

## 0.1.0

### Added

- `connectRedis`, a node-redis client that sends its errors to `onError`, rejects commands while disconnected instead of queueing them, and closes without flushing anything.
- `createCache`, a read-through cache: one load for concurrent misses, a cached `null`, schema-checked entries, a 1 MiB cap, a TTL set with every write, and Redis failures that fall back to the loader. `invalidate` keeps a load in flight from storing its older value.
- `jg-redis/coordination`: `claimOnce`, for one-time claims such as replay protection, and `storeSingleUseValue` and `takeSingleUseValue`, for values one request takes. They fail closed with `COORDINATION_FAILED`.
