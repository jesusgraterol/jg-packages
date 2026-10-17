import type { IJsonValue } from 'jg-exception';

// an error as an envelope carries it to the client
export type IApiError = {
  // the stable code the client handles the error by, or `UNKNOWN_ERROR` when the error had none
  code: string;

  // what failed
  message: string;

  // the context the error carried, or `null` when it carried none
  data: IJsonValue;
};

/*
 * The envelope a service sends in an HTTP body. A response is successful when it has no error, and
 * it carries data either way.
 */
export type IApiResponse<T> = {
  // whether the request succeeded, which is when `error` is null
  success: boolean;

  // the data sent to the client, whatever the outcome
  data: T;

  // the error the request failed with, or null when it succeeded
  error: IApiError | null;
};

/*
 * An envelope error as it arrives from any service. `data` may be missing, and it's `unknown`,
 * because `isResponse` doesn't check it: whoever reads it checks it first.
 */
export type IParsedApiError = {
  code: string;
  message: string;
  data?: unknown;
};

/*
 * An envelope as it arrives after `JSON.parse`: `undefined` fields are gone, and services may send
 * `error: null` on success or leave `error` out.
 */
export type IParsedApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: IParsedApiError | null;
};
