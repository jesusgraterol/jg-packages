import { validateAuthorizationHeader, validateEmailAddress } from './validations.js';

/**
 * Validates the format of an authorization header and extracts the token from it.
 * @param header The authorization header to validate and extract the token from.
 * @returns The extracted token from the authorization header.
 * @example
 * import { extractTokenFromAuthorizationHeader } from 'jg-utilities';
 *
 * extractTokenFromAuthorizationHeader('Bearer eyJhbGciOi.payload.signature'); // => 'eyJhbGciOi.payload.signature'
 * @throws
 * - INVALID_AUTHORIZATION_HEADER: If the header does not comply with the expected format.
 */
export const extractTokenFromAuthorizationHeader = (header: string): string => {
  validateAuthorizationHeader(header);
  return header.split(' ')[1] ?? '';
};

/**
 * Validates the format of an email address and extracts the username from it.
 * @param email The email address to validate and extract the username from.
 * @returns The extracted username from the email address.
 * @example
 * import { extractEmailUsername } from 'jg-utilities';
 *
 * extractEmailUsername('Ada.Lovelace@example.com'); // => 'ada.lovelace'
 * @throws
 * - INVALID_EMAIL_ADDRESS: If the email address is not valid or has a forbidden extension.
 */
export const extractEmailUsername = (email: string): string => {
  validateEmailAddress(email);
  return (email.split('@')[0] ?? '').toLowerCase();
};

/**
 * Extracts a string of initials from the provided value.
 * @param value The string value from which to extract initials.
 * @param initialsCount? The maximum number of initials to extract. Defaults to 1.
 * @returns A string with up to the requested number of letter-only initials, or "A" if none exist.
 * @example
 * import { getInitials } from 'jg-utilities';
 *
 * getInitials('Ada Lovelace'); // => 'A'
 * getInitials('Ada Lovelace', 2); // => 'AL'
 */
export const getInitials = (value: string, initialsCount: number = 1): string => {
  const segmentLetters = (value.match(/[\p{L}\p{N}]+/gu) ?? [])
    .map((segment) => Array.from(segment.match(/\p{L}/gu) ?? []))
    .filter((letters) => letters.length > 0);

  if (!segmentLetters.length) {
    return 'A';
  }

  const initials = segmentLetters.map(([firstLetter = '']) => firstLetter.toUpperCase());
  const remainingLetters = segmentLetters.flatMap((letters) =>
    letters.slice(1).map((letter) => letter.toUpperCase()),
  );

  return initials.concat(remainingLetters).slice(0, initialsCount).join('');
};
