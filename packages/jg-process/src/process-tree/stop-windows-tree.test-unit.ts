import type * as ChildProcessModule from 'node:child_process';
import type * as TimersModule from 'node:timers/promises';
import { execFile, type ChildProcess } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { expectToRejectCode } from 'jg-exception/testing';

import { ERRORS } from '../shared/index.js';
import { stopWindowsTree } from './stop-windows-tree.js';

// replaces execFile, so a test answers for PowerShell and taskkill, which exist only on Windows
vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof ChildProcessModule>()),
  execFile: vi.fn(),
}));

// each poll's wait takes no time and moves the faked clock on by as long as it would have waited
vi.mock('node:timers/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof TimersModule>()),
  setTimeout: vi.fn((milliseconds: number) => {
    vi.advanceTimersByTime(milliseconds);
    return Promise.resolve();
  }),
}));

// the root's id, and a snapshot of its tree: 4120 > 4188 > 4196, beside an unrelated 5000
const ROOT_PID = 4120;
const PROCESS_LIST =
  '0 0 0\r\n4 0 0\r\n4120 900 100\r\n4188 4120 101\r\n4196 4188 102\r\n5000 900 50\r\n';

type IExecFileCallback = (error: Error | null, stdout: string, stderr: string) => void;

/**
 * Answers the commands the stop runs: PowerShell's process list, or a failure without one, and
 * taskkill, which runs onTaskkill.
 * @param processList What PowerShell prints, or undefined when it can't start.
 * @param onTaskkill What taskkill does, such as ending the root.
 */
const answerCommands = (processList: string | undefined, onTaskkill: () => void): void => {
  vi.mocked(execFile).mockImplementation(((
    command: string,
    _args: string[],
    _options: unknown,
    callback: IExecFileCallback,
  ) => {
    if (command !== 'powershell.exe') {
      onTaskkill();
      callback(null, '', '');
    } else if (processList === undefined) {
      callback(new Error('spawn powershell.exe ENOENT'), '', '');
    } else {
      callback(null, processList, '');
    }
    return {} as ChildProcess;
  }) as unknown as typeof execFile);
};

/**
 * Builds the root child process, running until a test sets its exit code.
 * @returns The child.
 */
const createRoot = (): ChildProcess =>
  ({ pid: ROOT_PID, exitCode: null, signalCode: null }) as unknown as ChildProcess;

/**
 * Makes process.kill(pid, 0) see the given processes as running, each for a number of checks, and
 * the rest as gone, or as another user's when listed in foreign.
 * @param checksUntilExit How many checks each running process survives.
 * @param foreign The processes this one may not query.
 * @returns How many times each process was checked.
 */
const simulateProcesses = (
  checksUntilExit: Map<number, number>,
  foreign: number[] = [],
): Map<number, number> => {
  const checks = new Map<number, number>();
  vi.spyOn(process, 'kill').mockImplementation((pid: number) => {
    checks.set(pid, (checks.get(pid) ?? 0) + 1);
    if (foreign.includes(pid)) {
      throw Object.assign(new Error('kill EPERM'), { code: 'EPERM' });
    }
    if ((checks.get(pid) ?? 0) > (checksUntilExit.get(pid) ?? 0)) {
      throw Object.assign(new Error('kill ESRCH'), { code: 'ESRCH' });
    }
    return true;
  });
  return checks;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.mocked(execFile).mockReset();
});

describe('stopWindowsTree', () => {
  test('lists the descendants, runs taskkill /T /F, and resolves once each has exited', async () => {
    const root = createRoot();
    answerCommands(PROCESS_LIST, () => Object.assign(root, { exitCode: 1 }));
    const checks = simulateProcesses(
      new Map([
        [4188, 3],
        [4196, 5],
      ]),
    );

    await stopWindowsTree(root, ROOT_PID);

    expect(vi.mocked(execFile).mock.calls.map((call) => [call[0], call[1]])).toStrictEqual([
      ['powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', expect.any(String)]],
      ['taskkill', ['/PID', '4120', '/T', '/F']],
    ]);
    // each was checked until it was seen gone, and never again; the unrelated process never
    expect(Object.fromEntries(checks)).toStrictEqual({ 4188: 4, 4196: 6 });
  });

  test('rejects with PROCESS_TREE_SURVIVED when a listed descendant outlives the wait', async () => {
    const root = createRoot();
    answerCommands(PROCESS_LIST, () => Object.assign(root, { exitCode: 1 }));
    simulateProcesses(new Map([[4196, Number.POSITIVE_INFINITY]]));

    await expectToRejectCode(stopWindowsTree(root, ROOT_PID), ERRORS.PROCESS_TREE_SURVIVED);
  });

  test('waits for the root alone when the processes cannot be listed, such as without PowerShell', async () => {
    const root = createRoot();
    answerCommands(undefined, () => Object.assign(root, { exitCode: 1 }));
    const checks = simulateProcesses(new Map());

    await stopWindowsTree(root, ROOT_PID);

    expect(vi.mocked(execFile)).toHaveBeenCalledTimes(2);
    expect(checks.size).toBe(0);
  });

  test("counts a process it may not query as gone, as when another user's took a descendant's id", async () => {
    const root = createRoot();
    answerCommands(PROCESS_LIST, () => Object.assign(root, { exitCode: 1 }));
    const checks = simulateProcesses(new Map(), [4188]);

    await stopWindowsTree(root, ROOT_PID);

    expect(Object.fromEntries(checks)).toStrictEqual({ 4188: 1, 4196: 1 });
  });

  test('stops nothing for a root that has exited', async () => {
    const root = Object.assign(createRoot(), { exitCode: 0 });

    await stopWindowsTree(root, ROOT_PID);

    expect(vi.mocked(execFile)).not.toHaveBeenCalled();
  });

  test('runs no taskkill for a root that exits while its descendants are listed', async () => {
    const root = createRoot();
    vi.mocked(execFile).mockImplementationOnce(((
      _command: string,
      _args: string[],
      _options: unknown,
      callback: IExecFileCallback,
    ) => {
      Object.assign(root, { exitCode: 0 });
      callback(null, PROCESS_LIST, '');
      return {} as ChildProcess;
    }) as unknown as typeof execFile);

    await stopWindowsTree(root, ROOT_PID);

    expect(vi.mocked(execFile)).toHaveBeenCalledTimes(1);
  });
});
