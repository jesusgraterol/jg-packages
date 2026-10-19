// a response's headers: a Headers object, or a record with lowercase names, as Node.js's
// IncomingHttpHeaders has
export type IGithubResponseHeaders =
  Headers | Readonly<Record<string, string | readonly string[] | undefined>>;

// what getGithubRateLimitDeadline takes
export type IGithubRateLimitDeadlineOptions = {
  // the response's HTTP status
  status: number;

  // the response's headers
  headers: IGithubResponseHeaders;

  // the retries already made for this request, from 0, which doubles the fallback wait
  retryCount: number;

  // whether the response's message says a rate limit was hit, which makes a bare 403 count.
  // Defaults to false
  hasRateLimitMessage?: boolean | undefined;

  // the current time. Defaults to now
  now?: Date | undefined;
};
