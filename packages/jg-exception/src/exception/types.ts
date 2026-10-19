import type { IJsonValue } from '../shared/types.js';
import type { EXCEPTION_SEVERITIES } from './constants.js';

/*
 * How serious a failure is, for whoever reports it: `expected` for one the app anticipates, such as
 * a resource that doesn't exist, and `critical` for one someone must hear about at once. Leaving it
 * out means an ordinary unexpected failure.
 */
export type IExceptionSeverity = (typeof EXCEPTION_SEVERITIES)[number];

// the options an Exception is created with
export type IExceptionOptions = {
  // the stable code callers handle the error by, such as `USER_NOT_FOUND`
  code: string;

  // context that helps whoever handles or debugs the error, such as the id that wasn't found
  data?: IJsonValue | undefined;

  // the error underneath, kept as the native `cause`
  cause?: unknown;

  // values to replace with `[redacted]`, as written and URL-encoded, such as a token the cause may
  // hold. They're redacted from the message, the data, and every cause, which becomes a copy that
  // keeps its name, code, and plain fields without running the cause's own code. Nothing keeps them
  redact?: readonly string[] | undefined;

  // how serious the failure is, set where an app throws it. Packages never set it, and it's never
  // serialized
  severity?: IExceptionSeverity | undefined;

  // whether the error is worth writing to the logs in full, such as one too large for the error
  // tracker's storage, set where an app throws it. Packages never set it, and it's never serialized
  shouldLog?: boolean | undefined;
};

// an Exception as `toJSON` returns it, ready to log or send
export type IExceptionJson = {
  name: string;
  code: string;
  message: string;
  data: IJsonValue;
};
