# jg-exception recipes

Patterns for apps that throw coded errors, report them, keep secrets out of them, and handle them by their code.

## An API exception with an HTTP status and logging flags

Use this in an API whose errors need more than a code: the HTTP status the client gets, and whether the error is worth logging or sending to the error tracker. A subclass keeps those decisions where the error is thrown, the one place that knows whether the client asked for something missing or the server broke. It's still an Exception, so `isException`, `hasErrorCode`, and jg-api-response treat it like any other:

```ts
import { Exception, type IExceptionOptions } from 'jg-exception';

type IUser = { id: number; name: string };

// what an ApiException takes on top of an Exception's options
type IApiExceptionOptions = IExceptionOptions & {
  // the HTTP status the API answers with, 500 when it's left out
  status?: number | undefined;

  // whether the error tracker, such as Sentry, gets the error; by default only for a 5xx status
  shouldCapture?: boolean | undefined;

  // whether the error is written to the logs; by default only for a 5xx status
  shouldLog?: boolean | undefined;
};

// an Exception that says how the API answers it, and who hears about it
export class ApiException extends Exception {
  public readonly status: number;
  public readonly shouldCapture: boolean;
  public readonly shouldLog: boolean;

  constructor(
    message: string,
    {
      status = 500,
      shouldCapture = status >= 500,
      shouldLog = status >= 500,
      ...options
    }: IApiExceptionOptions,
  ) {
    super(message, options);
    this.name = 'ApiException';
    this.status = status;
    this.shouldCapture = shouldCapture;
    this.shouldLog = shouldLog;
  }
}

// finds a user by id, such as with a database query
declare function findUser(userId: number): Promise<IUser | null>;

// checks a webhook's signature against the secret shared with the sender
declare function isSignatureValid(payload: string, signature: string): boolean;

export const getUser = async (userId: number): Promise<IUser> => {
  const user = await findUser(userId);
  if (user === null) {
    // the client asked for a user that doesn't exist: a 404, with nothing to log or capture
    throw new ApiException('The user was not found.', {
      code: 'USER_NOT_FOUND',
      status: 404,
      data: { userId },
    });
  }
  return user;
};

export const verifyWebhook = (payload: string, signature: string): void => {
  if (!isSignatureValid(payload, signature)) {
    // the sender's mistake, so a 401, but logged: a run of them means an attack or a rotated secret
    throw new ApiException('The webhook signature is invalid.', {
      code: 'WEBHOOK_SIGNATURE_INVALID',
      status: 401,
      shouldLog: true,
    });
  }
};
```

The defaults follow the status: a 4xx is the client's to fix, so it's neither logged nor captured, and a 5xx is both. Override them where you know better, as for the webhook. The status and the flags stay on the server: `toJSON()`, which jg-api-response's `buildResponse` reads, gives only the name, code, message, and data. Setting `name` makes `String(error)` read `ApiException [USER_NOT_FOUND]: The user was not found.` in logs.

Read the flags in one place, where every error is reported, such as the API's error handler:

```ts
import { Exception, extractMessage, getErrorCode } from 'jg-exception';

// the ApiException from the block above
declare class ApiException extends Exception {
  readonly status: number;
  readonly shouldCapture: boolean;
  readonly shouldLog: boolean;
}

// writes a line to the app's logs
declare const logger: { error(message: string, details: object): void };

// sends an error to the error tracker, such as Sentry's captureException
declare function captureError(error: unknown): void;

// logs and captures an error as its flags say
export const reportError = (error: unknown): void => {
  // an error that isn't an ApiException wasn't expected, so the logs and the tracker both get it
  const shouldLog = error instanceof ApiException ? error.shouldLog : true;
  const shouldCapture = error instanceof ApiException ? error.shouldCapture : true;
  if (shouldLog) {
    // the message joins the causes, which the logs need and the client never sees
    logger.error(extractMessage(error), { code: getErrorCode(error) });
  }
  if (shouldCapture) {
    captureError(error);
  }
};
```

An error from anywhere else, such as a bug's `TypeError` or another package's Exception, has no flags, so it's logged and captured. When you expect one, wrap it in an ApiException where you call the code that throws it, with the error as its `cause`.

## A client exception for the UI

Use this in a browser app, where most errors are expected, such as a file that's too large or a session that expired, and the user needs to know what to do next. Two things change from an API: the flag says whether the error tracker needs the error, and what users read comes from copy you write for each code, never from the error's message.

Throw an AppException for a failure the app detects itself, and mark the ones the user can fix, so they don't flood the tracker:

