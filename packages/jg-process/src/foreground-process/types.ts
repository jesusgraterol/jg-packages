import type { IProcessResult, IStartProcessOptions } from '../shared/index.js';

// the working directory and environment of a foreground command
export type IForegroundProcessOptions = Pick<IStartProcessOptions, 'cwd' | 'env'>;

// the exit code or signal reported by the foreground command
export type IForegroundProcessResult = Pick<IProcessResult, 'exitCode' | 'signalCode'>;
