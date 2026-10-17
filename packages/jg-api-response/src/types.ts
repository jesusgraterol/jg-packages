/*
 * The envelope a service sends in an HTTP body. A response is successful when it has no error, and
 * it carries data either way.
 */
export interface IAPIResponse<T> {
  // whether the request succeeded, which is when `error` is undefined
  success: boolean;

  // the data sent to the client, whatever the outcome
  data: T;

  // the message of the error the request failed with, if any
  error: string | undefined;
}

/*
 * An envelope as it arrives after `JSON.parse`: `undefined` fields are gone, and some services send
 * `error: null` on success.
 */
export type IParsedAPIResponse<T> = {
  success: boolean;
  data?: T;
  error?: string | null;
};
