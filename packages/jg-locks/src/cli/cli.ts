#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { basename } from 'node:path';
import { extractMessage, getErrorCode, hasErrorCode } from 'jg-exception';
import { ERRORS as FS_ERRORS } from 'jg-fs';
import { createShutdownSignal, isMainModule, parseStrictArgs } from 'jg-process';

import { acquireLock, acquireLockAs, type ILock, inspectLock, listLocks } from '../locks/index.js';

import { EXIT_CODES, HELP, STATUS_SCHEMA_VERSION } from './constants.js';
import type { ICliOutput } from './types.js';
import {
  describeBusyLock,
  describeHolder,
  describeRecoveryRefusal,
  formatLockState,
  isUsageError,
  parseWait,
  toSignalExitCode,
  toStatusRecord,
  usageError,
} from './utilities.js';

// where the CLI writes when it runs as a command
const PROCESS_OUTPUT: ICliOutput = { out: process.stdout, err: process.stderr };

/**
 * Reads a command's lock name, which comes first.
 * @param name The argument.
 * @returns The name.
 * @throws
 * - JG_LOCKS_USAGE: The command needs a lock name.
 */
const readName = (name: string | undefined): string => {
  if (name === undefined || name.startsWith('-')) {
    throw usageError('The command needs a lock name.');
  }
  return name;
};

/**
 * Runs a command without a shell in the terminal's process group, so it can read the terminal,
 * forwarding SIGINT and SIGTERM to it while it runs, as npm does with its scripts.
 * @param command The executable.
 * @param args Its arguments.
 * @param output Where to write a failure to start.
 * @returns A promise that resolves to its exit code, 128 plus the signal's number when a signal
 * ended it, or 127 and 126 when it couldn't start.
 */
const runChild = (command: string, args: string[], output: ICliOutput): Promise<number> =>
  new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    const forward = (signal: NodeJS.Signals): void => {
      child.kill(signal);
    };
    process.on('SIGINT', forward);
    process.on('SIGTERM', forward);
    const settle = (exitCode: number): void => {
      process.off('SIGINT', forward);
      process.off('SIGTERM', forward);
      resolve(exitCode);
    };
    child.once('error', (error) => {
      output.err.write(`jg-locks: '${command}' could not start: ${extractMessage(error)}\n`);
      settle(getErrorCode(error) === 'ENOENT' ? EXIT_CODES.notFound : EXIT_CODES.cannotRun);
    });
    child.once('exit', (code, signal) => {
      settle(code ?? (signal === null ? EXIT_CODES.failure : toSignalExitCode(signal)));
    });
  });

/**
 * `jg-locks run <name> [--wait <seconds>] -- <command> [args...]`: takes the lock, runs the
 * command, and releases the lock once the command exits.
 * @param args The arguments after `run`.
 * @param output Where to write.
 * @returns A promise that resolves to the exit code.
 */
const runCommand = async (args: string[], output: ICliOutput): Promise<number> => {
  const separator = args.indexOf('--');
  if (separator === -1) {
    throw usageError("The run command needs '--' before the command to run.");
  }
  const [nameArgument, ...optionArgs] = args.slice(0, separator);
  const [command, ...commandArgs] = args.slice(separator + 1);
  const name = readName(nameArgument);
  if (command === undefined) {
    throw usageError("The run command needs a command after '--'.");
  }
  const { wait } = parseStrictArgs(optionArgs, { wait: { type: 'string' } });
  const waitSeconds = parseWait(wait);
  const shutdown = createShutdownSignal({ setExitCode: false });
  let lock: ILock;
  try {
    lock = await acquireLockAs(
      name,
      {
        waitSeconds,
        signal: shutdown.signal,
        onWait: (state) => {
          output.err.write(`jg-locks: waiting for ${describeHolder(state, Date.now())}\n`);
        },
      },
      basename(command),
    );
  } catch (error) {
    const exitCode = shutdown.exitCode();
    if (exitCode !== null) {
      return exitCode;
    }
    if (!hasErrorCode(error, FS_ERRORS.LOCK_BUSY)) {
      throw error;
    }
    output.err.write(`jg-locks: ${describeBusyLock(await inspectLock(name), Date.now())}\n`);
    return EXIT_CODES.busy;
  } finally {
    shutdown.dispose();
  }
  const exitCode = await runChild(command, commandArgs, output);
  try {
    await lock.release();
  } catch (error) {
    output.err.write(`jg-locks: ${extractMessage(error)}\n`);
    return exitCode === EXIT_CODES.success ? EXIT_CODES.failure : exitCode;
  }
  return exitCode;
};

