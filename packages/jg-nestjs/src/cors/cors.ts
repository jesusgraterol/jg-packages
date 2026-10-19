import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';

import { ApiException } from '../api-exception/index.js';
import { ERROR_MESSAGES, ERRORS } from '../shared/index.js';
import { CORS_METHODS, CORS_PREFLIGHT_STATUS } from './constants.js';
import type { ICorsOptionsInput } from './types.js';
import { buildAllowedOrigins } from './utilities.js';

/**
 * Creates the CORS options for `app.enableCors`, allowing only the listed origins, matched
 * exactly, and by default their `www.` variants and requests without an Origin header. Any other
 * origin is refused with a 403 ApiException, code CORS_ORIGIN_NOT_ALLOWED, which ApiExceptionFilter
 * answers and doesn't report. An origin that isn't a URL throws when the options are created.
 * @param input The allowed origins, and whether to allow requests without an origin, `www.`
 * variants, and credentials.
 * @returns The options.
 * @example
 * import type { INestApplication } from '@nestjs/common';
 * import { createCorsOptions } from 'jg-nestjs';
 *
 * declare const app: INestApplication;
 *
 * app.enableCors(createCorsOptions({ origins: ['https://app.example.com'] }));
 */
export const createCorsOptions = ({
  origins,
  allowOriginless = true,
  includeWwwVariants = true,
  credentials = false,
}: ICorsOptionsInput): CorsOptions => {
  const allowedOrigins = buildAllowedOrigins(origins, includeWwwVariants);
  return {
    origin: (requestOrigin, callback) => {
      if (requestOrigin === undefined ? allowOriginless : allowedOrigins.has(requestOrigin)) {
        callback(null, true);
        return;
      }
      callback(
        new ApiException(ERROR_MESSAGES.CORS_ORIGIN_NOT_ALLOWED, {
          code: ERRORS.CORS_ORIGIN_NOT_ALLOWED,
          status: 403,
        }),
      );
    },
    methods: CORS_METHODS,
    credentials,
    preflightContinue: false,
    optionsSuccessStatus: CORS_PREFLIGHT_STATUS,
  };
};
