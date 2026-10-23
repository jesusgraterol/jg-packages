// @vitest-environment node
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { expectToThrowCode } from 'jg-exception/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';

import { isProcessRunning, startProcess, stopProcessTree } from './process-tree.js';

// process groups exist only on POSIX
const IS_WINDOWS = process.platform === 'win32';

// a child script that ignores SIGTERM and starts a grandchild that ignores it too
const STUBBORN_PARENT = (pidFile: string): string => `
  const { spawn } = require('node:child_process');
  const { writeFileSync } = require('node:fs');
  process.on('SIGTERM', () => {});
  const grandchild = spawn(process.execPath, ['-e', 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  writeFileSync(${JSON.stringify(pidFile)}, JSON.stringify({ child: process.pid, grandchild: grandchild.pid }));
  setInterval(() => {}, 1000);
`;

describe.skipIf(IS_WINDOWS)('startProcess & stopProcessTree', () => {
  let directory: string;
  const children: ChildProcess[] = [];
  const recordedPids: number[] = [];

  // whether a process is gone
  const isGone = (pid: number): boolean => {
    try {
      process.kill(pid, 0);
      return false;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === 'ESRCH';
    }
  };

  // polls a condition with a deadline instead of sleeping for a fixed time
  const waitFor = async (condition: () => boolean, milliseconds = 5000): Promise<void> => {
    const deadline = Date.now() + milliseconds;
    while (!condition()) {
      if (Date.now() > deadline) {
        throw new Error('The condition was not met in time.');
      }
      await sleep(20);
    }
  };

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'jg-process-'));
  });

  afterEach(() => {
    children.splice(0).forEach((child) => child.kill('SIGKILL'));
    recordedPids.splice(0).forEach((pid) => {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // the process is already gone
      }
    });
  });

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  test("inherits the parent's stdio by default", async () => {
    const child = startProcess(process.execPath, ['-e', '']);
    await new Promise((resolve) => child.once('exit', resolve));

    expect(child.stdout).toBeNull();
    expect(child.exitCode).toBe(0);
  });

  test('starts a child that leads its own process group', async () => {
    const child = startProcess(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      stdio: 'ignore',
    });
    children.push(child);
    await waitFor(() => child.pid !== undefined);
    expect(() => process.kill(-child.pid!, 0)).not.toThrow();
    await stopProcessTree(child);
    expect(child.signalCode).toBe('SIGTERM');
  });

  test('starts a child from a command object, with the same options as the positional form', async () => {
    // a file name unique to this run, so a repeated run never reads an earlier run's file
    const outputFile = join(directory, `object-form-${randomUUID()}.txt`);
    const child = startProcess({
      command: process.execPath,
      args: [
        '-e',
        `require('node:fs').writeFileSync(${JSON.stringify(outputFile)}, process.cwd())`,
      ],
      cwd: directory,
      stdio: 'ignore',
    });
    children.push(child);
    await new Promise((resolve) => {
      child.once('exit', resolve);
    });

    expect(child.exitCode).toBe(0);
    expect(readFileSync(outputFile, 'utf-8')).toBe(realpathSync(directory));
  });

  test('stops a child and its grandchild with SIGKILL after the grace period', async () => {
    // a file name unique to this run, so a repeated run never reads an earlier run's pids
    const pidFile = join(directory, `stubborn-${randomUUID()}.json`);
    const child = startProcess(process.execPath, ['-e', STUBBORN_PARENT(pidFile)], {
      stdio: 'ignore',
    });
    children.push(child);
    await waitFor(() => existsSync(pidFile));
    const pids = JSON.parse(readFileSync(pidFile, 'utf-8')) as {
      child: number;
      grandchild: number;
    };
    recordedPids.push(pids.grandchild);

    const startedAt = Date.now();
    await stopProcessTree(child, 1);
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(1000);
    expect(child.signalCode).toBe('SIGKILL');
    expect(isGone(pids.child)).toBe(true);
    expect(isGone(pids.grandchild)).toBe(true);
  });

  test('resolves immediately for a child that has already exited', async () => {
    const child = startProcess(process.execPath, ['-e', ''], { stdio: 'ignore' });
    await new Promise((resolve) => {
      child.once('exit', resolve);
    });
    const startedAt = Date.now();
    await stopProcessTree(child);
    expect(Date.now() - startedAt).toBeLessThan(500);
  });

  test('resolves immediately for a child that never started', async () => {
    const child = startProcess('a-command-that-does-not-exist', [], { stdio: 'ignore' });
    const error = new Promise((resolve) => {
      child.once('error', resolve);
    });
    await expect(stopProcessTree(child)).resolves.toBeUndefined();
    await error;
  });

  test('stops a child without its own process group, only once it has exited', async () => {
    // the child says it's ready once it ignores SIGTERM, so it's never signalled before then,
    // however slowly Node.js starts
    const child = spawn(
      process.execPath,
      [
        '-e',
        'process.on("SIGTERM", () => {}); process.stdout.write("ready"); setInterval(() => {}, 1000)',
      ],
      { stdio: ['ignore', 'pipe', 'ignore'] },
    );
    children.push(child);
    await new Promise((resolve) => child.stdout?.once('data', resolve));
    await stopProcessTree(child, 0.5);
    expect(child.signalCode).toBe('SIGKILL');
    expect(isGone(child.pid!)).toBe(true);
  });
});

