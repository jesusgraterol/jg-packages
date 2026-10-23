import type { IProcessResult } from 'jg-process';

// the installed gallery's command boundary, separate from the legacy release runner
export type IRunAstroFixtureCommand = (
  executable: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv; signal: AbortSignal; timeoutSeconds: number },
) => Promise<IProcessResult<string>>;

// seconds available to the complete fixture and each stage
export interface IAstroFixtureLimits {
  total: number;
  install: number;
  build: number;
  index: number;
  browser: number;
}

// the owner of the fixture's deadline and shutdown listeners
export interface IAstroFixtureScope {
  signal: AbortSignal;
  /**
   * Runs within the remaining overall deadline, propagating executor failures and cancellation.
   * @throws
   * - The Astro gallery exceeded its overall deadline.
   * - The executor's errors or either cancellation signal's reason.
   */
  run: IRunAstroFixtureCommand;
  isInterrupted: () => boolean;
  interruptionReason: () => unknown;
  dispose: () => void;
}
