import type { IJsonValue } from '../shared/types.js';

// the options an Exception is created with
export type IExceptionOptions = {
  // the stable code callers handle the error by, such as `USER_NOT_FOUND`
  code: string;

  // context that helps whoever handles or debugs the error, such as the id that wasn't found
  data?: IJsonValue | undefined;

  // the error underneath, kept as the native `cause`
  cause?: unknown;
};

// an Exception as `toJSON` returns it, ready to log or send
export type IExceptionJson = {
  name: string;
  code: string;
  message: string;
  data: IJsonValue;
};
