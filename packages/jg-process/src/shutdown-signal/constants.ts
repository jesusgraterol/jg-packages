// the signals createShutdownSignal listens for by default: Ctrl+C, and a service manager's stop
export const DEFAULT_SHUTDOWN_SIGNALS: readonly NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

// the signals Node.js can't listen for, because the system never lets a process handle them
export const UNHANDLEABLE_SIGNALS: ReadonlySet<string> = new Set(['SIGKILL', 'SIGSTOP']);
