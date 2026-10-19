import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { runUntilInputEnds } from './run-until-input-ends.ts';

/*
 * runUntilInputEnds with real child processes, the way Playwright's web server runs it.
 */

let temporaryDirectory = '';

// the children a test started, stopped after it in case the code under test left one running
const startedPids: number[] = [];

/**
 * Checks whether a process still exists.
 * @param pid The process id.
 * @returns True until the process is gone.
 */
const isRunning = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/**
 * Builds the arguments of a Node.js child that writes its pid to a file and keeps running.
 * @param pidFile The file the child writes its pid to.
 * @returns The arguments for process.execPath.
 */
const longRunningChild = (pidFile: string): string[] => [
  '-e',
  'require("node:fs").writeFileSync(process.argv[1], String(process.pid)); setInterval(() => {}, 1000);',
  pidFile,
];

/**
 * Waits until a child has written its pid, and records it for cleanup.
 * @param pidFile The file the child writes its pid to.
 * @returns A promise that resolves to the pid.
 */
const readStartedPid = async (pidFile: string): Promise<number> => {
  const pid = await vi.waitFor(
    async () => {
      // an empty read, between the child opening the file and writing it, is retried
      const written = Number(await readFile(pidFile, 'utf8'));
      if (!Number.isInteger(written) || written <= 0) {
        throw new Error(`${pidFile} doesn't hold a pid yet.`);
      }
      return written;
    },
    { timeout: 10_000 },
  );
  startedPids.push(pid);
  return pid;
};

describe('runUntilInputEnds', () => {
  beforeAll(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'jg-run-until-input-ends-'));
  });

  afterEach(() => {
    for (const pid of startedPids.splice(0)) {
      if (isRunning(pid)) {
        process.kill(pid, 'SIGKILL');
      }
    }
  });

  afterAll(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  test('stops the command once the input ends, and resolves to 0', async () => {
    const input = new PassThrough();
    const pidFile = join(temporaryDirectory, 'stopped.pid');
    const result = runUntilInputEnds(process.execPath, longRunningChild(pidFile), input);
    const pid = await readStartedPid(pidFile);

    input.end();

    await expect(result).resolves.toBe(0);
    expect(isRunning(pid)).toBe(false);
    expect(input.listenerCount('end')).toBe(0);
  });

  test('keeps the command running while the input only carries data', async () => {
    const input = new PassThrough();
    const pidFile = join(temporaryDirectory, 'running.pid');
    const result = runUntilInputEnds(process.execPath, longRunningChild(pidFile), input);
    const pid = await readStartedPid(pidFile);

    input.write('data the command never reads\n');
    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });

    expect(isRunning(pid)).toBe(true);
    input.end();
    await expect(result).resolves.toBe(0);
  });

  test("resolves to the command's exit code when it exits on its own, and stops listening", async () => {
    const input = new PassThrough();

    await expect(
      runUntilInputEnds(process.execPath, ['-e', 'process.exit(3)'], input),
    ).resolves.toBe(3);
    expect(input.listenerCount('end')).toBe(0);
  });

  test('resolves to 1 when a signal stops the command', async () => {
    const input = new PassThrough();
    const pidFile = join(temporaryDirectory, 'signaled.pid');
    const result = runUntilInputEnds(process.execPath, longRunningChild(pidFile), input);
    const pid = await readStartedPid(pidFile);

    process.kill(pid, 'SIGKILL');

    await expect(result).resolves.toBe(1);
  });

  test("rejects with the spawn error when the command can't start", async () => {
    const input = new PassThrough();

    await expect(
      runUntilInputEnds(join(temporaryDirectory, 'missing-command'), [], input),
    ).rejects.toThrow(/ENOENT/u);
    expect(input.listenerCount('end')).toBe(0);
  });
});
