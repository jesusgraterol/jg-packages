import { version as uuidVersion, validate as uuidValidate } from 'uuid';

import type { IUUIDVersion } from '../shared/types.js';
import {
  FILE_NAME_FORBIDDEN_CHARACTERS,
  MAX_EMAIL_LENGTH,
  MAX_FILE_NAME_BYTES,
  WINDOWS_RESERVED_FILE_NAME,
} from './constants.js';

/**
 * Verifies if a value is a valid string and its length is within a range (optional).
 * @param value The value to be validated.
 * @param minLength? The minimum length of the string. If not provided, it will not check for a minimum length. Defaults to 1.
 * @param maxLength? The maximum length of the string. If not provided, it will not check for a maximum length.
 * @param disallowWhitespaceOnly? A boolean indicating whether strings that contain only whitespace should be considered invalid. Defaults to true.
 * @returns A boolean indicating whether the value is a valid string and meets the length requirements (if provided).
 * @example
 * isStringValid('hello'); // true
 * isStringValid('   '); // false
 * isStringValid('hello', 1, 3); // false
 */
export const isStringValid = (
  value: unknown,
  minLength: number = 1,
  maxLength?: number,
  disallowWhitespaceOnly: boolean = true,
): value is string =>
  typeof value === 'string' &&
  (minLength === undefined || value.length >= minLength) &&
  (maxLength === undefined || value.length <= maxLength) &&
  (!disallowWhitespaceOnly || value.trim().length > 0);

/**
 * Verifies if a value is a valid number and is within a range (optional). The minimum value
 * defaults to Number.MIN_SAFE_INTEGER (-9007199254740991) while the maximum value defaults to
 * Number.MAX_SAFE_INTEGER (9007199254740991).
 * @param value The value to be validated.
 * @param min? The minimum value. If not provided, it will default to Number.MIN_SAFE_INTEGER.
 * @param max? The maximum value. If not provided, it will default to Number.MAX_SAFE_INTEGER.
 * @returns A boolean indicating whether the value is a valid number and within the specified range.
 * @example
 * isNumberValid(12.5); // true
 * isNumberValid(Number.NaN); // false
 * isNumberValid(5, 10); // false
 */
export const isNumberValid = (
  value: unknown,
  min: number = Number.MIN_SAFE_INTEGER,
  max: number = Number.MAX_SAFE_INTEGER,
): value is number => typeof value === 'number' && value >= min && value <= max;

/**
 * Verifies if a value is a valid integer and is within a range (optional). If a range is not
 * provided, it will use the properties Number.MIN_SAFE_INTEGER & Number.MAX_SAFE_INTEGER.
 * @param value The value to be validated.
 * @param min? The minimum value. If not provided, it will default to Number.MIN_SAFE_INTEGER.
 * @param max? The maximum value. If not provided, it will default to Number.MAX_SAFE_INTEGER.
 * @returns A boolean indicating whether the value is a valid integer and within the specified range.
 * @example
 * isIntegerValid(5); // true
 * isIntegerValid(5.5); // false
 * isIntegerValid(5, 1, 3); // false
 */
export const isIntegerValid = (value: unknown, min?: number, max?: number): value is number =>
  isNumberValid(value, min, max) && Number.isInteger(value);

/**
 * Verifies if a value is a valid unix timestamp in milliseconds. The smallest value is set for
 * the beginning of the Unix epoch (January 1st, 1970 - 14400000) while the largest value is based
 * on the numeric limit established by JavaScript (9007199254740991).
 * @param value The value to be validated.
 * @returns A boolean indicating whether the value is a valid unix timestamp in milliseconds.
 * @example
 * isTimestampValid(Date.UTC(2026, 9, 17)); // true
 * isTimestampValid(-1); // false
 */
export const isTimestampValid = (value: unknown): value is number =>
  isIntegerValid(value, 14400000);

/**
 * Verifies if a value is a valid numeric string.
 * @param value The value to be validated.
 * @returns A boolean indicating whether the value is a valid numeric string.
 * @example
 * isNumeric('-12.5'); // true
 * isNumeric('1,000'); // false
 */
