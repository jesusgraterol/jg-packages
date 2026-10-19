import type { ChildProcess } from 'node:child_process';

// what a readiness wait shares: its deadline, its pace, and what ends it early
export type IReadinessWaitOptions = {
  // the most seconds the whole wait can take
  timeoutSeconds: number;

  // the seconds between probes. Defaults to 0.25
  intervalSeconds?: number | undefined;

  // stops the wait and rejects with the signal's reason when it aborts
  signal?: AbortSignal | undefined;

  // a process whose exit or start failure ends the wait, because it can no longer become ready
  child?: ChildProcess | undefined;
};

// the options waitForPort takes
export type IWaitForPortOptions = IReadinessWaitOptions & {
  // the address to connect to. Defaults to 127.0.0.1
  host?: string | undefined;

  // the seconds each connection attempt can take. Defaults to 1
  connectTimeoutSeconds?: number | undefined;
};

// the options waitForUrl takes
export type IWaitForUrlOptions = IReadinessWaitOptions & {
  // the seconds each request can take. Defaults to 2
  requestTimeoutSeconds?: number | undefined;

  // whether a response means ready. Defaults to response.ok; redirects aren't followed
  isReady?: ((response: Response) => boolean | Promise<boolean>) | undefined;
};

// what startProcessAndWait waits for: a port, a URL, or a probe returning other than null, undefined, or false
export type IReadyWhen =
  | { port: number; host?: string | undefined }
  | { url: string | URL; isReady?: IWaitForUrlOptions['isReady'] }
  | { probe: (signal: AbortSignal) => unknown };

// the options startProcessAndWait takes
export type IStartProcessAndWaitOptions = Omit<IReadinessWaitOptions, 'child'> & {
  // the condition that means the process is ready
  readyWhen: IReadyWhen;

  // the seconds stopProcessTree waits after SIGTERM when the wait fails. Defaults to its own
  gracePeriodSeconds?: number | undefined;
};
