import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/errors.js';
import {
  isArrayValid,
  isAuthorizationHeaderValid,
  isEmailValid,
  isObjectValid,
} from '../validations/index.js';

/**
 * Checks if a list can be shuffled.
 * @param input The array to check.
 * @throws
 * - INVALID_OR_EMPTY_ARRAY: If the input is not an array or has less than 2 items.
 */
export const canArrayBeShuffled = (input: unknown[]): void => {
  if (!Array.isArray(input) || input.length <= 1) {
    throw new Exception('For an array to be shuffled it must contain at least 2 items.', {
      code: ERRORS.INVALID_OR_EMPTY_ARRAY,
    });
  }
};

/**
 * Validates the input object and the keys to be picked/omitted.
 * @param input The object to be validated.
 * @param propKeys The keys to be picked/omitted, which must be a non-empty array of strings.
 * @throws
 * - INVALID_OR_EMPTY_OBJECT: If the input is not a valid object or is empty.
 * - INVALID_OR_EMPTY_ARRAY: If the keys are not a valid array or are empty.
 */
export const validateObjectAndKeys = (input: unknown, propKeys: unknown): void => {
  if (!isObjectValid(input)) {
    throw new Exception('The input must be a valid and non-empty object.', {
      code: ERRORS.INVALID_OR_EMPTY_OBJECT,
    });
  }
  if (!isArrayValid(propKeys)) {
    throw new Exception('The keys must be a valid and non-empty array of strings.', {
      code: ERRORS.INVALID_OR_EMPTY_ARRAY,
    });
  }
};

/**
 * Validates the format of an authorization header.
 * @param header The authorization header to validate.
 * @throws
 * - INVALID_AUTHORIZATION_HEADER: If the header does not comply with the expected format.
 */
export const validateAuthorizationHeader = (header: unknown): void => {
  if (!isAuthorizationHeaderValid(header)) {
    // the header isn't repeated, because it can hold a credential, such as a Basic one
    throw new Exception(
      'The provided authorization header does not comply with the expected format (RFC6750).',
      { code: ERRORS.INVALID_AUTHORIZATION_HEADER },
    );
  }
};

/**
 * Validates the format of an email address.
 * @param email The email address to validate.
 * @throws
 * - INVALID_EMAIL_ADDRESS: If the email address is not valid or has a forbidden extension.
 */
export const validateEmailAddress = (email: unknown): void => {
  if (!isEmailValid(email)) {
    // the address isn't repeated, because it's personal data that logs and clients mustn't get
    throw new Exception('The provided email address is not valid or has a forbidden extension.', {
      code: ERRORS.INVALID_EMAIL_ADDRESS,
    });
  }
};
