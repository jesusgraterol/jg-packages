// the delimiters around an error code appended to a message, so it can be decoded later
export type IErrorCodeWrapper = {
  prefix: string;
  suffix: string;
};

/*
 * An error code as callers pass it. Numbers are accepted for compatibility and converted to
 * strings, so a decoded code is always a string.
 */
export type IErrorCode = string | number;

// a code unwrapped from an encoded message, and where its wrapper starts (-1 when there is none)
export type IUnwrappedErrorCode = {
  code: string;
  startsAt: number;
};

/*
 * The result of decoding an error. When the message or the code can't be extracted, the defaults
 * take their place: DEFAULT_MESSAGE and DEFAULT_CODE.
 */
export type IDecodedError = {
  message: string;
  code: string;
  data: unknown;
};

/*
 * An object that carries an error code, as provider and application errors often do. Extra fields
 * are allowed, because such errors usually carry metadata too.
 */
export type IErrorCodeCarrier = {
  code: IErrorCode;
} & Record<string, unknown>;
