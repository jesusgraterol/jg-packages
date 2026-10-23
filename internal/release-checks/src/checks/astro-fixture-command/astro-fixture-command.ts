import { createShutdownSignal, runProcess } from 'jg-process';

import { ASTRO_FIXTURE_LIMITS, ASTRO_FIXTURE_MAX_OUTPUT_BYTES } from './constants.ts';
import type { IAstroFixtureLimits, IAstroFixtureScope, IRunAstroFixtureCommand } from './types.ts';

// Node.js clamps timers beyond its signed 32-bit millisecond limit
const MAX_TIMER_SECONDS = Math.floor(2_147_483_647 / 1000);

/**
 * Runs one installed-gallery command with bounded output and owned process-tree teardown.
 * @param executable The executable, without a shell.
 * @param args Its arguments.
 * @param options The consumer root, cancellation signal, environment, and stage deadline.
 * @returns A promise that resolves to the actual exit, signal, and captured output.
 * @throws
 * - INVALID_PROCESS_OPTIONS: The timeout must be a positive number of at most 2,147,483 seconds, and the output limit a positive safe integer.
 * - PROCESS_START_FAILED: Unable to start the command
 * - PROCESS_TIMED_OUT: The process didn't finish within the timeout
 * - PROCESS_OUTPUT_TOO_LARGE: The process wrote more output than allowed
 * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped
 * - The signal's reason when the signal aborts.
 */
export const runAstroFixtureCommand: IRunAstroFixtureCommand = (executable, args, options) =>
  runProcess({
    command: executable,
    args,
    ...options,
    maxOutputBytes: ASTRO_FIXTURE_MAX_OUTPUT_BYTES,
  });

/**
 * Owns one overall deadline and requested shutdown across every gallery stage. Each command is
 * checked before and after execution, so an executor that returns after cancellation cannot
 * allow another stage to begin. Disposal removes the owned timer and signal listeners.
 * @param executor The command boundary, injected by fixture tests.
 * @param limits The fixture's policy, shortened only by tests.
 * @param callerSignal Additional caller cancellation, when testing lifecycle boundaries.
 * @returns The signal, bounded executor, interruption state, and disposer.
 * @throws
 * - Astro fixture limits must be finite positive seconds within Node.js timer bounds.
 */
export const createAstroFixtureScope = (
  executor: IRunAstroFixtureCommand = runAstroFixtureCommand,
  limits: IAstroFixtureLimits = ASTRO_FIXTURE_LIMITS,
  callerSignal?: AbortSignal,
): IAstroFixtureScope => {
  if (
    Object.values(limits).some(
      (seconds) => !Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_TIMER_SECONDS,
    )
  ) {
    throw new Error(
      'Astro fixture limits must be finite positive seconds within Node.js timer bounds.',
    );
  }
  const shutdown = createShutdownSignal({ setExitCode: false });
  const deadline = new AbortController();
  const expiresAt = performance.now() + limits.total * 1000;
  const expire = (): void =>
    deadline.abort(new Error('The Astro gallery exceeded its overall deadline.'));
  const timer = setTimeout(expire, limits.total * 1000);
  timer.unref();
  const signal = AbortSignal.any([
    shutdown.signal,
    deadline.signal,
    ...(callerSignal === undefined ? [] : [callerSignal]),
  ]);
  return {
    signal,
    run: async (command, args, options) => {
      const combined = AbortSignal.any([signal, options.signal]);
      combined.throwIfAborted();
      const remaining = (expiresAt - performance.now()) / 1000;
      if (remaining <= 0) {
        expire();
        signal.throwIfAborted();
      }
      const result = await executor(command, args, {
        ...options,
        signal: combined,
        timeoutSeconds: Math.min(options.timeoutSeconds, remaining),
      });
      combined.throwIfAborted();
      return result;
    },
    isInterrupted: () => shutdown.signal.aborted,
    interruptionReason: () => shutdown.signal.reason as unknown,
    dispose: () => {
      clearTimeout(timer);
      shutdown.dispose();
    },
  };
};
