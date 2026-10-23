import type { ChildProcess } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/index.js';

import { STOP_POLL_INTERVAL_MILLISECONDS, WINDOWS_PROCESS_LINE_PATTERN } from './constants.js';
import type { IWindowsProcess } from './types.js';

/**
 * Checks whether a child process has exited and Node.js has processed its exit.
 * @param child The child process.
 * @returns True when the child has an exit code or a terminating signal.
 */
export const hasExited = (child: ChildProcess): boolean =>
  child.exitCode !== null || child.signalCode !== null;

/**
 * Polls a condition until it holds or the time runs out.
 * @param condition The condition to check.
 * @param milliseconds The maximum time to wait.
 * @returns A promise that resolves to whether the condition held in time.
 */
export const waitFor = async (condition: () => boolean, milliseconds: number): Promise<boolean> => {
  const deadline = Date.now() + milliseconds;
  while (!condition()) {
    if (Date.now() >= deadline) {
      return false;
    }
    await sleep(STOP_POLL_INTERVAL_MILLISECONDS);
  }
  return true;
};

/**
 * Builds the error thrown when part of a process tree outlives the forced stop.
 * @param pid The child's pid.
 * @returns The error.
 */
export const treeSurvived = (pid: number): Exception =>
  new Exception(`The process tree of pid ${pid} is still running after it was force-stopped.`, {
    code: ERRORS.PROCESS_TREE_SURVIVED,
  });

/**
 * Reads the process list WINDOWS_PROCESS_LIST_COMMAND prints, one `pid parentPid createdAt` line
 * per process, skipping any line that isn't one.
 * @param output The command's output.
 * @returns The processes.
 */
export const parseWindowsProcessList = (output: string): IWindowsProcess[] =>
  output.split(/\r?\n/u).flatMap((line) => {
    const match = WINDOWS_PROCESS_LINE_PATTERN.exec(line.trim());
    if (match === null) {
      return [];
    }
    const [, pid = '', parentPid = '', createdAt = ''] = match;
    return [{ pid: Number(pid), parentPid: Number(parentPid), createdAt: BigInt(createdAt) }];
  });

/**
 * Finds a process's descendants in a snapshot of Windows' processes. Windows reuses process ids,
 * and a process keeps the id of a parent that has exited, so a process counts as a child only
 * when it started no earlier than the parent the id now names.
 * @param processes The snapshot.
 * @param pid The root process's id.
 * @returns The descendants' ids, nearest first, or none when the root isn't in the snapshot.
 */
export const findWindowsDescendants = (processes: IWindowsProcess[], pid: number): number[] => {
  const childrenByParent = new Map<number, IWindowsProcess[]>();
  for (const entry of processes) {
    const siblings = childrenByParent.get(entry.parentPid);
    if (siblings === undefined) {
      childrenByParent.set(entry.parentPid, [entry]);
    } else {
      siblings.push(entry);
    }
  }
  const root = processes.find((entry) => entry.pid === pid);
  if (root === undefined) {
    return [];
  }
  const tree = [root];
  const seen = new Set([pid]);
  // the walk visits each process the tree gains while it runs, so every level is reached
  for (const parent of tree) {
    for (const entry of childrenByParent.get(parent.pid) ?? []) {
      if (!seen.has(entry.pid) && entry.createdAt >= parent.createdAt) {
        seen.add(entry.pid);
        tree.push(entry);
      }
    }
  }
  return tree.slice(1).map((entry) => entry.pid);
};
