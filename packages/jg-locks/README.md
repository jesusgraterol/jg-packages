# jg-locks

Machine-wide named locks for Node.js scripts, agents, and apps: waits, a status of every holder, explicit recovery, and a CLI.

## Install

```bash
npm install jg-locks
```

## Usage

Hold a lock while a job runs, such as one that uses a port or a browser profile only one process can use at a time:

```ts
import { withLock } from 'jg-locks';

await withLock('acme.app.browser-profile', { waitSeconds: 60 }, async () => {
  // only one process on this machine runs this at a time
});
```

Every program on the machine shares one locks folder, so a lock taken by a script in one repository also keeps an agent in another checkout, or an app, from taking it. Name a project's locks `<owner>.<repository>.<resource>`, such as `acme.app.browser-profile`, and a machine resource plainly, such as `port-3101`. A name is 1 to 128 lowercase letters, digits, `.`, `_`, and `-`, starting with a letter or a digit.

`acquireLock` takes a lock and returns it, for code that releases it somewhere else, or keeps it after a teardown it couldn't confirm:

```ts
import { acquireLock } from 'jg-locks';

const lock = await acquireLock('port-3101', {
  waitSeconds: Infinity,
  signal: AbortSignal.timeout(300_000),
  onWait: ({ owner }) => console.log(`Waiting for ${owner?.program} (pid ${owner?.pid})`),
  metadata: { runId: 'run-42' },
});
// ... start the server on port 3101
await lock.release();
```

Without `waitSeconds`, it fails at once with jg-fs's `LOCK_BUSY` while another process holds the lock. With it, it checks again every 250 ms, and calls `onWait` once for each new holder; `Infinity` waits until `signal` aborts, which rejects with the signal's reason. A lock whose owner is still writing its record is waited on for up to 16 seconds. It fails at once, whatever the wait, when the holder's process is gone, runs on another host, or left unexpected files, because waiting can't change them: `LOCK_BUSY`'s `data.reason` is `owner-gone`, `other-host`, `ownerless`, `recovery-in-progress`, or `unexpected-entries`.

A lock is a [jg-fs](https://jg-packages.jesusgraterol.dev/packages/jg-fs/) lock folder with an `owner.json` that names the holder: its pid, host, nonce, program, folder, and start time, and the `metadata` you pass. The program is the entry script or executable without its arguments, which can hold secrets. A lock isn't re-entrant: a process that waits for a lock it already holds waits for itself.

See who holds what, without taking anything:

```ts
import { inspectLock, listLocks } from 'jg-locks';

const { state, owner, isOwnerAlive } = await inspectLock('port-3101'); // state: 'free', 'held', ...
const { locks, isTruncated } = await listLocks(); // every present lock, sorted by name, at most 256
```

A lock whose holder died stays busy, because only you know whether the holder left work half done. Check what it left, then take the lock over from exactly that holder with `recoverFrom`, which never takes it from another one:

```ts
import { acquireLock, inspectLock } from 'jg-locks';

const { state, owner } = await inspectLock('acme.app.fixture');
if (state === 'owner-gone' && owner !== null) {
  // check what the dead holder left, then:
  const lock = await acquireLock('acme.app.fixture', { recoverFrom: owner });
  await lock.release();
}
```

### The locks folder

`getLocksRoot()` gives the folder: `JG_LOCKS_ROOT` when it's set, which must be an absolute path, otherwise `$XDG_STATE_HOME/jg-locks`, or `~/.local/state/jg-locks`, on Linux and macOS, and `%LOCALAPPDATA%\jg-locks` on Windows. It's created with mode `0700` the first time a lock is taken, and an existing folder other users can open is refused with jg-fs's `DIRECTORY_NOT_PRIVATE`. Every function also takes a `root`, such as a temporary folder in tests. Use it on local filesystems only.

### The CLI

```bash
jg-locks run port-5173 -- pnpm dev            # exits 75 at once when the lock is busy
jg-locks run acme.app.e2e --wait 600 -- pnpm test:e2e
jg-locks status                               # every lock, its holder, and its nonce
jg-locks status --json                        # one line with schemaVersion 1
jg-locks recover acme.app.fixture --nonce <nonce>
```

`run` holds the lock while the command runs, without a shell, forwards SIGINT and SIGTERM to it, releases the lock once it exits, and exits with its code, or 128 plus the signal's number when a signal ended it. `--wait <seconds>` or `--wait forever` waits for the lock first. A command that isn't found exits 127. On Windows, run a `.cmd` script through `cmd /c`. `recover` takes the lock over from the dead holder with that nonce, as `status` shows it, and releases it, or exits 1 when the lock isn't that dead holder's. Usage errors exit 2.

### Errors

| Code                   | When                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `LOCK_NAME_INVALID`    | A lock name doesn't follow the naming rule                                                      |
| `LOCK_ROOT_INVALID`    | `root`, `JG_LOCKS_ROOT`, `%LOCALAPPDATA%` on Windows, or the home folder isn't an absolute path |
| `LOCK_OPTIONS_INVALID` | `waitSeconds` is negative or not a number                                                       |

jg-fs's lock errors pass through unchanged: `LOCK_BUSY`, `LOCK_ACQUISITION_FAILED`, `LOCK_NOT_OWNED`, `LOCK_RELEASE_FAILED`, `NOT_A_DIRECTORY`, `DIRECTORY_NOT_PRIVATE`, and `PATH_NOT_CANONICAL`.

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-locks/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-locks/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-locks/LICENSE)
