import { constants } from 'node:os';

import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/index.js';
import { DEFAULT_SHUTDOWN_SIGNALS, UNHANDLEABLE_SIGNALS } from './constants.js';
import type { IShutdownSignal, IShutdownSignalOptions } from './types.js';

/**
 * Builds the exception for options that aren't valid.
 * @returns The INVALID_SIGNAL exception.
 */
const createInvalidSignalError = (): Exception =>
  new Exception(
    "The shutdown needs a non-empty list of signals Node.js can listen for, such as SIGINT, other than SIGKILL and SIGSTOP, and an onSignal that's a function when it's given.",
    { code: ERRORS.INVALID_SIGNAL },
  );

/**
 * Checks the signals a shutdown listens for, and gives each once.
 * @param signals The signals.
 * @returns The signals, without repeats.
 * @throws
 * - INVALID_SIGNAL: The shutdown needs a non-empty list of signals Node.js can listen for, such as SIGINT, other than SIGKILL and SIGSTOP, and an onSignal that's a function when it's given.
 */
const readSignals = (signals: unknown): NodeJS.Signals[] => {
  const unique = Array.isArray(signals) ? [...new Set<unknown>(signals)] : [];
  const isValid =
    unique.length > 0 &&
    unique.every(
      (signal) =>
        typeof signal === 'string' &&
        Object.hasOwn(constants.signals, signal) &&
        !UNHANDLEABLE_SIGNALS.has(signal),
    );
  if (!isValid) {
    throw createInvalidSignalError();
  }
  return unique as NodeJS.Signals[];
};

/**
 * Turns the signals that ask a process to stop, SIGINT and SIGTERM by default, into an
 * AbortSignal, so a script or a service passes one signal to the work it shuts down. The first
 * signal aborts it with PROCESS_INTERRUPTED, sets `process.exitCode` to 128 plus the signal's
 * number, 130 for SIGINT and 143 for SIGTERM, as a shell reports it, and calls `onSignal`. It
 * never calls `process.exit`: the process exits once the work stops. Later signals are ignored,
 * or, with `forceOnRepeat`, stop the process at once, as they would without a listener. On
 * Windows, Ctrl+C sends SIGINT, but SIGTERM is never delivered. With `disconnect`, a child started
 * with an IPC channel, such as by `fork`, also shuts down as with SIGTERM when its parent closes
 * the channel or dies, at once when it's already closed. `dispose` stops listening.
 * @param options The signals, what runs at the first one, and how later ones behave.
 * @returns The shutdown signal.
 * @example
 * import { createShutdownSignal } from 'jg-process';
 *
 * declare const drainQueue: (signal: AbortSignal) => Promise<void>;
 *
 * const shutdown = createShutdownSignal({ forceOnRepeat: true });
 * await drainQueue(shutdown.signal); // stops at Ctrl+C, and the process exits with 130
 * shutdown.dispose();
 * @throws
 * - INVALID_SIGNAL: The shutdown needs a non-empty list of signals Node.js can listen for, such as SIGINT, other than SIGKILL and SIGSTOP, and an onSignal that's a function when it's given.
 */
export const createShutdownSignal = ({
  signals = DEFAULT_SHUTDOWN_SIGNALS,
  onSignal,
  setExitCode = true,
  forceOnRepeat = false,
  disconnect = false,
}: IShutdownSignalOptions = {}): IShutdownSignal => {
  if (onSignal !== undefined && typeof onSignal !== 'function') {
    throw createInvalidSignalError();
  }
  const listenedSignals = readSignals(signals);
  const controller = new AbortController();
  let received: NodeJS.Signals | null = null;
  let isDisposed = false;

  const toExitCode = (signal: NodeJS.Signals): number => 128 + constants.signals[signal];

  // the parent closing the IPC channel shuts down as SIGTERM does
  const onDisconnect = (): void => {
    onProcessSignal('SIGTERM');
  };

  // starts the shutdown at the first signal, and ignores the rest
  const onProcessSignal = (signal: NodeJS.Signals): void => {
    if (received !== null) {
      return;
    }
    received = signal;
    const exitCode = toExitCode(signal);
    if (setExitCode) {
      process.exitCode = exitCode;
    }
    // without a listener, Node.js stops the process at the next signal
    if (forceOnRepeat) {
      dispose();
    }
    controller.abort(
      new Exception(`The process was interrupted by ${signal}.`, {
        code: ERRORS.PROCESS_INTERRUPTED,
        data: { signal, exitCode },
      }),
    );
    try {
      void Promise.resolve(onSignal?.(signal)).catch(() => undefined);
    } catch {
      // onSignal's own failure is ignored, so the shutdown goes on
    }
  };

  const dispose = (): void => {
    if (isDisposed) {
      return;
    }
    isDisposed = true;
    for (const signal of listenedSignals) {
      process.off(signal, onProcessSignal);
    }
    process.off('disconnect', onDisconnect);
  };

  for (const signal of listenedSignals) {
    process.on(signal, onProcessSignal);
  }
  // a process started without an IPC channel has no process.send, so there's nothing to watch
  if (disconnect && process.send !== undefined) {
    if (process.connected) {
      process.on('disconnect', onDisconnect);
    } else {
      onDisconnect();
    }
  }

  return {
    signal: controller.signal,
    receivedSignal: () => received,
    exitCode: () => (received === null ? null : toExitCode(received)),
    dispose,
  };
};
