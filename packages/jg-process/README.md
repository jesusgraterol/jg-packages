# jg-process

Run and stop child processes in Node.js without a shell: timeouts, output limits, abort signals, and whole process trees.

## Install

```bash
npm install jg-process
```

## Usage

Run a command to completion and read its output. The run is bounded by a timeout and an output limit, and both stop the whole process tree:

```ts
import { runProcess } from 'jg-process';

const { exitCode, stdout, stderr, durationMs } = await runProcess({
  command: 'git',
  args: ['status', '--porcelain'],
  cwd: repositoryDirectory,
  timeoutSeconds: 30,
  signal: AbortSignal.timeout(60_000),
});
```

A non-zero exit code resolves, so callers decide what counts as failure. A timeout, too much output, or a failure to start rejects with `PROCESS_TIMED_OUT`, `PROCESS_OUTPUT_TOO_LARGE`, or `PROCESS_START_FAILED`.

Start a long-running process that you own, and stop it together with everything it started:

```ts
import { createShutdownSignal, startProcess, stopProcessTree } from 'jg-process';

const server = startProcess({ command: 'node', args: ['server.js'], cwd: 'apps/api' });
const shutdown = createShutdownSignal(); // Ctrl+C or SIGTERM, which sets the exit code to 130 or 143
shutdown.signal.addEventListener('abort', () => void stopProcessTree(server), { once: true });
```

`createShutdownSignal` turns SIGINT and SIGTERM, or the `signals` you pass, into an `AbortSignal` that aborts with `PROCESS_INTERRUPTED` at the first one, so one signal stops a script's or a service's work. It sets `process.exitCode` to 128 plus the signal's number, as a shell reports a process the signal stopped, unless `setExitCode` is `false`, and calls `onSignal` once, ignoring what it throws. It never calls `process.exit`, so the process exits once its work stops. A second signal is ignored, or, with `forceOnRepeat`, stops the process at once, for a shutdown that hangs. `dispose` stops listening. On Windows, Ctrl+C sends SIGINT, but SIGTERM is never delivered.

Start a server and wait until it answers, or stop everything it started when it doesn't:

```ts
import { startProcessAndWait } from 'jg-process';

const api = await startProcessAndWait(
  { command: process.execPath, args: ['server.js'], cwd: 'apps/api' },
  { readyWhen: { url: 'http://127.0.0.1:3000/health' }, timeoutSeconds: 60 },
);
```

Run a package manager without a shell on every platform, including Windows, where its `.cmd` shim can't be spawned directly:

```ts
import { resolvePackageManagerCommand, runProcess } from 'jg-process';

await runProcess({ ...resolvePackageManagerCommand(['run', 'build']), timeoutSeconds: 600 });
```

Reserve a free port before handing it to a server, keeping the preferred one when it's free:

```ts
import { reservePort } from 'jg-process';

const reservation = await reservePort({ preferredPort: 3000 }); // 3000, or another free port
await reservation.release(); // right before the server binds it
```

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-process/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-process/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-process/LICENSE)
