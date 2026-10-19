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
