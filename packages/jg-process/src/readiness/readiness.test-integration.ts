// @vitest-environment node
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type RequestListener, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { expectToRejectCode } from 'jg-exception/testing';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';

import { stopProcessTree } from '../process-tree/index.js';
import { reservePort } from '../reserve-port/index.js';
import { ERRORS } from '../shared/index.js';

import { startProcessAndWait, waitForPort, waitForUrl } from './readiness.js';

// process groups, which the tree checks rely on, exist only on POSIX
const IS_WINDOWS = process.platform === 'win32';

// a free port, released so the code under test can bind it
const findFreePort = async (): Promise<number> => {
  const reservation = await reservePort();
  await reservation.release();
  return reservation.port;
};

// whether a process is gone
const isGone = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ESRCH';
  }
};

// a child script that serves HTTP on a port after a delay
const LISTEN_LATER = (port: number, delayMs: number): string =>
  `setTimeout(() => require('node:http').createServer((request, response) => response.end('ok')).listen(${port}, '127.0.0.1'), ${delayMs});`;

// a child script that ignores SIGTERM, starts a grandchild that ignores it too, and never listens
const STUBBORN_PARENT = (pidFile: string): string => `
  const { spawn } = require('node:child_process');
  const { writeFileSync } = require('node:fs');
  process.on('SIGTERM', () => {});
  const grandchild = spawn(process.execPath, ['-e', 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  writeFileSync(${JSON.stringify(pidFile)}, JSON.stringify({ child: process.pid, grandchild: grandchild.pid }));
  setInterval(() => {}, 1000);
`;

