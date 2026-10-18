# jg-api-response recipes

Patterns for APIs that answer every error with a status and an envelope, and for code that reads another service's envelope.

## One error handler for every route

Use one function to turn whatever a route throws into an HTTP status and an envelope, and call it from your framework's error hook, such as Express's error middleware or Hono's `app.onError`, so every route answers errors the same way. It's a plain function, so it fits any framework: the hook sends the body it returns, with its status.

```ts
import { buildResponse, type IApiResponse } from 'jg-api-response';
import { Exception, isException, UNKNOWN_ERROR_CODE } from 'jg-exception';
import { ERRORS as UTILITIES_ERRORS } from 'jg-utilities';

// the app's exception with an HTTP status, such as the ApiException in jg-exception's recipes
declare class ApiException extends Exception {
  readonly status: number;
}

// writes an error to the logs and sends it to the error tracker, such as Sentry
declare function reportError(error: unknown): void;

// the status for each code thrown without one, such as by a jg package; any other code is a 500
const STATUS_BY_CODE: ReadonlyMap<string, number> = new Map([
  ['INVALID_REQUEST', 400],
  [UTILITIES_ERRORS.INVALID_CURSOR, 400],
]);

// what the client reads for a server error, whose own message can name a path, a host, or a query
const INTERNAL_ERROR_MESSAGE = 'Something went wrong on our side. Try again in a moment.';

// a status, and the envelope sent with it
type IErrorResponse = { status: number; body: IApiResponse<null> };

// reads the status an error is answered with
const readStatus = (error: unknown): number => {
  if (error instanceof ApiException) {
    return error.status;
  }
  return isException(error) ? (STATUS_BY_CODE.get(error.code) ?? 500) : 500;
};

// turns anything a route throws into the status and the envelope the client gets
export const handleError = (error: unknown): IErrorResponse => {
  const status = readStatus(error);
  if (status < 500) {
    // a client error's message and data say what to fix
    return { status, body: buildResponse(null, error) };
  }
  reportError(error);
  // the client keeps the code to branch on, or gets UNKNOWN_ERROR for an error that isn't an
  // Exception, such as a bug or a database driver's error, whose own code is an internal
  const code = isException(error) ? error.code : UNKNOWN_ERROR_CODE;
  return { status, body: buildResponse(null, new Exception(INTERNAL_ERROR_MESSAGE, { code })) };
};
```

- **The status comes from your own class, or from the code.** Don't read a `status` field from any error: jg-fetch's FetchException has one too, the status another service answered you with, and a 404 from a service you call is your server's failure, not the client's. For the same reason, wrap what a service you call throws in a code of your own where you call it, so its codes never reach the table.
- **An error that isn't an Exception is a 500 with `UNKNOWN_ERROR`.** A schema's error is one, so wrap it where you parse, as the route below does, and the client gets a 400 it can act on.
- **The cause never reaches the client.** `buildResponse` sends an Exception's code, message, and data, so a 4xx's cause stays in your logs. A 5xx's message and data stay there too, because the handler sends its code with a fixed message.

A route is then a plain function that returns the envelope for a success and throws for anything else:

```ts
import { buildResponse, type IApiResponse } from 'jg-api-response';
import { Exception, extractMessage } from 'jg-exception';

type IUser = { id: number; name: string };
type IUserChanges = { name: string };

// a Zod schema, or any validator with parse
declare const UserChangesSchema: { parse(value: unknown): IUserChanges };

// saves the changes to a user, and throws an ApiException with a 404 when there's no such user
declare function updateUser(userId: number, changes: IUserChanges): Promise<IUser>;

// the framework passes the request in and sends the envelope with a 200, and its error hook passes
// anything thrown to handleError
export const updateUserRoute = async (
  userId: number,
  body: unknown,
): Promise<IApiResponse<IUser>> => {
  let changes: IUserChanges;
  try {
    changes = UserChangesSchema.parse(body);
  } catch (error) {
    // the schema's error has no code the handler knows, so it's wrapped in one answered with a 400,
    // and its first issue goes in the data, so the client can tell which field failed
    throw new Exception('The request body is invalid.', {
      code: 'INVALID_REQUEST',
      data: { issue: extractMessage(error) },
      cause: error,
    });
  }
  return buildResponse(await updateUser(userId, changes));
};
```

## Reading another service's envelope

Use `isResponse` where an envelope reaches you without jg-fetch, such as in a body from `fetch` or another HTTP client, a WebSocket message, or a queue job's result; jg-fetch's `request` makes these checks itself, with `parseAs: 'envelope'` and a `schema`. `isResponse` checks the envelope's shape, so you can read `success` and `error`, but not its data, which your schema checks:

```ts
import { isResponse } from 'jg-api-response';
import { Exception } from 'jg-exception';

type IInvoice = { id: string; totalCents: number };

// the codes this module throws
export const ERRORS = {
  INVOICE_NOT_FOUND: 'INVOICE_NOT_FOUND',
  BILLING_REQUEST_FAILED: 'BILLING_REQUEST_FAILED',
  BILLING_RESPONSE_INVALID: 'BILLING_RESPONSE_INVALID',
} as const;

// the billing service's origin
declare const billingUrl: string;

// a Zod schema, or any validator with parse
declare const InvoiceSchema: { parse(value: unknown): IInvoice };

// reads an invoice from the billing service, which answers with an envelope
export const getInvoice = async (invoiceId: string): Promise<IInvoice> => {
  const response = await fetch(`${billingUrl}/invoices/${encodeURIComponent(invoiceId)}`);
  // a proxy's error page isn't JSON, so it's treated like any other body that isn't an envelope
  const body: unknown = await response.json().catch(() => null);
  if (!isResponse(body)) {
    throw new Exception("The billing service's response isn't an envelope.", {
      code: ERRORS.BILLING_RESPONSE_INVALID,
      data: { status: response.status },
    });
  }
  if (body.error || !body.success) {
    // the service's codes are its own: the one callers handle becomes this module's, and the rest
    // share one code, so the service's INVALID_REQUEST never reads as your client's
    throw new Exception("The billing service couldn't return the invoice.", {
      code:
        body.error?.code === 'INVOICE_NOT_FOUND'
          ? ERRORS.INVOICE_NOT_FOUND
          : ERRORS.BILLING_REQUEST_FAILED,
      data: { invoiceId, status: response.status },
      cause: body.error,
    });
  }
  return InvoiceSchema.parse(body.data);
};
```

Leave out the type argument: `isResponse<IInvoice>(body)` would type `body.data` as `IInvoice | undefined` without looking at it, so the schema checks the data instead. A body with an `error` failed, whatever its `success` says, and so did one with `success: false` and no `error`, which `isResponse` also accepts. The service's error is the cause, so `extractMessage` and your logs show its message after yours. Its `data` is `unknown`, because `isResponse` doesn't check it: check it before you copy anything from it into your own data.
