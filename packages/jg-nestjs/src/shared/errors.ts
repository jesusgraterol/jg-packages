// the codes of every error the package answers with
export const ERRORS = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  HTTP_EXCEPTION: 'HTTP_EXCEPTION',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CORS_ORIGIN_NOT_ALLOWED: 'CORS_ORIGIN_NOT_ALLOWED',
} as const;

/*
 * The message each error answers with. An HTTP_EXCEPTION answers with the HttpException's or the
 * exposed client error's own message instead, and its entry describes it. INTERNAL_ERROR's is all
 * a client sees of an unexpected error.
 */
export const ERROR_MESSAGES: Record<keyof typeof ERRORS, string> = {
  VALIDATION_FAILED: 'The request failed validation.',
  HTTP_EXCEPTION: 'The request failed with an HTTP error.',
  INTERNAL_ERROR: 'The server failed to handle the request.',
  CORS_ORIGIN_NOT_ALLOWED: "The request's origin isn't allowed.",
};
