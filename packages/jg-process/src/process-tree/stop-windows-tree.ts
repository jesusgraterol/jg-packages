import { execFile, type ChildProcess } from 'node:child_process';

import { WINDOWS_PROCESS_LIST_COMMAND, WINDOWS_STOP_SECONDS } from './constants.js';
import {
  findWindowsDescendants,
  hasExited,
  parseWindowsProcessList,
  treeSurvived,
  waitFor,
} from './utilities.js';

/**
 * Lists a Windows process's descendants from PowerShell's Win32_Process snapshot, or none when it
 * can't be read, such as without PowerShell or when the snapshot takes too long.
 * @param pid The root process's id.
 * @returns A promise that resolves to the descendants' ids.
 */
const listWindowsDescendants = (pid: number): Promise<number[]> =>
  new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_PROCESS_LIST_COMMAND],
      { timeout: WINDOWS_STOP_SECONDS * 1000, windowsHide: true },
      (error, stdout) => {
        resolve(error === null ? findWindowsDescendants(parseWindowsProcessList(stdout), pid) : []);
      },
    );
  });

/**
 * Checks whether a process this one may query still runs. A process it may not query, such as
 * another user's that took over an exited process's id, counts as gone, since no stop started it.
 * @param pid The process's id.
 * @returns Whether it runs.
 */
const isOwnProcessRunning = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/**
 * Stops a process tree on Windows: it lists the root's descendants, runs taskkill /T /F, which
 * finds them by walking down from a live root process, and waits until the root and every
 * listed descendant have exited. TerminateProcess only starts an exit, so until then a stopped
 * process can still hold files, such as its working directory. Descendants orphaned after the
 * root exited can't be found this way.
 * @param child The child process.
 * @param pid The child's pid.
 * @returns A promise that resolves once the root and its listed descendants have exited.
 * @throws
 * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped.
 */
export const stopWindowsTree = async (child: ChildProcess, pid: number): Promise<void> => {
  if (hasExited(child)) {
    return;
  }
  // taskkill names the descendants it stops only in localized text, so they're listed first
  const descendants = new Set(await listWindowsDescendants(pid));
  if (hasExited(child)) {
    return;
  }
  // a failed taskkill is detected below, by a process of the tree that keeps running
  await new Promise<void>((resolve) => {
    execFile(
      'taskkill',
      ['/PID', String(pid), '/T', '/F'],
      { timeout: WINDOWS_STOP_SECONDS * 1000, windowsHide: true },
      () => resolve(),
    );
  });
  // a descendant seen gone is never checked again, so an id Windows reuses can't keep it alive
  const isStopped = (): boolean => {
    for (const descendant of descendants) {
      if (!isOwnProcessRunning(descendant)) {
        descendants.delete(descendant);
      }
    }
    return hasExited(child) && descendants.size === 0;
  };
  if (!(await waitFor(isStopped, WINDOWS_STOP_SECONDS * 1000))) {
    throw treeSurvived(pid);
  }
};
