import { Exception, extractMessage } from 'jg-exception';

// stable public error codes
export const ERRORS = {
  INVALID_SITE_BUILD_OPTIONS: 'INVALID_SITE_BUILD_OPTIONS',
  SITE_BUILD_INVALID: 'SITE_BUILD_INVALID',
} as const;

/**
 * Reports an invalid verifier configuration before reading the artifact.
 * @param detail The problem in the caller's configuration.
 */
export const invalidSiteOptions = (detail: string): never => {
  throw new Exception(`The site build verification options are invalid.: ${detail}`, {
    code: ERRORS.INVALID_SITE_BUILD_OPTIONS,
  });
};

/**
 * Reports the failed artifact check with safe diagnostic context.
 * @param detail The problem in the inspected build.
 * @param cause The original error, when needed.
 */
export const invalidSiteBuild: (detail: string, cause?: unknown) => never = (detail, cause) => {
  throw new Exception(
    `The static site build failed verification.: ${detail}${cause === undefined ? '' : `: ${extractMessage(cause)}`}`,
    { code: ERRORS.SITE_BUILD_INVALID, cause },
  );
};