export const isNumeric = (value: string): boolean =>
  typeof value === 'string' && /^[-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(value);

/* eslint-disable @typescript-eslint/no-explicit-any -- these guards keep narrowing to Record<string, any> and Array<any>, so callers read values as before */
/**
 * Verifies if a value is an actual object. It also validates if it has keys (optional).
 * @param value The value to be validated.
 * @param allowEmpty? A boolean indicating whether empty objects are allowed. Defaults to false.
 * @returns A boolean indicating whether the value is a valid object and meets the key requirements (if provided).
 * @example
 * isObjectValid({ id: 1 }); // true
 * isObjectValid({}); // false
 * isObjectValid({}, true); // true
 * isObjectValid([]); // false
 */
export const isObjectValid = (value: unknown, allowEmpty?: boolean): value is Record<string, any> =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (allowEmpty || Object.keys(value).length > 0);

/**
 * Verifies if a value is an array. It also validates if it has elements inside (optional).
 * @param value The value to be validated.
 * @param allowEmpty? A boolean indicating whether empty arrays are allowed. Defaults to false.
 * @returns A boolean indicating whether the value is a valid array and meets the element requirements (if provided).
 * @example
 * isArrayValid([1]); // true
 * isArrayValid([]); // false
 * isArrayValid([], true); // true
 */
export const isArrayValid = (value: unknown, allowEmpty?: boolean): value is Array<any> =>
  Array.isArray(value) && (allowEmpty || value.length > 0);
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Verifies if a value is a valid email address with a maximum length of 320 characters.
 * Important: when providing forbiddenExtensions, ensure to include the dot (.) at the beginning.
 * For example, to forbid .con, use ['.con'].
 * @param value The value to be validated.
 * @param forbiddenExtensions? An array of forbidden email extensions. Defaults to ['.con'].
 * @returns A boolean indicating whether the value is a valid email address and does not have a forbidden extension.
 * @example
 * isEmailValid('ada@example.com'); // true
 * isEmailValid('ada@example.con'); // false
 */
export const isEmailValid = (
  value: unknown,
  forbiddenExtensions: string[] = ['.con'],
): value is string => {
  if (!isStringValid(value, 5, MAX_EMAIL_LENGTH)) {
    return false;
  }
  const email = value.toLowerCase();
  return (
    /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
      email,
    ) && !forbiddenExtensions.some((ext) => email.endsWith(ext))
  );
};

/**
 * Verifies that a slug contains lowercase letters or digits separated by single hyphens and meets
 * a length range.
 * @param value The value to be validated.
 * @param minLength? The minimum length of the slug. Defaults to 2.
 * @param maxLength? The maximum length of the slug. Defaults to 16.
 * @returns A boolean indicating whether the value is a valid slug.
 * @example
 * isSlugValid('jg-utilities'); // true
 * isSlugValid('JG Utils'); // false
 */
export const isSlugValid = (
  value: unknown,
  minLength: number = 2,
  maxLength: number = 16,
): value is string =>
  isStringValid(value, minLength, maxLength) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

/**
 * Verifies if a password meets the following requirements:
 * - Meets a length range (Defaults to 8 - 2048)
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 * @param value The value to be validated.
 * @param minLength? The minimum length of the password. Defaults to 8.
 * @param maxLength? The maximum length of the password. Defaults to 2048.
 * @returns A boolean indicating whether the value is a valid password.
 * @example
 * isPasswordValid('Sup3r$ecret'); // true
 * isPasswordValid('password'); // false
 */
export const isPasswordValid = (
  value: unknown,
  minLength: number = 8,
  maxLength: number = 2048,
): value is string =>
  isStringValid(value, minLength, maxLength) &&
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])[A-Za-z\d\W_]+$/.test(value);

/**
 * Verifies if a value has the correct OTP Secret Format.
 * @param value The value to be validated.
 * @returns A boolean indicating whether the value is a valid OTP secret.
 * @example
 * isOTPSecretValid('JBSWY3DPEHPK3PXP'); // true
 */
export const isOTPSecretValid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-zA-Z]{16,64}$/.test(value);

/**
 * Verifies if a value has the correct OTP Token Format.
 * @param value The value to be validated.
 * @returns A boolean indicating whether the value is a valid OTP token.
 * @example
 * isOTPTokenValid('123456'); // true
 * isOTPTokenValid('12345'); // false
 */
