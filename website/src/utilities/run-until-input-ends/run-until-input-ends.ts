import { spawn } from 'node:child_process';
import { once } from 'node:events';
import type { Readable } from 'node:stream';

/**
 * Runs a command until it exits, or until the input ends and then stops it with SIGTERM. Given a
 * process's stdin piped from its parent, the input ends when the parent closes the pipe or dies,
 * even from SIGKILL, so the command never outlives the parent. The command stays in this process's
 * process group, so whatever stops the group stops it too.
 * @param command The executable, run without a shell.
 * @param args Its arguments.
 * @param input The stream whose end stops the command, read and discarded.
 * @returns A promise that resolves to 0 when the input ended first, otherwise to the command's exit
 * code, or 1 when a signal stopped it.
 * @example
 * process.exitCode = await runUntilInputEnds(process.execPath, ['server.js'], process.stdin);
 * @throws
 * - The spawn error, such as ENOENT, when the command can't start.
 */
export const runUntilInputEnds = async (
  command: string,
  args: string[],
  input: Readable,
): Promise<number> => {
  const child = spawn(command, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  let isStopped = false;
  const stop = (): void => {
    isStopped = true;
    child.kill('SIGTERM');
  };
  input.once('end', stop);
  input.resume();
  try {
    const [code] = (await once(child, 'exit')) as [number | null, NodeJS.Signals | null];
    return isStopped ? 0 : (code ?? 1);
  } finally {
    input.off('end', stop);
    input.pause();
  }
};
