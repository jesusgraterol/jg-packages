// the parts of a query the polling options read, so they spread into useQuery and fit its query
export type IPolledQuery<TData> = {
  state: { status: 'pending' | 'error' | 'success'; data: TData | undefined };
};

// what createPollingQueryOptions takes
export type IPollingOptions<TData> = {
  // the seconds between fetches, positive and finite, or a function of the latest data that gives
  // them, or false to stop polling, such as once a job finished
  intervalSeconds: number | ((data: TData) => number | false);

  // whether to poll at all, such as only while a panel is open. Defaults to true
  isEnabled?: boolean | undefined;
};

// the query options that poll, to spread into useQuery's options
export type IPollingQueryOptions<TData> = {
  refetchInterval: (query: IPolledQuery<TData>) => number | false;
  refetchIntervalInBackground: false;
  refetchOnWindowFocus: (query: IPolledQuery<TData>) => boolean;
  refetchOnReconnect: (query: IPolledQuery<TData>) => boolean;
};
