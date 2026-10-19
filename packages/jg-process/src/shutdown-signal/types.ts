// what createShutdownSignal takes
export type IShutdownSignalOptions = {
  // the signals that start the shutdown. Defaults to SIGINT and SIGTERM
  signals?: readonly NodeJS.Signals[] | undefined;

  // runs once, with the first signal, after the abort; what it throws or rejects with is ignored
  onSignal?: ((signal: NodeJS.Signals) => unknown) | undefined;

  // whether the first signal sets process.exitCode to 128 plus its number, as a shell reports a
  // process the signal stopped. Defaults to true
  setExitCode?: boolean | undefined;

  // whether a second signal stops the process at once, as Node.js does without a listener, for a
  // shutdown that hangs. Defaults to false, which ignores later signals
  forceOnRepeat?: boolean | undefined;
};

// a signal that aborts when the process is asked to stop
export type IShutdownSignal = {
  // aborts with PROCESS_INTERRUPTED at the first signal
  readonly signal: AbortSignal;

  // the first signal received, or null
  receivedSignal: () => NodeJS.Signals | null;

  // 128 plus the first signal's number, such as 130 for SIGINT, or null before one
  exitCode: () => number | null;

  // stops listening, so a later signal gets Node.js's default; calling it again does nothing
  dispose: () => void;
};
