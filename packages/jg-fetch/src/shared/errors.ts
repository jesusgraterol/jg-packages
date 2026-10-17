// the codes for every error request reports, which FetchException's kind holds
export const ERRORS = {
  INVALID_URL: 'INVALID_URL',
  INVALID_OPTIONS: 'INVALID_OPTIONS',
  INVALID_HEADERS: 'INVALID_HEADERS',
  INVALID_BODY: 'INVALID_BODY',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  ABORTED: 'ABORTED',
  HTTP_ERROR: 'HTTP_ERROR',
  API_ERROR: 'API_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
  ENVELOPE_INVALID: 'ENVELOPE_INVALID',
  RESPONSE_INVALID: 'RESPONSE_INVALID',
  RESPONSE_TOO_LARGE: 'RESPONSE_TOO_LARGE',
} as const;

// the kind of a failed request, one of the ERRORS codes
export type IFetchErrorKind = keyof typeof ERRORS;

// the message each kind of failure starts with. Messages never include URLs or bodies
export const ERROR_MESSAGES: Record<IFetchErrorKind, string> = {
  INVALID_URL: 'The request URL is invalid or outside the base origin.',
  INVALID_OPTIONS: 'The request options are invalid.',
  INVALID_HEADERS: 'The request headers could not be built.',
  INVALID_BODY: 'The request body could not be serialized.',
  NETWORK_ERROR: 'The server could not be reached.',
  TIMEOUT: 'The request timed out.',
  ABORTED: 'The request was aborted.',
  HTTP_ERROR: 'The server returned an unsuccessful status.',
  API_ERROR: 'The API reported an error.',
  PARSE_ERROR: 'The response body could not be parsed.',
  ENVELOPE_INVALID: 'The response is not a valid API envelope.',
  RESPONSE_INVALID: 'The response data failed schema validation.',
  RESPONSE_TOO_LARGE: 'The response exceeded maxResponseBytes.',
};
