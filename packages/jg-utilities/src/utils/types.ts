import type { ISchema } from '../shared/types.js';

// the sort direction that can be applied to a list
export type ISortDirection = 'asc' | 'desc';

// the options that can be used to filter items by a query
export type IFilterByQueryOptions<T> = {
  // the property to filter by, if not provided, the whole item will be used
  queryProp?: keyof T;

  // the maximum number of items to return
  limit?: number;
};

// the options that can be passed to the delay function
export type IDelayOptions = {
  // aborts the wait and rejects with the signal's reason
  signal?: AbortSignal | undefined;
};

// the options that can be passed to the retryAsyncFunction function
export type IRetryAsyncFunctionOptions = {
  // stops retrying and rejects with the signal's reason, even while an attempt is pending
  signal?: AbortSignal;

  // decides whether a failed attempt is retried; returning false rethrows the error immediately
  shouldRetry?: (error: unknown) => boolean;
};

// the options that can be passed to the waitUntil function
export type IWaitUntilOptions = {
  // the maximum number of seconds the whole call can take
  timeoutSeconds: number;

  // the number of seconds to wait between probes. Defaults to 1
  intervalSeconds?: number;

  // stops waiting and rejects with the signal's reason, even while a probe is pending
  signal?: AbortSignal;
};

// an inclusive range of UTC calendar dates, each as `YYYY-MM-DD`
export type IUtcDateRange = {
  fromDate: string;
  toDate: string;
};

// what an event bus calls with each error a handler throws or rejects with
export type IEventBusOptions<TEvents extends Record<string, unknown>> = {
  // receives the error and the event the handler was handling; anything it throws is swallowed
  onError: (
    error: unknown,
    context: { name: keyof TEvents; event: TEvents[keyof TEvents] },
  ) => void;
};

// an in-process event bus, whose events and their payloads are the keys and values of TEvents
export type IEventBus<TEvents extends Record<string, unknown>> = {
  // delivers the event to its handlers later, and returns at once
  emit: <TName extends keyof TEvents>(name: TName, event: TEvents[TName]) => void;

  // registers a handler for an event, and returns the function that unsubscribes it
  subscribe: <TName extends keyof TEvents>(
    name: TName,
    handler: (event: TEvents[TName]) => unknown,
  ) => () => void;

  // drops the pending deliveries and every handler, and ignores later emits and subscriptions
  close: () => void;
};

// the limits of createRequestCoordinator
export type IRequestCoordinatorOptions = {
  // how many tasks run at once, at least 1
  maxConcurrent: number;

  // how many tasks can wait for a slot, across every caller, at least 0
  maxQueued: number;
};

// the options of one task a request coordinator runs
export type IRunRequestOptions = {
  // removes the task from the queue and rejects with the signal's reason when it aborts first
  signal?: AbortSignal;

  // who the task runs for, compared with ===, so maxQueuedForCaller can limit each caller
  caller?: unknown;

  // how many of this caller's tasks can wait at once, at least 0
  maxQueuedForCaller?: number;

  // rejects with REQUEST_COOLDOWN_ACTIVE during a cooldown, instead of waiting it out
  rejectDuringCooldown?: boolean;
};

// runs tasks within a concurrency limit and a bounded queue, and pauses them during a cooldown
export type IRequestCoordinator = {
  // runs the task once a slot is free and no cooldown is active, and settles as it does
  run: <T>(task: () => Promise<T>, options?: IRunRequestOptions) => Promise<T>;

  // pauses queued tasks until the deadline, a Date or epoch milliseconds, keeping a later one
  deferUntil: (deadline: Date | number) => void;

  // whether no task runs or waits and no cooldown is active, such as before discarding it
  isIdle: () => boolean;

  // rejects the waiting tasks and every later run, and lets the running ones finish
  close: () => void;
};

// the options of createCursorCodec
export type ICursorCodecOptions<TPayload, TScope> = {
  // validates the payload when it's encoded and when a cursor is decoded
  schema: ISchema<TPayload>;

  // the longest cursor, in characters, that's encoded or decoded. Defaults to 2048
  maxLength?: number;

  /*
   * Whether a decoded payload belongs to the list being read. Without it, every key of the scope
   * must equal the payload's, with null and undefined counting as the same value.
   */
  matchesScope?: (payload: TPayload, scope: TScope) => boolean;
};

// encodes a list's continuation as a cursor, and decodes one only for the list it came from
export type ICursorCodec<TPayload, TScope> = {
  encode: (payload: TPayload) => string;
  decode: (cursor: string | null | undefined, scope: TScope) => TPayload | undefined;
};