describe.runIf(IS_WINDOWS)('stopProcessTree on Windows', () => {
  let directory: string;
  let child: ChildProcess | undefined;
  let grandchildPid: number | undefined;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'jg-process-'));
  });

  afterEach(async () => {
    child?.kill();
    if (grandchildPid !== undefined && isProcessRunning(grandchildPid)) {
      process.kill(grandchildPid);
    }
    child = undefined;
    grandchildPid = undefined;
    await rm(directory, { recursive: true, force: true, maxRetries: 10 });
  });

  test('resolves once the grandchild has exited, so its working directory can be removed', async () => {
    // Windows keeps a running process's working directory from being removed
    const workingDirectory = join(directory, 'grandchild');
    await mkdir(workingDirectory);
    const pidFile = join(directory, 'grandchild.pid');
    child = startProcess(
      process.execPath,
      [
        '-e',
        `
          const { spawn } = require('node:child_process');
          const { renameSync, writeFileSync } = require('node:fs');
          const grandchild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
            cwd: ${JSON.stringify(workingDirectory)},
            stdio: 'ignore',
          });
          writeFileSync(${JSON.stringify(`${pidFile}.tmp`)}, String(grandchild.pid));
          renameSync(${JSON.stringify(`${pidFile}.tmp`)}, ${JSON.stringify(pidFile)});
          setInterval(() => {}, 1000);
        `,
      ],
      { stdio: 'ignore' },
    );
    // the child renames the file into place, so it's whole once it exists
    await expect.poll(() => existsSync(pidFile), { timeout: 10_000 }).toBe(true);
    grandchildPid = Number(readFileSync(pidFile, 'utf-8'));

    await stopProcessTree(child);

    expect(isProcessRunning(grandchildPid)).toBe(false);
    // no retries: the directory must be free the moment the stop resolves
    await expect(rm(workingDirectory, { recursive: true })).resolves.toBeUndefined();
  });
});

describe('isProcessRunning', () => {
  test('tells a running process from one that exited', async () => {
    const child = spawn(process.execPath, ['--eval', 'setTimeout(() => undefined, 60_000)']);
    const pid = child.pid as number;

    expect(isProcessRunning(process.pid)).toBe(true);
    expect(isProcessRunning(pid)).toBe(true);

    child.kill('SIGKILL');
    await once(child, 'exit');

    await expect.poll(() => isProcessRunning(pid)).toBe(false);
  });

  test.each([[0], [-1], [1.5], [Number.NaN], [Number.MAX_SAFE_INTEGER + 1]])(
    'isProcessRunning(%d) -> throws INVALID_PROCESS_ID',
    (pid) => {
      expectToThrowCode(() => isProcessRunning(pid), ERRORS.INVALID_PROCESS_ID);
    },
  );
});
