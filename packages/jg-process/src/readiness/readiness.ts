import type { ChildProcess } from 'node:child_process';
import { createConnection } from 'node:net';
import { Exception, hasErrorCode } from 'jg-exception';
import { ERRORS as UTILITIES_ERRORS, waitUntil } from 'jg-utilities';

import { startProcess, stopProcessTree } from '../process-tree/index.js';
import { ERRORS, type IStartProcessCommand } from '../shared/index.js';

import {
  DEFAULT_CONNECT_TIMEOUT_SECONDS,
  DEFAULT_READINESS_HOST,
  DEFAULT_READINESS_INTERVAL_SECONDS,
  DEFAULT_REQUEST_TIMEOUT_SECONDS,
  MAX_READINESS_PORT,
} from './constants.js';
import type {
  IReadinessWaitOptions,
  IReadyWhen,
  IStartProcessAndWaitOptions,
  IWaitForPortOptions,
  IWaitForUrlOptions,
} from './types.js';

/**
 * Checks a duration option: a finite number of seconds above 0, or 0 and above when it may be 0.
 * @param option The option's name.
 * @param value Its value.
 * @param minimum Whether the duration may be 0.
 * @param isRequired Whether it must be given; an optional duration has a default.
 * @throws
 * - INVALID_READINESS_OPTIONS: The readiness options need finite, positive seconds.
 */
const assertSeconds = (
  option: string,
  value: unknown,
  minimum: 'positive' | 'zero',
  isRequired: boolean = false,
): void => {
  const isValid =
    (value === undefined && !isRequired) ||
    (typeof value === 'number' &&
      Number.isFinite(value) &&
      (minimum === 'zero' ? value >= 0 : value > 0));
  if (!isValid) {
    throw new Exception('The readiness options need finite, positive seconds.', {
      code: ERRORS.INVALID_READINESS_OPTIONS,
      data: { option, value: String(value) },
    });
  }
};

/**
 * Checks a port: an integer from 1 to 65535.
 * @param port The port.
 * @throws
 * - INVALID_PORT: The port must be an integer from 1 to 65535.
 */
const assertPort = (port: unknown): void => {
  if (!(
    Number.isInteger(port) &&
    (port as number) >= 1 &&
    (port as number) <= MAX_READINESS_PORT
  )) {
    throw new Exception('The port must be an integer from 1 to 65535.', {
      code: ERRORS.INVALID_PORT,
      data: { port: String(port) },
    });
  }
};

/**
 * Checks the options every readiness wait shares, and the condition it waits for.
 * @param options The shared options.
 * @param readyWhen The condition, if the wait has one to check.
 * @throws
 * - INVALID_READINESS_OPTIONS: The readiness options need finite, positive seconds.
 * - INVALID_PORT: The port must be an integer from 1 to 65535.
 */
const assertWaitOptions = (
  { timeoutSeconds, intervalSeconds }: IReadinessWaitOptions,
  readyWhen?: IReadyWhen,
): void => {
  assertSeconds('timeoutSeconds', timeoutSeconds, 'positive', true);
  assertSeconds('intervalSeconds', intervalSeconds, 'positive');
  if (readyWhen === undefined) {
    return;
  }
  if ('port' in readyWhen) {
    assertPort(readyWhen.port);
  } else if ('url' in readyWhen) {
    if (!URL.canParse(readyWhen.url.toString())) {
      throw new Exception('The readiness options need a valid URL.', {
        code: ERRORS.INVALID_READINESS_OPTIONS,
        data: { option: 'url', value: String(readyWhen.url) },
      });
    }
  } else if (typeof readyWhen.probe !== 'function') {
    throw new Exception('The readiness options need a probe function.', {
      code: ERRORS.INVALID_READINESS_OPTIONS,
      data: { option: 'probe' },
    });
  }
};

/**
 * Watches a child process for the end of its chance to become ready: an exit, or a failure to
 * start. Either aborts the returned signal, with the error the wait rejects with as its reason.
 * @param child The child, if the wait has one.
 * @returns The signal, and the function that stops watching.
 */
const watchChild = (
  child: ChildProcess | undefined,
): { signal: AbortSignal | undefined; dispose: () => void } => {
  if (child === undefined) {
    return { signal: undefined, dispose: () => undefined };
  }
  const controller = new AbortController();
  const onExit = (exitCode: number | null, signalCode: NodeJS.Signals | null): void => {
    controller.abort(
      new Exception('The process exited before it was ready.', {
        code: ERRORS.PROCESS_EXITED_BEFORE_READY,
        data: { exitCode, signalCode },
      }),
    );
  };
  const onError = (error: Error): void => {
    controller.abort(
      new Exception('Unable to start the process.', {
        code: ERRORS.PROCESS_START_FAILED,
        cause: error,
      }),
    );
  };
  if (child.exitCode !== null || child.signalCode !== null) {
    onExit(child.exitCode, child.signalCode);
  }
  child.once('exit', onExit);
  child.once('error', onError);
  return {
    signal: controller.signal,
    dispose: () => {
      child.off('exit', onExit);
      child.off('error', onError);
    },
  };
};

