# Changelog

## 1.0.0

### Added

- `acquireLock(name, { waitSeconds?, signal?, onWait?, metadata?, recoverFrom?, root? })`, which takes a machine-wide named lock, waiting while a live process holds it, through 16 seconds while a new owner writes its record, and until `signal` aborts with `waitSeconds: Infinity`. It fails at once with jg-fs's `LOCK_BUSY` for a dead, foreign-host, or malformed owner, never takes a lock over by itself, and takes one over only from the exact dead owner `recoverFrom` names.
- `withLock(name, options, fn)`, which runs a function while holding a lock and releases it afterwards.
- `inspectLock(name, { root? })` and `listLocks({ root? })`, which read a lock's state and holder without taking it, and list at most 256 present locks with `isTruncated`.
- `getLocksRoot()`, the folder every lock lives in: `JG_LOCKS_ROOT`, or `jg-locks` in the operating system's state folder, created with mode `0700`.
- The `jg-locks` CLI: `run <name> [--wait <seconds> | --wait forever] -- <command>`, which exits 75 when the lock is busy, `status [--json]`, and `recover <name> --nonce <nonce>`.
- `ERRORS`, with `LOCK_NAME_INVALID`, `LOCK_ROOT_INVALID`, and `LOCK_OPTIONS_INVALID`.
