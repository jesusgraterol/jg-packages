import type { IPostgres } from '../postgres/index.js';
import type { ITimeoutProfile } from '../timeouts/index.js';

// a read that may not run: its value once known, and a promise of it; null when it was skipped,
// ran out of time, or failed
export type IOptionalRead<T> = {
  // the value, or null until the read finishes, and when it gives none
  getSnapshot: () => T | null;

  // resolves to the value, or null; it never rejects
  completion: Promise<T | null>;
};

// how createOptionalReader admits and bounds reads
export type IOptionalReaderOptions = {
  // the database the reads run on
  postgres: IPostgres;

  // the most reads running at once. Defaults to 2
  maxActiveReads?: number | undefined;

  // the clients a read leaves free for essential work: it's skipped unless the pool can give
  // more than this many. Defaults to 2
  reservedIdleClients?: number | undefined;

  // the seconds a read may take, waiting for a client included, before it gives null. Defaults
  // to 1
  admissionSeconds?: number | undefined;

  // each read's timeouts. Defaults to a 0.5-second statement timeout, a 0.1-second lock timeout,
  // and a 0.75-second client timeout
  timeouts?: ITimeoutProfile | undefined;
};

// runs optional reads, such as a counter in a page's header, that never delay or crowd out
// essential work
export type IOptionalReader = {
  // starts a read of the query's first row, or joins the one running for the same key
  read: <T>(
    key: string,
    query: { text: string; values?: unknown[] | undefined },
    parse: (row: unknown) => T,
  ) => IOptionalRead<T>;
};
