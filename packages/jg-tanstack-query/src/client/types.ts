// what createQueryClient takes
export type IQueryClientOptions = {
  // how long unused query data stays in memory, which must be at least how long it stays
  // persisted. Defaults to DEFAULT_QUERY_MAX_AGE_SECONDS
  maxAgeSeconds?: number;
};