/**
 * `jg-locks status [--json]`: lists every lock with its state and holder.
 * @param args The arguments after `status`.
 * @param output Where to write.
 * @returns A promise that resolves to the exit code.
 */
const statusCommand = async (args: string[], output: ICliOutput): Promise<number> => {
  const { json } = parseStrictArgs(args, { json: { type: 'boolean' } });
  const { locks, isTruncated } = await listLocks();
  const nowMs = Date.now();
  if (json) {
    const records = locks.map((state) => toStatusRecord(state, nowMs));
    output.out.write(
      `${JSON.stringify({ schemaVersion: STATUS_SCHEMA_VERSION, locks: records, isTruncated })}\n`,
    );
    return EXIT_CODES.success;
  }
  const lines = locks.map((state) => formatLockState(state, nowMs));
  if (lines.length === 0) {
    lines.push('No locks are held.');
  }
  if (isTruncated) {
    lines.push(`Only the first ${locks.length} locks are listed.`);
  }
  output.out.write(`${lines.join('\n')}\n`);
  return EXIT_CODES.success;
};

/**
 * `jg-locks recover <name> --nonce <nonce>`: takes the lock over from the dead holder with that
 * nonce, and releases it.
 * @param args The arguments after `recover`.
 * @param output Where to write.
 * @returns A promise that resolves to the exit code.
 */
const recoverCommand = async (args: string[], output: ICliOutput): Promise<number> => {
  const [nameArgument, ...optionArgs] = args;
  const name = readName(nameArgument);
  const { nonce } = parseStrictArgs(optionArgs, { nonce: { type: 'string', required: true } });
  const state = await inspectLock(name);
  const refusal = describeRecoveryRefusal(state, nonce);
  if (refusal !== null || state.owner === null) {
    output.err.write(`jg-locks: ${refusal ?? describeBusyLock(state, Date.now())}\n`);
    return EXIT_CODES.failure;
  }
  let lock: ILock;
  try {
    lock = await acquireLock(name, { recoverFrom: state.owner });
  } catch (error) {
    if (!hasErrorCode(error, FS_ERRORS.LOCK_BUSY)) {
      throw error;
    }
    output.err.write(`jg-locks: ${describeBusyLock(await inspectLock(name), Date.now())}\n`);
    return EXIT_CODES.failure;
  }
  await lock.release();
  output.out.write(`Recovered '${name}' from pid ${state.owner.pid}; the lock is free.\n`);
  return EXIT_CODES.success;
};

/**
 * Runs the CLI with its arguments.
 * @param args The arguments, without the executable and script paths.
 * @param output Where to write, the process's stdout and stderr by default.
 * @returns A promise that resolves to the exit code.
 */
export const runCli = async (
  args: string[],
  output: ICliOutput = PROCESS_OUTPUT,
): Promise<number> => {
  const [command, ...rest] = args;
  try {
    switch (command) {
      case '--help':
        output.out.write(HELP);
        return EXIT_CODES.success;
      case 'run':
        return await runCommand(rest, output);
      case 'status':
        return await statusCommand(rest, output);
      case 'recover':
        return await recoverCommand(rest, output);
      default:
        throw usageError(
          command === undefined ? 'A command is needed.' : `Unknown command '${command}'.`,
        );
    }
  } catch (error) {
    if (isUsageError(error)) {
      output.err.write(
        `jg-locks: ${extractMessage(error)} Run jg-locks --help to see the usage.\n`,
      );
      return EXIT_CODES.usage;
    }
    output.err.write(`jg-locks: ${extractMessage(error)}\n`);
    return EXIT_CODES.failure;
  }
};

if (isMainModule(import.meta.url)) {
  process.exitCode = await runCli(process.argv.slice(2));
}
