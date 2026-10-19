// the flags of a query, infinite or not, that the loading and load-more helpers read
export type IQueryExecutionState = {
  isError: boolean;
  isLoading?: boolean | undefined;
  isPending?: boolean | undefined;
  hasNextPage?: boolean | undefined;
  isFetchingNextPage?: boolean | undefined;
};

// the flags that decide whether a query's cached data is fit for the first display after mount
export type IQueryInitialResolutionState = {
  isError: boolean;
  isFetchedAfterMount: boolean;
  isStale: boolean;
};
