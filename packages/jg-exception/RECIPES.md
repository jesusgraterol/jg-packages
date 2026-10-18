# jg-exception recipes

Patterns for apps that throw coded errors, report them, show them to users, keep secrets out of them, and handle them by their code.

## Severity and logging flags for an error reporter

Use this in an app that reports its errors, such as to its logs and an error tracker, when the place that throws an error knows better than the reporter how serious it is. `severity` says it: `'expected'` for a failure the app anticipates, such as a user that doesn't exist, and `'critical'` for one someone must hear about at once, such as a charge without a matching record. `shouldLog: true` asks for the error to be written to the logs in full, such as one whose details are too large for the error tracker's storage. Leaving both out means an ordinary unexpected failure:

```ts
import { Exception } from 'jg-exception';

type IUser = { id: number; name: string };

// finds a user by id, such as with a database query
declare function findUser(userId: number): Promise<IUser | null>;

// compares what a payment provider charged for an invoice with what the ledger recorded
declare function compareLedger(invoiceId: number): Promise<{ charged: bigint; recorded: bigint }>;

export const getUser = async (userId: number): Promise<IUser> => {
  const user = await findUser(userId);
  if (user === null) {
    // the caller asked for a user that doesn't exist, which the app expects to happen
    throw new Exception('The user was not found.', {
      code: 'USER_NOT_FOUND',
      data: { userId },
      severity: 'expected',
    });
  }
  return user;
};

export const checkInvoice = async (invoiceId: number): Promise<void> => {
  const { charged, recorded } = await compareLedger(invoiceId);
  if (charged !== recorded) {
    // money moved without a matching record: someone must look at it now, with the full details
    throw new Exception("The ledger doesn't match the charge.", {
      code: 'LEDGER_MISMATCH',
      data: { invoiceId, charged: String(charged), recorded: String(recorded) },
      severity: 'critical',
      shouldLog: true,
    });
  }
};
```

Neither flag is serialized: `toJSON()`, which jg-api-response's `buildResponse` reads, gives only the name, code, message, and data, so clients never see them. They also survive `redact`, so a wrapped cause keeps its own. For an HTTP status, jg-nestjs's `ApiException` is an Exception that adds one.

Read the flags in one place, where every error is reported, such as the app's error handler:

```ts
import { extractMessage, getErrorCode, isException } from 'jg-exception';

// writes a line to the app's logs
declare const logger: { error(message: string, details: object): void };

// sends an error to the error tracker, such as Sentry's captureException
declare function captureError(error: unknown): void;

// pages whoever is on call
declare function notifyOnCall(error: unknown): void;

// logs, captures, and escalates an error as its throw site asked
export const reportError = (error: unknown): void => {
  // an error that isn't an Exception, such as a bug's TypeError, has no flags
  const severity = isException(error) ? error.severity : undefined;
  if (severity === 'expected') {
    return;
  }
  if (!isException(error) || error.shouldLog === true || severity === 'critical') {
    // the message joins the causes, which the logs need and the client never sees
    logger.error(extractMessage(error), { code: getErrorCode(error) });
  }
  captureError(error);
  if (severity === 'critical') {
    notifyOnCall(error);
  }
};
```

An error that isn't an Exception wasn't expected, so it's logged and captured. An Exception from another package has neither flag, because packages never set them: it's an ordinary failure, captured but not logged in full. When you expect one, wrap it in an Exception with `severity: 'expected'` where you call the code that throws it, with the error as its `cause`.

## Feedback for the UI

Use this in a browser app, where most errors are expected, such as a file that's too large or a session that expired, and the user needs to know what to do next. What users read comes from copy you write for each code, never from the error's message, which is written for whoever debugs it: it can name an id or an internal step, and it isn't translated. `createErrorFeedback` holds that copy, configured once:

```ts
import { createErrorFeedback, Exception } from 'jg-exception';

// the copy users read for each code, and the codes that send them back to sign in
export const getErrorFeedback = createErrorFeedback({
  fallbackMessage: 'Something went wrong. Try again in a moment.',
  messagesByCode: {
    AVATAR_TOO_LARGE: 'Choose an image of 5 MB or less.',
    SESSION_EXPIRED: 'Your session expired. Sign in again to continue.',
    USER_NOT_FOUND: 'This account no longer exists.',
  },
  accessDeniedCodes: ['SESSION_EXPIRED'],
});

// the largest avatar the app uploads, in bytes
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

// checks the image a user picked before it's uploaded
export const checkAvatar = (file: File): void => {
  if (file.size > MAX_AVATAR_BYTES) {
    // the user can pick a smaller image, so the error tracker doesn't need it
    throw new Exception('The avatar is larger than 5 MB.', {
      code: 'AVATAR_TOO_LARGE',
      data: { sizeBytes: file.size, maxSizeBytes: MAX_AVATAR_BYTES },
      severity: 'expected',
    });
  }
};
```

Handle errors where the UI catches them, such as in an event handler or an error boundary:

```ts
import { type createErrorFeedback, isException } from 'jg-exception';

// the function from the block above
declare const getErrorFeedback: ReturnType<typeof createErrorFeedback>;

// sends an error to the error tracker, such as Sentry's captureException
declare function captureError(error: unknown): void;

// shows a short message to the user, such as in a toast
declare function showToast(message: string): void;

// sends the user to the sign-in page
declare function redirectToSignIn(): void;

// tells the user what happened, and captures the errors the app didn't expect
export const showError = (error: unknown, fallbackMessage?: string): void => {
  const feedback = getErrorFeedback(error, { fallbackMessage });
  // a cancelled request, such as when the user left the page, needs no message
  if (feedback.isCancelled) {
    return;
  }
  if (!isException(error) || error.severity !== 'expected') {
    captureError(error);
  }
  if (feedback.isAccessDenied) {
    redirectToSignIn();
    return;
  }
  showToast(feedback.message);
};
```

A screen passes a fallback of its own, such as `showError(error, "Couldn't upload the avatar.")`, and keeps the copy for every code. The codes come from anywhere: your Exceptions, your API's envelope errors, which jg-fetch's FetchException carries as its `code`, and other packages, such as jg-clipboard. A code without copy gets the fallback, so a new code never shows users a developer's message, and `feedback.code` is `null` for it unless `publicCodePattern` marks it safe to show, such as for a support request. If your API already reports its own failures, skip the errors your API client returns for them, so the tracker doesn't get each one twice.

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

## Redacting a request in an error report

Use `redactFields` when an error report carries the request that failed, such as its body, so the error tracker shows what the client sent. The body is the client's, so you don't know its secrets' values, as `redact` needs, but you know the fields that hold them: a password, a token, or personal data such as an email address. The copy replaces their values wherever they are, in nested objects and arrays too, and matches the names whatever their case:

```ts
import { redactFields } from 'jg-exception';

// the fields that hold credentials or personal data in the API's requests
const SENSITIVE_FIELDS = ['email', 'googleIdToken', 'password', 'token'];

// sends an error to the error tracker with what to show beside it, such as Sentry's
// captureException
declare function captureError(error: unknown, context: { extra: Record<string, unknown> }): void;

export const reportRequestError = (
  error: unknown,
  request: { method: string; path: string; body: unknown },
): void => {
  captureError(error, {
    extra: {
      request: `${request.method} ${request.path}`,
      body: redactFields(request.body, SENSITIVE_FIELDS),
    },
  });
};
```

Only the fields you name are redacted, so add one whenever a request gains a sensitive field. A class instance in the body, such as a `Date`, is kept as it is rather than walked, and the request's own body is never changed, so the handler that runs after the report still sees what the client sent.

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
