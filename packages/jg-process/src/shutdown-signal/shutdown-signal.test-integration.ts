// @vitest-environment node
import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';

import { afterEach, describe, expect, test } from 'vitest';

// the built package, which a child process imports as an app would
const DIST_URL = new URL('../../dist/index.js', import.meta.url).href;

const children: ChildProcess[] = [];

afterEach(() => {
  for (const child of children.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
    }
  }
});

/**
 * Starts a Node.js child that creates a shutdown signal and keeps running, and waits until it's
 * listening.
 * @param options The options' source, such as `{ forceOnRepeat: true }`.
 * @param behavior Source that runs once the shutdown signal exists.
 * @returns A promise that resolves to the child.
 */
const startChild = async (options: string, behavior: string): Promise<ChildProcess> => {
  const source = `
    import { createShutdownSignal } from ${JSON.stringify(DIST_URL)};
    const shutdown = createShutdownSignal(${options});
    const keepAlive = setInterval(() => undefined, 1_000);
    ${behavior}
    process.stdout.write('ready\\n');
  `;
  const child = spawn(process.execPath, ['--input-type=module', '--eval', source], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  children.push(child);
  await new Promise<void>((resolve, reject) => {
    child.stdout?.on('data', (chunk: Buffer) => {
      if (chunk.toString('utf8').includes('ready')) {
        resolve();
      }
    });
    child.once('exit', () => {
      reject(new Error('The child exited before it was ready.'));
    });
  });
  return child;
};

/**
 * Waits for a child to exit.
 * @param child The child.
 * @returns A promise that resolves to its exit code and signal.
 */
const waitForExit = async (
  child: ChildProcess,
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> => {
  if (child.exitCode !== null || child.signalCode !== null) {
    return { code: child.exitCode, signal: child.signalCode };
  }
  const [code, signal] = (await once(child, 'exit')) as [number | null, NodeJS.Signals | null];
  return { code, signal };
};

describe.skipIf(process.platform === 'win32')('createShutdownSignal in a process', () => {
  test.each([
    ['SIGINT', 130],
    ['SIGTERM', 143],
  ] as const)('lets the process exit with the exit code of %s, %d', async (signal, exitCode) => {
    const child = await startChild(
      '',
      "shutdown.signal.addEventListener('abort', () => clearInterval(keepAlive));",
    );

    child.kill(signal);

    await expect(waitForExit(child)).resolves.toStrictEqual({ code: exitCode, signal: null });
  });

  test("leaves a signal to Node.js's default after dispose, which stops the process", async () => {
    const child = await startChild('', 'shutdown.dispose();');

    child.kill('SIGTERM');

    await expect(waitForExit(child)).resolves.toStrictEqual({ code: null, signal: 'SIGTERM' });
  });

  test('ignores a second signal by default, so a slow shutdown goes on', async () => {
    const child = await startChild('', '');

    child.kill('SIGINT');
    await sleep(200);
    child.kill('SIGINT');
    await sleep(300);

    expect(child.exitCode).toBeNull();
    expect(child.signalCode).toBeNull();
  });

  test('lets a second signal stop the process with forceOnRepeat', async () => {
    const child = await startChild('{ forceOnRepeat: true }', '');

    child.kill('SIGINT');
    await sleep(200);
    expect(child.exitCode).toBeNull();
    child.kill('SIGINT');

    await expect(waitForExit(child)).resolves.toStrictEqual({ code: null, signal: 'SIGINT' });
  });
});

/**
 * Starts a Node.js child with an IPC channel, as `fork` does, that runs the source and then says
 * it's ready over the channel.
 * @param source The child's code, which runs with createShutdownSignal imported.
 * @returns A promise that resolves to the child.
 */
const startIpcChild = async (source: string): Promise<ChildProcess> => {
  const child = spawn(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `import { createShutdownSignal } from ${JSON.stringify(DIST_URL)};\n${source}`,
    ],
    { stdio: ['ignore', 'pipe', 'inherit', 'ipc'] },
  );
  children.push(child);
  await new Promise<void>((resolve, reject) => {
    child.once('message', () => {
      resolve();
    });
    child.once('exit', () => {
      reject(new Error('The child exited before it was ready.'));
    });
  });
  return child;
};

/**
 * Reads everything a child writes to stdout until it exits.
 * @param child The child.
 * @returns A promise that resolves to the output.
 */
const readStdout = async (child: ChildProcess): Promise<string> => {
  let output = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    output += chunk.toString('utf8');
  });
  await waitForExit(child);
  return output;
};

describe('createShutdownSignal with disconnect', () => {
  test('shuts down as with SIGTERM when the parent closes the IPC channel', async () => {
    const child = await startIpcChild(`
      const shutdown = createShutdownSignal({ disconnect: true });
      const keepAlive = setInterval(() => undefined, 1_000);
      shutdown.signal.addEventListener('abort', () => {
        clearInterval(keepAlive);
        process.stdout.write(shutdown.receivedSignal() + ' ' + shutdown.signal.reason.code);
      });
      process.send('ready');
    `);
    const output = readStdout(child);

    child.disconnect();

    await expect(output).resolves.toBe('SIGTERM PROCESS_INTERRUPTED');
    expect(child.exitCode).toBe(143);
  });

  test('shuts down at once when the channel is already closed', async () => {
    const child = await startIpcChild(`
      process.send('ready', () => {
        process.disconnect();
        const shutdown = createShutdownSignal({ disconnect: true });
        process.stdout.write(String(shutdown.signal.aborted) + ' ' + shutdown.exitCode());
      });
    `);

    await expect(readStdout(child)).resolves.toBe('true 143');
  });

  test('lets the process exit after dispose while the parent keeps the channel open', async () => {
    const child = await startIpcChild(`
      const shutdown = createShutdownSignal({ disconnect: true });
      process.send('ready', () => {
        shutdown.dispose();
      });
    `);

    await expect(waitForExit(child)).resolves.toStrictEqual({ code: 0, signal: null });
  });

  test('ignores the option in a process without an IPC channel', async () => {
    const child = spawn(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `import { createShutdownSignal } from ${JSON.stringify(DIST_URL)};
        const shutdown = createShutdownSignal({ disconnect: true });
        process.stdout.write(String(shutdown.signal.aborted));
        shutdown.dispose();`,
      ],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    );
    children.push(child);

    await expect(readStdout(child)).resolves.toBe('false');
  });
});