```ts
import { Exception, type IExceptionOptions } from 'jg-exception';

// what an AppException takes on top of an Exception's options
type IAppExceptionOptions = IExceptionOptions & {
  // whether the error tracker gets the error; false for a failure the user expects and can fix
  shouldCapture?: boolean | undefined;
};

// an Exception thrown in the browser app, which says whether the error tracker needs it
export class AppException extends Exception {
  public readonly shouldCapture: boolean;

  constructor(message: string, { shouldCapture = true, ...options }: IAppExceptionOptions) {
    super(message, options);
    this.name = 'AppException';
    this.shouldCapture = shouldCapture;
  }
}

// the largest avatar the app uploads, in bytes
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

// checks the image a user picked before it's uploaded
export const checkAvatar = (file: File): void => {
  if (file.size > MAX_AVATAR_BYTES) {
    // the user can pick a smaller image, so there's nothing to track
    throw new AppException('The avatar is larger than 5 MB.', {
      code: 'AVATAR_TOO_LARGE',
      data: { sizeBytes: file.size, maxSizeBytes: MAX_AVATAR_BYTES },
      shouldCapture: false,
    });
  }
};
```

Handle errors where the UI catches them, such as in an event handler or an error boundary. A message is written for whoever debugs the error: it can name an id or an internal step, and it isn't written for users or translated. So show the copy for the error's code, and a fallback for any other:

```ts
import { Exception, getErrorCode } from 'jg-exception';

// the AppException from the block above
declare class AppException extends Exception {
  readonly shouldCapture: boolean;
}

// sends an error to the error tracker, such as Sentry's captureException
declare function captureError(error: unknown): void;

// shows a short message to the user, such as in a toast
declare function showToast(message: string): void;

// the copy users see for each code, written for them rather than for the logs
const MESSAGES_BY_CODE: ReadonlyMap<string, string> = new Map([
  ['AVATAR_TOO_LARGE', 'Choose an image of 5 MB or less.'],
  ['SESSION_EXPIRED', 'Your session expired. Sign in again to continue.'],
  ['USER_NOT_FOUND', 'This account no longer exists.'],
]);

// what users see for an error without copy of its own
const FALLBACK_MESSAGE = 'Something went wrong. Try again in a moment.';

// captures an error when it needs tracking, and tells the user what happened
export const handleUiError = (error: unknown): void => {
  if (!(error instanceof AppException) || error.shouldCapture) {
    captureError(error);
  }
  const code = getErrorCode(error);
  showToast((code === null ? undefined : MESSAGES_BY_CODE.get(code)) ?? FALLBACK_MESSAGE);
};
```

The codes come from anywhere: your AppExceptions, your API's envelope errors, which jg-fetch's FetchException carries as its `code`, and other packages, such as jg-clipboard. A code without copy gets the fallback, so a new code never shows users a developer's message. Any error that isn't an AppException is captured, because the UI can't tell whether it was expected. If your API already reports its own failures, skip the errors your API client returns for them, so the tracker doesn't get each one twice.

## Keeping secrets out of a cause

Use `redact` when you wrap an error that can hold a credential your code passed in, such as a token, a password, or a one-time code. A library's error can echo the request it sent in its message, its stack, or its fields, and whatever logs or tracks the new exception prints the whole chain. Exchanging an OAuth authorization code for tokens is a typical case: the code, the PKCE verifier, and the client secret all go into the request:

```ts
import { Exception } from 'jg-exception';

type ITokens = { accessToken: string; refreshToken: string };

// the OAuth client's secret, from the environment
declare const clientSecret: string;

// exchanges an authorization code for tokens, such as with an OAuth library, whose errors can
// carry the request it sent
declare function requestTokens(request: {
  code: string;
  codeVerifier: string;
  clientSecret: string;
}): Promise<ITokens>;

export const exchangeCode = async (code: string, codeVerifier: string): Promise<ITokens> => {
  try {
    return await requestTokens({ code, codeVerifier, clientSecret });
  } catch (error) {
    // each value the request carried is a credential, wherever the cause holds it
    throw new Exception("Couldn't exchange the authorization code for tokens.", {
      code: 'OAUTH_CODE_EXCHANGE_FAILED',
      cause: error,
      redact: [code, codeVerifier, clientSecret],
    });
  }
};
```

Pass every secret the call was given, not only the one you expect in the error: you can't tell which one a library echoes. Each value is also matched URL-encoded, so a code with a `/` is found where a URL or a form body carries it as `%2F`. A handler that needs to know why the provider refused, such as for a code that expired, reads the cause's `code` or `name`: the cause is now a redacted copy that keeps them, and it isn't `instanceof` the library's error class anymore.

When the error ends where you catch it, because the work goes on without that step, only a log line leaves the `catch`. `extractRedactedMessage` gives that line: the error's message with its causes, with the values redacted. Revoking a refresh token at sign-out is such a step, because the session ends either way:

