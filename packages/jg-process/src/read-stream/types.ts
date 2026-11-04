import type { Exception } from 'jg-exception';

// how readStream reads
export type IReadStreamOptions = {
  // the most bytes the stream may hold, a positive safe integer
  maxBytes: number;

  // stops reading and rejects with the signal's reason when it aborts
  signal?: AbortSignal | undefined;
};

/*
 * How a bounded read reports its limit and what it does to the stream when it fails: the error
 * for a limit that isn't a positive safe integer, the error for content past it, and whether the
 * stream is destroyed or only paused for the caller to answer and close.
 */
export type IBoundedReadOptions = IReadStreamOptions & {
  invalidLimit: () => Exception;
  tooLarge: () => Exception;
  isDestroyedOnFailure: boolean;
};
