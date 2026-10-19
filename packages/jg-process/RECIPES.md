# jg-process recipes

Patterns for Node.js scripts that run CLIs within a time and output budget, start servers and wait until they answer, and run package scripts on any platform.

## Running a CLI with a timeout and an output cap

Use this when the app runs a command-line tool on input it doesn't control, such as extracting the text of an uploaded PDF with `pdftotext` for a search index. A crafted file can keep the tool busy for minutes, or make it print without end, so the run gets a deadline and a byte budget, and either one stops the tool together with everything it started:

```ts
import { hasErrorCode } from 'jg-exception';
import { ERRORS, runProcess } from 'jg-process';

// a document's text for the search index, or why the app skipped it
type IExtractedText = { text: string } | { skipped: 'unreadable' | 'too-slow' | 'too-large' };

// the path is one the app built, such as an absolute one, so it can't start with '-' and read
// as an option
export const extractText = async (path: string): Promise<IExtractedText> => {
  try {
    const { exitCode, stdout } = await runProcess({
      command: 'pdftotext',
      // -q keeps warnings out of stderr, which counts toward the same budget as stdout
      args: ['-q', '-layout', path, '-'],
      timeoutSeconds: 30,
      // the index keeps at most 2 MiB of text per document
      maxOutputBytes: 2 * 1024 * 1024,
    });

    // a failed exit resolves too, and the code says pdftotext couldn't read the file
    return exitCode === 0 ? { text: stdout } : { skipped: 'unreadable' };
  } catch (error) {
    if (hasErrorCode(error, ERRORS.PROCESS_TIMED_OUT)) {
      return { skipped: 'too-slow' };
    }
    if (hasErrorCode(error, ERRORS.PROCESS_OUTPUT_TOO_LARGE)) {
      return { skipped: 'too-large' };
    }

    // PROCESS_START_FAILED means pdftotext isn't installed, which no document fixes
    throw error;
  }
};
```

`runProcess` resolves with whatever exit code the tool returned, so you decide which codes count as failure, and the tool's output never lands in an error message. It rejects only when the tool can't start (`PROCESS_START_FAILED`), runs past `timeoutSeconds` (`PROCESS_TIMED_OUT`), writes more than `maxOutputBytes` to stdout and stderr together (`PROCESS_OUTPUT_TOO_LARGE`), or leaves a process behind that survives the forced stop (`PROCESS_TREE_SURVIVED`). Without `maxOutputBytes`, the budget is `DEFAULT_MAX_OUTPUT_BYTES`, 1 MiB. The tool runs without a shell, so a file name can't inject a command.

When your own program is a CLI, a terminal's Ctrl+C reaches only your process, because the tool runs as the leader of its own process group. Pass an abort signal, and abort it on `SIGINT`:

```ts
import { runProcess } from 'jg-process';

// the PDF your CLI was given, as an absolute path
declare const path: string;

const controller = new AbortController();

// a second Ctrl+C ends the CLI at once, because the listener runs only for the first
process.once('SIGINT', () => controller.abort());

try {
  const { exitCode, stdout } = await runProcess({
    command: 'pdftotext',
    args: ['-q', '-layout', path, '-'],
    timeoutSeconds: 30,
    signal: controller.signal,
  });
  process.stdout.write(stdout);
  process.exitCode = exitCode ?? 1;
} catch (error) {
  if (!controller.signal.aborted) {
    throw error;
  }

  // 128 plus SIGINT's number, which tells a calling shell or script the run was interrupted
  process.exitCode = 130;
}
```

The abort stops the tool's process tree before the call rejects with the signal's reason, so nothing the tool started keeps running after the CLI exits.

## Stopping a dev server and everything it started

A dev server is rarely one process. `node --watch` runs your server in a second process, which it restarts on each change, and `npm run dev` starts a shell that starts the dev server, which can start processes of its own. Stopping only the process you started leaves the rest running, still holding the port. `startProcess` makes the child the leader of its own process group on POSIX, so `stopProcessTree` stops the whole group: SIGTERM first, then SIGKILL after the grace period, `DEFAULT_GRACE_PERIOD_SECONDS` unless you pass one.

Use this for a dev script that runs a server until you press Ctrl+C:

```ts
import { startProcess, stopProcessTree } from 'jg-process';

// process.execPath is the Node.js running this script, which works on every platform
const server = startProcess(process.execPath, ['--watch', 'server.js'], { cwd: 'apps/api' });

// the server leads its own process group, so Ctrl+C reaches only this script, which stops the
// group, then exits with 128 plus the signal's number, as a shell reports it
const stop = async (exitCode: number): Promise<void> => {
  try {
    await stopProcessTree(server);
  } catch (error) {
    // PROCESS_TREE_SURVIVED: part of the tree outlived SIGKILL, and may still hold the port
    console.error(error);
  }
  process.exitCode = exitCode;
};
process.once('SIGINT', () => void stop(130));
process.once('SIGTERM', () => void stop(143));
```

