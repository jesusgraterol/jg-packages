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