```ts
import { extractRedactedMessage } from 'jg-exception';

// writes a line to the app's logs
declare const logger: { warn(message: string, details: object): void };

// asks the provider to revoke a token, such as with an OAuth library
declare function revokeToken(token: string): Promise<void>;

// clears the session cookie and the stored tokens
declare function clearSession(): Promise<void>;

export const signOut = async (refreshToken: string): Promise<void> => {
  try {
    await revokeToken(refreshToken);
  } catch (error) {
    // signing out goes on without the revocation, so the error ends here, as a log line. Unlike
    // redact, this matches values only as written, so the URL-encoded form is passed too
    logger.warn("Couldn't revoke the refresh token.", {
      error: extractRedactedMessage(error, [refreshToken, encodeURIComponent(refreshToken)]),
    });
  }
  await clearSession();
};
```

Only the message is redacted, so log that string and nothing else: passing `error` itself to the logger or the error tracker would send its stack and fields as they are. To track the failure, wrap it in an Exception with `redact`, and send that.

## Handling an error by its code

Branch on codes, never on messages: a message can be reworded in any release, and a code is stable. `hasErrorCode` and `getErrorCode` read a string `code` from any error, so the same check works on an Exception, a Node.js system error, and a database driver's error.

Use `hasErrorCode` for the one failure a step expects, and wrap everything else. A settings file that doesn't exist yet is the usual case: Node.js rejects with `ENOENT`, which means the user never saved settings, not that reading failed:

```ts
import { readFile } from 'node:fs/promises';
import { Exception, hasErrorCode } from 'jg-exception';

type ISettings = { theme: 'light' | 'dark'; language: string };

// a Zod schema, or any validator with parse
declare const SettingsSchema: { parse(value: unknown): ISettings };

// the settings of a user who never saved any
const DEFAULT_SETTINGS: ISettings = { theme: 'light', language: 'en' };

export const loadSettings = async (path: string): Promise<ISettings> => {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      return DEFAULT_SETTINGS;
    }
    // any other code, such as EACCES, is a real failure, with the system error as the cause
    throw new Exception("Couldn't read the settings file.", {
      code: 'SETTINGS_READ_FAILED',
      data: { path },
      cause: error,
    });
  }
  return SettingsSchema.parse(JSON.parse(text));
};
```

At a module's boundary, turn a library's code into one of your own, so your callers don't depend on the library. Export your codes as an `as const` map, so callers compare against it. Here PostgreSQL's code for a unique violation, `23505`, becomes `EMAIL_TAKEN`:

```ts
import { Exception, hasErrorCode } from 'jg-exception';

// the codes this module throws, which callers compare against
export const ERRORS = {
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  USER_CREATE_FAILED: 'USER_CREATE_FAILED',
} as const;

// PostgreSQL's code for a unique violation, which drivers such as pg set as the error's code
const UNIQUE_VIOLATION = '23505';

// inserts the user's row, such as with pg's pool.query; email is the table's only unique column
declare function insertUser(email: string): Promise<{ id: number }>;

export const createUser = async (email: string): Promise<{ id: number }> => {
  try {
    return await insertUser(email);
  } catch (error) {
    if (hasErrorCode(error, UNIQUE_VIOLATION)) {
      throw new Exception('The email is already registered.', {
        code: ERRORS.EMAIL_TAKEN,
        cause: error,
      });
    }
    throw new Exception("Couldn't create the user.", {
      code: ERRORS.USER_CREATE_FAILED,
      cause: error,
    });
  }
};

// a sign-up form shows a taken email next to its field, and rethrows anything else
export const signUp = async (email: string): Promise<{ emailProblem: string } | null> => {
  try {
    await createUser(email);
    return null;
  } catch (error) {
    if (hasErrorCode(error, ERRORS.EMAIL_TAKEN)) {
      return { emailProblem: 'This email is already registered.' };
    }
    throw error;
  }
};
```

Your codes are part of the module's contract: renaming one breaks every caller that compares against it.

When one place chooses between several outcomes, `switch` on `getErrorCode`, which returns `null` for an error without a code, and use `hasErrorCodePrefix` for a family of codes that share a prefix. Here a queue worker decides what to do with an email job that failed:

```ts
import { getErrorCode, hasErrorCodePrefix } from 'jg-exception';

// what the worker does with a job that failed
type IJobOutcome = 'retry' | 'drop' | 'fail';

// chooses a failed job's outcome by the error's code, from the app, a library, or Node.js
export const chooseOutcome = (error: unknown): IJobOutcome => {
  // every RECIPIENT_ code, such as RECIPIENT_UNSUBSCRIBED, means the address won't take the
  // email, so a retry can't help
  if (hasErrorCodePrefix(error, 'RECIPIENT_')) {
    return 'drop';
  }
  switch (getErrorCode(error)) {
    // Node.js network errors and the provider's rate limit pass, so the next attempt may succeed
    case 'ECONNRESET':
    case 'ETIMEDOUT':
    case 'RATE_LIMITED':
      return 'retry';
    // anything else needs a person, so the job fails and the error is reported
    default:
      return 'fail';
  }
};
```

`getErrorCode` and the other checks read the error's own code, not its causes'. So when you wrap an error, give the wrapper the code its callers branch on, as `createUser` does above, instead of leaving that code on the cause.