/**
 * Probes until the probe returns a value other than null, undefined, or false, the deadline
 * passes, or the wait is stopped. Each
 * probe gets a signal that aborts when the wait ends, so none outlives it.
 * @param probe The probe.
 * @param options The deadline, the interval, the caller's signal, and the child to watch.
 * @returns A promise that resolves once the probe succeeds.
 * @throws
 * - PROCESS_NOT_READY: The process wasn't ready in time.
 * - PROCESS_EXITED_BEFORE_READY: The process exited before it was ready.
 * - PROCESS_START_FAILED: Unable to start the process.
 * - The signal's reason when the signal aborts.
 */
const waitForReadiness = async (
  probe: (signal: AbortSignal) => unknown,
  {
    timeoutSeconds,
    intervalSeconds = DEFAULT_READINESS_INTERVAL_SECONDS,
    signal,
    child,
  }: IReadinessWaitOptions,
): Promise<void> => {
  const watcher = watchChild(child);
  const endController = new AbortController();
  const waitSignals = [signal, watcher.signal].filter(
    (candidate): candidate is AbortSignal => candidate !== undefined,
  );
  const waitSignal = waitSignals.length === 0 ? undefined : AbortSignal.any(waitSignals);
  const probeSignal = AbortSignal.any([...waitSignals, endController.signal]);
  try {
    await waitUntil(() => probe(probeSignal), {
      timeoutSeconds,
      intervalSeconds,
      ...(waitSignal === undefined ? {} : { signal: waitSignal }),
    });
  } catch (error) {
    if (hasErrorCode(error, UTILITIES_ERRORS.WAIT_UNTIL_TIMED_OUT)) {
      throw new Exception(`The process wasn't ready within ${timeoutSeconds} seconds.`, {
        code: ERRORS.PROCESS_NOT_READY,
        data: { timeoutSeconds },
        cause: error,
      });
    }
    throw error;
  } finally {
    endController.abort();
    watcher.dispose();
  }
};

/**
 * Tries one TCP connection, and destroys the socket either way.
 * @param port The port.
 * @param host The address.
 * @param timeoutSeconds How long the attempt can take.
 * @param signal Ends the attempt early.
 * @returns A promise that resolves to whether the connection was accepted.
 */
const canConnect = (
  port: number,
  host: string,
  timeoutSeconds: number,
  signal: AbortSignal,
): Promise<boolean> =>
  new Promise((resolve) => {
    const attemptSignal = AbortSignal.any([signal, AbortSignal.timeout(timeoutSeconds * 1000)]);
    if (attemptSignal.aborted) {
      resolve(false);
      return;
    }
    const socket = createConnection({ port, host });
    const finish = (isConnected: boolean): void => {
      attemptSignal.removeEventListener('abort', onAbort);
      socket.destroy();
      resolve(isConnected);
    };
    const onAbort = (): void => {
      finish(false);
    };
    attemptSignal.addEventListener('abort', onAbort, { once: true });
    socket.once('connect', () => {
      finish(true);
    });
    socket.once('error', onAbort);
  });

/**
 * Sends one request without following redirects, and asks the predicate whether it means ready. A
 * network error means not ready yet. The response's body is discarded either way.
 * @param url The URL.
 * @param timeoutSeconds How long the request can take.
 * @param isReady The predicate.
 * @param signal Ends the request early.
 * @returns A promise that resolves to whether the response means ready.
 */
const isUrlReady = async (
  url: string | URL,
  timeoutSeconds: number,
  isReady: (response: Response) => boolean | Promise<boolean>,
  signal: AbortSignal,
): Promise<boolean> => {
  let response: Response;
  try {
    response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutSeconds * 1000)]),
    });
  } catch {
    return false;
  }
  try {
    return await isReady(response);
  } finally {
    await response.body?.cancel().catch(() => undefined);
  }
};

/**
 * Builds the probe for a readiness condition.
 * @param readyWhen The condition.
 * @returns The probe.
 */
const createProbe = (readyWhen: IReadyWhen): ((signal: AbortSignal) => unknown) => {
  if ('port' in readyWhen) {
    return (signal) =>
      canConnect(
        readyWhen.port,
        readyWhen.host ?? DEFAULT_READINESS_HOST,
        DEFAULT_CONNECT_TIMEOUT_SECONDS,
        signal,
      );
  }
  if ('url' in readyWhen) {
    return (signal) =>
      isUrlReady(
        readyWhen.url,
        DEFAULT_REQUEST_TIMEOUT_SECONDS,
        readyWhen.isReady ?? ((response) => response.ok),
        signal,
      );
  }
  return readyWhen.probe;
};