export const isOTPTokenValid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9]{6}$/.test(value);

/**
 * Verifies if a value has a correct JWT Format:
 * [Base64-URL Encoded Header].[Base64-URL Encoded Payload].[Signature]
 * @param value The value to be validated.
 * @returns A boolean indicating whether the value is a valid JWT.
 * @example
 * isJWTValid('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl'); // true
 * isJWTValid('not-a-token'); // false
 */
export const isJWTValid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[A-Za-z0-9-_]{2,1000}\.[A-Za-z0-9-_]{2,1000}\.[A-Za-z0-9-_]{2,1000}$/.test(value);

/**
 * Verifies if a value has a valid Authorization Header format based on the RFC6750. Example:
 * Authorization: Bearer eyJhbGciOiJIUzI1NiIXVCJ9TJV...r7E20RMHrHDcEfxjoYZgeFONFh7HgQ
 * More info:
 * - https://stackoverflow.com/questions/33265812/best-http-authorization-header-type-for-jwt
 * - https://www.rfc-editor.org/rfc/rfc6750
 * @param value The value to be validated.
 * @returns A boolean indicating whether the value is a valid Authorization header.
 * @example
 * isAuthorizationHeaderValid('Bearer eyJhbGciOi.payload.signature'); // true
 * isAuthorizationHeaderValid('Basic dXNlcg=='); // false
 */
export const isAuthorizationHeaderValid = (value: unknown): value is string =>
  typeof value === 'string' && /^Bearer [A-Za-z0-9-_.]{1,3000}$/.test(value);

/**
 * Verifies if a value complies with semantic versioning.
 * @param value The value to be validated.
 * @returns A boolean indicating whether the value is a valid semantic version.
 * @example
 * isSemverValid('1.2.0'); // true
 * isSemverValid('1.2'); // false
 */
export const isSemverValid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9]{1,5}\.[0-9]{1,5}\.[0-9]{1,5}$/.test(value);

/**
 * Verifies if a value is a valid URL.
 * @param value The value to be validated.
 * @returns A boolean indicating whether the value is a valid URL.
 * @example
 * isURLValid('https://jg-packages.jesusgraterol.dev'); // true
 * isURLValid('not a url'); // false
 */
export const isURLValid = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false;
  }
  return URL.canParse(value);
};

/**
 * Verifies if a value is a valid UUID and that it matches a specific version.
 * @param value The value to be validated.
 * @param version The UUID version to be validated against.
 * @returns A boolean indicating whether the value is a valid UUID of the specified version.
 * @example
 * isUUIDValid('0199f5e2-8f5a-7b3c-9d2e-4f1a6b8c0d7e', 7); // true
 * isUUIDValid('0199f5e2-8f5a-7b3c-9d2e-4f1a6b8c0d7e', 4); // false
 */
export const isUUIDValid = (value: unknown, version: IUUIDVersion): value is string =>
  typeof value === 'string' && uuidValidate(value) && uuidVersion(value) === version;

/**
 * Verifies if a value is a file name that is valid on Windows, macOS and Linux: one path component
 * whose UTF-8 size is between 1 and maxBytes. It rejects ".", "..", control characters, the
 * characters < > : " / \ | ? *, a trailing space or period, and Windows device names such as
 * "con" or "lpt1.txt", in any letter case.
 * @param value The value to be validated.
 * @param maxBytes? The maximum size of the name in UTF-8 bytes. Defaults to 255.
 * @returns A boolean indicating whether the value is a portable file name.
 * @example
 * isFileNameValid('notes.md'); // true
 * isFileNameValid('con.txt'); // false
 * isFileNameValid('a/b.txt'); // false
 */
export const isFileNameValid = (
  value: unknown,
  maxBytes: number = MAX_FILE_NAME_BYTES,
): value is string => {
  if (typeof value !== 'string') {
    return false;
  }
  const byteLength = new TextEncoder().encode(value).length;
  return (
    byteLength >= 1 &&
    byteLength <= maxBytes &&
    !FILE_NAME_FORBIDDEN_CHARACTERS.test(value) &&
    // a trailing period also rejects "." and ".."
    !/[ .]$/.test(value) &&
    !WINDOWS_RESERVED_FILE_NAME.test(value)
  );
};
