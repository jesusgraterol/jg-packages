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
import { startProcess, stopProcessTree } from 'jg-process';

const server = startProcess({ command: 'node', args: ['server.js'], cwd: 'apps/api' });
process.once('SIGINT', () => void stopProcessTree(server));
```

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-process/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-process/LICENSE)
