// the wait before the first retry when GitHub doesn't say how long, doubled for each later one
export const FALLBACK_RETRY_MS = 60_000;

// a Retry-After date, in the strict IMF-fixdate form, such as 'Wed, 21 Oct 2026 07:28:00 GMT'
export const IMF_FIXDATE_PATTERN =
  /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/;
