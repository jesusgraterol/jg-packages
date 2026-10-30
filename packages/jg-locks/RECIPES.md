# jg-locks recipes

Patterns for scripts, test setups, and dev servers that share one machine's resources with other programs, agents, and checkouts.

## Keeping a lock after a teardown you couldn't confirm

Use this when a lock guards something a crash can leave behind, such as a browser or a test database. When stopping it fails, the resource may still be running, so the lock stays held: the next process to want it sees `owner-gone` once this one exits, and an operator recovers it after checking, instead of a second run starting over a live resource.

```ts
import { acquireLock } from 'jg-locks';

// stops the browser this run started, and resolves to whether it confirmed it's gone
declare const stopBrowser: () => Promise<boolean>;
declare const runBrowserTests: () => Promise<void>;

export const runWithBrowser = async (signal: AbortSignal): Promise<void> => {
  const lock = await acquireLock('acme.app.browser', { waitSeconds: Infinity, signal });
  let isStopped = false;
  try {
    await runBrowserTests();
  } finally {
    isStopped = await stopBrowser();
    if (isStopped) {
      await lock.release();
    } else {
      console.error(
        'The browser may still be running, so acme.app.browser stays locked. Check it, then run jg-locks status and jg-locks recover.',
      );
    }
  }
};
```

## Handing a held lock to other code

Use this when one function takes a lock and another, such as a test runner's teardown, releases it. Pass the `ILock` itself, so the code that releases it releases exactly the acquisition it was given.

```ts
import { acquireLock, type ILock } from 'jg-locks';

declare const startDatabase: () => Promise<void>;
declare const stopDatabase: () => Promise<void>;

export const setup = async (): Promise<() => Promise<void>> => {
  const lock: ILock = await acquireLock('acme.app.test-database', {
    waitSeconds: 300,
    metadata: { purpose: 'integration tests' },
  });
  try {
    await startDatabase();
  } catch (error) {
    await lock.release();
    throw error;
  }
  return async () => {
    await stopDatabase();
    await lock.release();
  };
};
```

## A temporary locks folder per test

Use this in tests that take real locks, so they never block, or are blocked by, the developer's own scripts. Point `JG_LOCKS_ROOT` at a private temporary folder, or pass `root` to each call.

```ts
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getLocksRoot, withLock } from 'jg-locks';

export const withTemporaryLocks = async (test: () => Promise<void>): Promise<void> => {
  const folder = await mkdtemp(join(tmpdir(), 'locks-'));
  const previous = process.env['JG_LOCKS_ROOT'];
  process.env['JG_LOCKS_ROOT'] = join(folder, 'locks');
  try {
    getLocksRoot(); // now the temporary folder
    await withLock('acme.app.port-3000', {}, test);
  } finally {
    if (previous === undefined) {
      delete process.env['JG_LOCKS_ROOT'];
    } else {
      process.env['JG_LOCKS_ROOT'] = previous;
    }
    await rm(folder, { recursive: true, force: true });
  }
};
```

`mkdtemp` creates the folder with mode `0700`, and the locks folder inside it is created private too. A test that starts another process to hold a lock passes the same `JG_LOCKS_ROOT` in its environment.

## Running a dev server behind its port's lock

Use this when several checkouts or agents start the same dev server, so a second one fails at once with the holder's name instead of a port clash halfway through its startup. In `package.json`:

```json
{ "scripts": { "dev": "jg-locks run port-5173 -- vite --port 5173 --strictPort" } }
```

`jg-locks run` exits 75 while another process holds `port-5173`, and prints which program, folder, and pid holds it. A script that needs the server can say who has it before it gives up:

```ts
import { inspectLock } from 'jg-locks';

const { state, owner } = await inspectLock('port-5173');
if (state === 'held' && owner !== null) {
  console.error(`Port 5173 belongs to ${owner.program} (pid ${owner.pid}) in ${owner.cwd}.`);
}
```