describe('readiness waits', () => {
  let directory: string;
  const servers: Server[] = [];
  const children: ChildProcess[] = [];

  // starts an HTTP server on a free port, and returns its origin
  const serve = async (listener: RequestListener): Promise<string> => {
    const server = createServer(listener);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    return `http://127.0.0.1:${typeof address === 'object' && address !== null ? address.port : 0}`;
  };

  beforeAll(async () => {
    directory = realpathSync(await mkdtemp(join(tmpdir(), 'jg-process-ready-')));
  });

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))),
    );
    await Promise.all(children.splice(0).map((child) => stopProcessTree(child, 0.2)));
  });

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  describe('waitForPort', () => {
    test('resolves once the port accepts connections', async () => {
      const port = await findFreePort();
      const server = createServer();
      servers.push(server);
      setTimeout(() => server.listen(port, '127.0.0.1'), 300);

      await expect(waitForPort(port, { timeoutSeconds: 5, intervalSeconds: 0.05 })).resolves.toBe(
        undefined,
      );
    });

    test('rejects with PROCESS_NOT_READY, and the wait timeout as its cause, when nothing listens', async () => {
      const port = await findFreePort();
      let error: unknown;
      try {
        await waitForPort(port, { timeoutSeconds: 0.5, intervalSeconds: 0.05 });
      } catch (caught) {
        error = caught;
      }

      expect(error).toMatchObject({
        code: ERRORS.PROCESS_NOT_READY,
        message: "The process wasn't ready within 0.5 seconds.",
        data: { timeoutSeconds: 0.5 },
        cause: { code: 'WAIT_UNTIL_TIMED_OUT' },
      });
    });

    test("rejects at once with the reason of a signal that's already aborted", async () => {
      const reason = new Error('already gone');

      await expect(
        waitForPort(await findFreePort(), { timeoutSeconds: 5, signal: AbortSignal.abort(reason) }),
      ).rejects.toBe(reason);
    });

    test('rejects at once for a child that already exited', async () => {
      const child = spawn(process.execPath, ['-e', 'process.exit(4)'], { stdio: 'ignore' });
      await new Promise((resolve) => child.once('exit', resolve));

      await expect(
        waitForPort(await findFreePort(), { timeoutSeconds: 5, child }),
      ).rejects.toMatchObject({
        code: ERRORS.PROCESS_EXITED_BEFORE_READY,
        data: { exitCode: 4, signalCode: null },
      });
    });

    test("rejects with the signal's reason when it aborts", async () => {
      const port = await findFreePort();
      const controller = new AbortController();
      const reason = new Error('the user left');
      setTimeout(() => controller.abort(reason), 100);

      await expect(
        waitForPort(port, { timeoutSeconds: 5, signal: controller.signal }),
      ).rejects.toBe(reason);
    });
  });

  describe('waitForUrl', () => {
    test('resolves once the URL answers with a 2xx status, after a 503', async () => {
      let requests = 0;
      const origin = await serve((_request, response) => {
        requests += 1;
        response.statusCode = requests < 3 ? 503 : 200;
        response.end();
      });

      await waitForUrl(`${origin}/health`, { timeoutSeconds: 5, intervalSeconds: 0.05 });

      expect(requests).toBe(3);
    });

    test('uses the given predicate, even one that reads the body', async () => {
      let requests = 0;
      const origin = await serve((_request, response) => {
        requests += 1;
        response.end(requests < 2 ? 'starting' : 'ready');
      });

      await waitForUrl(new URL('/status', origin), {
        timeoutSeconds: 5,
        intervalSeconds: 0.05,
        isReady: async (response) => (await response.text()) === 'ready',
      });

      expect(requests).toBe(2);
    });

    test('never follows a redirect', async () => {
      let redirectedRequests = 0;
      const origin = await serve((request, response) => {
        if (request.url === '/elsewhere') {
          redirectedRequests += 1;
          response.end();
          return;
        }
        response.statusCode = 302;
        response.setHeader('location', '/elsewhere');
        response.end();
      });

      await expectToRejectCode(
        waitForUrl(`${origin}/health`, { timeoutSeconds: 0.5, intervalSeconds: 0.05 }),
        ERRORS.PROCESS_NOT_READY,
      );
      await waitForUrl(`${origin}/health`, {
        timeoutSeconds: 5,
        isReady: (response) => response.status === 302,
      });
      expect(redirectedRequests).toBe(0);
    });

    test('treats a server that refuses connections as not ready yet', async () => {
      const port = await findFreePort();

      await expectToRejectCode(
        waitForUrl(`http://127.0.0.1:${port}/`, { timeoutSeconds: 0.5, intervalSeconds: 0.05 }),
        ERRORS.PROCESS_NOT_READY,
      );
    });
  });

  describe('startProcessAndWait', () => {
    test('resolves with the running child once its port accepts connections', async () => {
      const port = await findFreePort();

      const child = await startProcessAndWait(
        { command: process.execPath, args: ['-e', LISTEN_LATER(port, 300)], stdio: 'ignore' },
        { readyWhen: { port }, timeoutSeconds: 10, intervalSeconds: 0.05 },
      );
      children.push(child);

      expect(child.exitCode).toBeNull();
      await expect(waitForPort(port, { timeoutSeconds: 1 })).resolves.toBe(undefined);
    });

    test('resolves once its URL answers, and once a probe returns a value', async () => {
      const port = await findFreePort();
      const child = await startProcessAndWait(
        { command: process.execPath, args: ['-e', LISTEN_LATER(port, 100)], stdio: 'ignore' },
        {
          readyWhen: { url: `http://127.0.0.1:${port}/` },
          timeoutSeconds: 10,
          intervalSeconds: 0.05,
        },
      );
      children.push(child);
      let probes = 0;

      const probed = await startProcessAndWait(
        { command: process.execPath, args: ['-e', 'setInterval(() => {}, 1000)'], stdio: 'ignore' },
        {
          readyWhen: { probe: () => (probes += 1) >= 3 },
          timeoutSeconds: 10,
          intervalSeconds: 0.05,
        },
      );
      children.push(probed);

      expect(probes).toBe(3);
    });

    test('rejects with the exit code when the child exits before it is ready', async () => {
      let error: unknown;
      try {
        await startProcessAndWait(
          { command: process.execPath, args: ['-e', 'process.exit(3)'], stdio: 'ignore' },
          { readyWhen: { port: await findFreePort() }, timeoutSeconds: 10 },
        );
      } catch (caught) {
        error = caught;
      }

      expect(error).toMatchObject({
        code: ERRORS.PROCESS_EXITED_BEFORE_READY,
        message: 'The process exited before it was ready.',
        data: { exitCode: 3, signalCode: null },
      });
    });

    test('rejects with PROCESS_START_FAILED for a command that cannot start', async () => {
      await expectToRejectCode(
        startProcessAndWait(
          { command: join(directory, 'missing-command'), args: [], stdio: 'ignore' },
          { readyWhen: { port: await findFreePort() }, timeoutSeconds: 10 },
        ),
        ERRORS.PROCESS_START_FAILED,
        'Unable to start the process.',
      );
    });

    test.skipIf(IS_WINDOWS)(
      'stops the whole tree, grandchild included, when the child is not ready in time',
      async () => {
        const pidFile = join(directory, 'timeout-pids.json');

        await expectToRejectCode(
          startProcessAndWait(
            { command: process.execPath, args: ['-e', STUBBORN_PARENT(pidFile)], stdio: 'ignore' },
            {
              readyWhen: { port: await findFreePort() },
              timeoutSeconds: 1,
              intervalSeconds: 0.05,
              gracePeriodSeconds: 0.2,
            },
          ),
          ERRORS.PROCESS_NOT_READY,
        );

        expect(existsSync(pidFile)).toBe(true);
        const pids = JSON.parse(readFileSync(pidFile, 'utf8')) as {
          child: number;
          grandchild: number;
        };
        expect(isGone(pids.child)).toBe(true);
        expect(isGone(pids.grandchild)).toBe(true);
      },
    );

    test.skipIf(IS_WINDOWS)(
      "stops the tree and rejects with the signal's reason when it aborts",
      async () => {
        const pidFile = join(directory, 'abort-pids.json');
        const controller = new AbortController();
        const reason = new Error('the user left');
        const pending = startProcessAndWait(
          { command: process.execPath, args: ['-e', STUBBORN_PARENT(pidFile)], stdio: 'ignore' },
          {
            readyWhen: { port: await findFreePort() },
            timeoutSeconds: 10,
            intervalSeconds: 0.05,
            signal: controller.signal,
            gracePeriodSeconds: 0.2,
          },
        );
        while (!existsSync(pidFile)) {
          await sleep(20);
        }

        controller.abort(reason);

        await expect(pending).rejects.toBe(reason);
        const pids = JSON.parse(readFileSync(pidFile, 'utf8')) as {
          child: number;
          grandchild: number;
        };
        expect(isGone(pids.child)).toBe(true);
        expect(isGone(pids.grandchild)).toBe(true);
      },
    );
  });
});
