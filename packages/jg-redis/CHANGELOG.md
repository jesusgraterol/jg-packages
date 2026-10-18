# Changelog

## 0.1.1

### Changed

- Published from CI with provenance, which 0.1.0, published by hand as the package's first version, lacks. The code is the same.

## 0.1.0

### Added

- `connectRedis`, a node-redis client that sends its errors to `onError`, rejects commands while disconnected instead of queueing them, and closes without flushing anything.
- `createCache`, a read-through cache: one load for concurrent misses, a cached `null`, schema-checked entries, a 1 MiB cap, a TTL set with every write, and Redis failures that fall back to the loader. `invalidate` keeps a load in flight from storing its older value.
- `jg-redis/coordination`: `claimOnce`, for one-time claims such as replay protection, and `storeSingleUseValue` and `takeSingleUseValue`, for values one request takes. They fail closed with `COORDINATION_FAILED`.