On Windows, `npm` and `npx` are `.cmd` shims, which Node.js won't start without a shell, so start a tool's JavaScript entry with `process.execPath` instead. There, `stopProcessTree` runs `taskkill /T /F`, which finds the descendants only while the root process still runs. On POSIX, a descendant that starts its own session or process group, such as with `setsid`, isn't stopped.

Use this when a script starts a server for a task, such as smoke tests, and must stop it whether the task passes or fails:

```ts
import { setTimeout as sleep } from 'node:timers/promises';
import { Exception } from 'jg-exception';
import { startProcess, stopProcessTree } from 'jg-process';

// the checks your script runs against the server
declare function runSmokeTests(baseUrl: string): Promise<void>;

const BASE_URL = 'http://localhost:3000';

const server = startProcess(process.execPath, ['server.js'], { cwd: 'apps/api' });

// waits until the server answers, and fails early when it exits or takes too long
const waitForServer = async (timeoutSeconds: number): Promise<void> => {
  const deadline = Date.now() + timeoutSeconds * 1000;
  while (server.exitCode === null && server.signalCode === null && Date.now() < deadline) {
    try {
      // any response, even an error status, means it's listening, and HEAD asks for no body
      await fetch(BASE_URL, { method: 'HEAD', signal: AbortSignal.timeout(1000) });
      return;
    } catch {
      await sleep(250);
    }
  }
  throw new Exception("The server didn't start.", {
    code: 'SERVER_NOT_READY',
    data: { baseUrl: BASE_URL, timeoutSeconds },
  });
};

try {
  await waitForServer(30);
  await runSmokeTests(BASE_URL);
} finally {
  // runs after a failure too, so no server is left holding the port for the next run
  await stopProcessTree(server);
}
```

## Starting a dev server on a free port

Use this when a script starts a server that needs a port, such as a second copy of your API for an agent or a test run, while 3000 may already be taken. `reservePort` keeps the preferred port when it's free and reserves another free one when it isn't, so the server never fails to start because of a port conflict, and `startProcessAndWait` returns once the server answers:

```ts
import { reservePort, startProcessAndWait, stopProcessTree } from 'jg-process';

// 3000 when it's free, or any free port when another server holds it
const reservation = await reservePort({ preferredPort: 3000 });
const { port } = reservation;

// the server must bind the port itself, so the reservation ends right before it starts
await reservation.release();
const server = await startProcessAndWait(
  {
    command: process.execPath,
    args: ['server.js'],
    cwd: 'apps/api',
    env: { ...process.env, PORT: String(port) },
  },
  { readyWhen: { url: `http://127.0.0.1:${port}/health` }, timeoutSeconds: 60 },
);
console.log(`The API is ready on http://localhost:${port}`);

process.once('SIGINT', () => {
  void stopProcessTree(server).finally(() => {
    process.exitCode = 130;
  });
});
```

When the server exits, fails to start, or doesn't answer within a minute, `startProcessAndWait` stops its whole process tree and rejects, with `PROCESS_EXITED_BEFORE_READY`, `PROCESS_START_FAILED`, or `PROCESS_NOT_READY`, so a failed start leaves nothing running. Another process can take the port between the release and the server binding it. It's a short window, but when two scripts start servers at the same moment, the server exits on `EADDRINUSE`, and running the script again picks another port.

## Running a package script from your own script

Use this in a script that runs other package scripts, such as a test orchestrator or a release script. On Windows, `pnpm` and `npm` are `.cmd` shims, which Node.js refuses to spawn without a shell, and a shell reads its arguments as commands. `resolvePackageManagerCommand` finds the package manager's own JavaScript entry instead, so the same command runs without a shell everywhere:

```ts
import { resolvePackageManagerCommand, runProcess } from 'jg-process';

// the package manager running this script, read from npm_execpath, or else pnpm wherever it's
// installed: in the project, or on PATH
const command = resolvePackageManagerCommand(['run', 'test:unit'], { packageManager: 'pnpm' });

const { exitCode, stdout, stderr } = await runProcess({ ...command, timeoutSeconds: 600 });
process.stdout.write(stdout);
process.stderr.write(stderr);
process.exitCode = exitCode ?? 1;
```

It throws `PACKAGE_MANAGER_NOT_FOUND` when pnpm is nowhere to be found, which a script can turn into a message asking the developer to install it.
