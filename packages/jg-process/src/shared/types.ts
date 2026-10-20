import type { StdioOptions } from 'node:child_process';

// how runProcess returns the output: decoded as UTF-8, or as the bytes the process wrote
export type IProcessOutputEncoding = 'utf-8' | 'buffer';

// the type of the output for an encoding: a string for 'utf-8', a Buffer for 'buffer'
export type IProcessOutput<TEncoding extends IProcessOutputEncoding> = TEncoding extends 'buffer'
  ? Buffer
  : string;

// the options accepted by runProcess
export type IRunProcessOptions<TEncoding extends IProcessOutputEncoding = 'utf-8'> = {
  // the executable to run, without a shell
  command: string;

  // the arguments passed to the executable
  args: string[];

  // the working directory. Defaults to the current one
  cwd?: string;

  // the environment variables. Defaults to process.env
  env?: NodeJS.ProcessEnv;

  // the data written to the process's stdin before it is closed
  input?: string | Uint8Array;

  // the seconds after which the process tree is stopped and the call rejects, a positive number of
  // at most 2,147,483
  timeoutSeconds?: number;

  // the bytes stdout and stderr can hold together, a positive safe integer. Defaults to
  // DEFAULT_MAX_OUTPUT_BYTES
  maxOutputBytes?: number;

  // stops the process tree and rejects with the signal's reason when it aborts
  signal?: AbortSignal;

  // whether stdout and stderr are decoded as UTF-8 or returned as the bytes the process wrote, such
  // as paths that aren't valid UTF-8. Defaults to 'utf-8'
  encoding?: TEncoding;
};

// the outcome of a process that ran to completion
export type IProcessResult<TOutput extends string | Buffer = string> = {
  // the exit code, or null when a signal ended the process
  exitCode: number | null;

  // the signal that ended the process, or null when it exited on its own
  signalCode: NodeJS.Signals | null;

  // the output, decoded as UTF-8, or as bytes with encoding 'buffer'
  stdout: TOutput;
  stderr: TOutput;

  // the milliseconds between the start and the end of the run
  durationMs: number;
};

// the options accepted by startProcess
export type IStartProcessOptions = {
  // the working directory. Defaults to the current one
  cwd?: string;

  // the environment variables. Defaults to process.env
  env?: NodeJS.ProcessEnv;

  // the stdio configuration. Defaults to 'inherit'
  stdio?: StdioOptions;
};

// a command and its options in one object, the form runProcess takes, accepted by startProcess too
export type IStartProcessCommand = IStartProcessOptions & {
  // the executable to run, without a shell
  command: string;

  // the arguments passed to the executable
  args: string[];
};
