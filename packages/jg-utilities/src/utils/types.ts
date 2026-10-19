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

// what createTaskRunner takes
export type ITaskRunnerOptions = {
  // receives what a task started with trigger rejects with, and the task's key; anything it throws
  // is ignored
  onError: (error: unknown, context: { key: string | undefined }) => void;
};

// how ITaskRunner's run starts a task
export type IRunTaskOptions = {
  // names the task, so only one with this key runs at a time
  key?: string | undefined;

  // what a run does while a task with the same key runs: reject with TASK_RUNNER_BUSY, the default,
  // or resolve to that task's result
  ifBusy?: 'reject' | 'join' | undefined;

  // aborts this task's signal, along with the runner's
  signal?: AbortSignal | undefined;
};

// what ITaskRunner's close does to the tasks still running
export type ICloseTaskRunnerOptions = {
  // whether to abort the runner's signal, which every task's signal follows. Defaults to false
  abort?: boolean | undefined;

  // the abort's reason. Defaults to a TASK_RUNNER_CLOSED Exception
  reason?: unknown;
};

// runs background tasks, such as timer ticks, and lets a shutdown wait for them to finish
export type ITaskRunner = {
  // starts a task now and resolves or rejects as it does, or rejects with TASK_RUNNER_CLOSED once
  // the runner is closing, or with TASK_RUNNER_BUSY while a task with the same key runs
  run: <T>(task: (signal: AbortSignal) => Promise<T>, options?: IRunTaskOptions) => Promise<T>;

  // starts a task, such as a timer's tick, unless the runner is closing or a task with the same key
  // runs, resolving to false at once then, and to true once the task settles. Its error goes to
  // onError
  trigger: (
    task: (signal: AbortSignal) => Promise<unknown>,
    options?: { key?: string | undefined },
  ) => Promise<boolean>;

  // the runner's signal, aborted by close({ abort: true })
  readonly signal: AbortSignal;

  // whether close was called
  isClosing: () => boolean;

  // whether no task runs, or no task with the key when one is given
  isIdle: (key?: string) => boolean;

  // stops new tasks at once, optionally aborts the running ones, and resolves once they all
  // settle, never rejecting
  close: (options?: ICloseTaskRunnerOptions) => Promise<void>;
};

// what createDeadline takes: a timeout, a time, or both, the earlier winning, and a caller's signal
export type IDeadlineOptions = {
  // the seconds from now the deadline is, finite and at least 0
  timeoutSeconds?: number | undefined;

  // the deadline as a Date, epoch milliseconds, or Infinity for none
  deadlineAt?: Date | number | undefined;

  // a caller's signal, which stops the work too, such as a request's
  signal?: AbortSignal | undefined;
};

// why work under a deadline stopped: the caller's signal aborted, or the deadline passed
export type IDeadlineStopReason = 'cancelled' | 'deadline';

// a point in time work must stop by, with a signal that aborts then
export type IDeadline = {
  // the deadline in epoch milliseconds, or Infinity
  readonly deadlineAt: number;

  // aborts with a TimeoutError DOMException at the deadline, or with the caller's reason
  readonly signal: AbortSignal;

  // the milliseconds left, 0 once the deadline passed, or Infinity
  remainingMs: () => number;

  // whether the deadline passed, true from its exact millisecond, by the clock
  isExpired: () => boolean;

  // why the work should stop, the caller's signal checked first, or null while it may go on
  stopReason: () => IDeadlineStopReason | null;

  // throws the caller's abort reason, or DEADLINE_EXCEEDED once the deadline passed by the clock
  throwIfStopped: () => void;

  // a deadline for part of the work, at most timeoutSeconds from now and never past this one, which
  // the caller's signal stops too
  child: (options: { timeoutSeconds: number }) => IDeadline;

  // stops the deadline's timer, such as once the work finished early
  dispose: () => void;
};

// how downloadBlob saves a file
export type IDownloadBlobOptions = {
  // the seconds the file's object URL stays valid after the click. Defaults to 40
  revokeDelaySeconds?: number | undefined;
};

// how downloadJson formats a file
export type IDownloadJsonOptions = {
  // the spaces each level is indented by. Defaults to 2
  space?: number | undefined;
};