/**
 * Waits until a TCP port accepts connections, such as a database or a dev server that a script
 * started, probing every `intervalSeconds` until `timeoutSeconds` pass. With a `child`, its exit or
 * failure to start ends the wait at once, since it can no longer become ready.
 * @param port The port, from 1 to 65535.
 * @param options The address, the deadline and pace, the signal, and the child to watch.
 * @returns A promise that resolves once a connection succeeds.
 * @example
 * import { waitForPort } from 'jg-process';
 *
 * await waitForPort(5432, { timeoutSeconds: 30 }); // PostgreSQL accepts connections
 * @throws
 * - INVALID_PORT: The port must be an integer from 1 to 65535.
 * - INVALID_READINESS_OPTIONS: The readiness options need finite, positive seconds.
 * - PROCESS_NOT_READY: The process wasn't ready in time.
 * - PROCESS_EXITED_BEFORE_READY: The process exited before it was ready.
 * - PROCESS_START_FAILED: Unable to start the process.
 * - The signal's reason when the signal aborts.
 */
export const waitForPort = async (port: number, options: IWaitForPortOptions): Promise<void> => {
  assertPort(port);
  assertWaitOptions(options);
  assertSeconds('connectTimeoutSeconds', options.connectTimeoutSeconds, 'positive');
  const host = options.host ?? DEFAULT_READINESS_HOST;
  const connectTimeoutSeconds = options.connectTimeoutSeconds ?? DEFAULT_CONNECT_TIMEOUT_SECONDS;
  await waitForReadiness(
    (signal) => canConnect(port, host, connectTimeoutSeconds, signal),
    options,
  );
};

/**
 * Waits until a URL answers in a way that means ready, by default with a 2xx status, such as a
 * health endpoint. Redirects aren't followed, a network error means not ready yet, and every
 * response's body is discarded. With a `child`, its exit or failure to start ends the wait at once.
 * @param url The URL.
 * @param options The deadline and pace, the request timeout, the predicate, the signal, and the
 * child to watch.
 * @returns A promise that resolves once a response means ready.
 * @example
 * import { waitForUrl } from 'jg-process';
 *
 * await waitForUrl('http://127.0.0.1:3000/health', { timeoutSeconds: 60 });
 * @throws
 * - INVALID_READINESS_OPTIONS: The readiness options need finite, positive seconds.
 * - PROCESS_NOT_READY: The process wasn't ready in time.
 * - PROCESS_EXITED_BEFORE_READY: The process exited before it was ready.
 * - PROCESS_START_FAILED: Unable to start the process.
 * - The signal's reason when the signal aborts.
 */
export const waitForUrl = async (url: string | URL, options: IWaitForUrlOptions): Promise<void> => {
  assertWaitOptions(options, { url });
  assertSeconds('requestTimeoutSeconds', options.requestTimeoutSeconds, 'positive');
  const requestTimeoutSeconds = options.requestTimeoutSeconds ?? DEFAULT_REQUEST_TIMEOUT_SECONDS;
  const isReady = options.isReady ?? ((response: Response) => response.ok);
  await waitForReadiness(
    (signal) => isUrlReady(url, requestTimeoutSeconds, isReady, signal),
    options,
  );
};

/**
 * Starts a long-running process, such as a dev server, with `startProcess`, and resolves with it
 * once it's ready: its port accepts connections, its URL answers, or a probe returns a value other
 * than null, undefined, or false. When it exits, fails to start, isn't ready in time, or the signal aborts, its whole
 * process tree is stopped before the call rejects, so nothing is left running.
 * @param command The command, its arguments, and the working directory, environment, and stdio.
 * @param options What ready means, the deadline and pace, the signal, and the grace period
 * stopProcessTree gets on failure.
 * @returns A promise that resolves to the ready child process, which the caller owns.
 * @example
 * import { startProcessAndWait, stopProcessTree } from 'jg-process';
 *
 * const server = await startProcessAndWait(
 *   { command: process.execPath, args: ['server.js'], cwd: 'apps/api' },
 *   { readyWhen: { url: 'http://127.0.0.1:3000/health' }, timeoutSeconds: 60 },
 * );
 * await stopProcessTree(server);
 * @throws
 * - INVALID_PORT: The port must be an integer from 1 to 65535.
 * - INVALID_READINESS_OPTIONS: The readiness options need finite, positive seconds.
 * - PROCESS_NOT_READY: The process wasn't ready in time.
 * - PROCESS_EXITED_BEFORE_READY: The process exited before it was ready.
 * - PROCESS_START_FAILED: Unable to start the process.
 * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped.
 * - The signal's reason when the signal aborts.
 */
export const startProcessAndWait = async (
  command: IStartProcessCommand,
  options: IStartProcessAndWaitOptions,
): Promise<ChildProcess> => {
  assertWaitOptions(options, options.readyWhen);
  assertSeconds('gracePeriodSeconds', options.gracePeriodSeconds, 'zero');
  const child = startProcess(command);
  try {
    await waitForReadiness(createProbe(options.readyWhen), { ...options, child });
    return child;
  } catch (error) {
    try {
      await stopProcessTree(child, options.gracePeriodSeconds);
    } catch {
      throw new Exception('The process tree is still running after it was force-stopped.', {
        code: ERRORS.PROCESS_TREE_SURVIVED,
        data: { pid: child.pid ?? null },
        cause: error,
      });
    }
    throw error;
  }
};
