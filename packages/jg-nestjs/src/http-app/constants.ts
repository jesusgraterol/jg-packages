// the signals that close the app by default: Ctrl+C, and a container or process manager stopping it
export const DEFAULT_SHUTDOWN_SIGNALS: readonly string[] = ['SIGINT', 'SIGTERM'];
