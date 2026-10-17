import { CODE_WRAPPER, DEFAULT_CODE } from '../shared/constants.js';
import type { IErrorCode, IUnwrappedErrorCode } from '../shared/types.js';

/**
 * Wraps an error code in its delimiters, or the default code when none is given.
 * @param code The error code to wrap.
 * @returns The wrapped code, such as `{(INVALID_INPUT)}`.
 */
export const wrapCode = (code: IErrorCode): string =>
  `${CODE_WRAPPER.prefix}${code ?? DEFAULT_CODE}${CODE_WRAPPER.suffix}`;

/**
 * Checks whether a message ends with a wrapped, non-empty code.
 * @param message The message to check.
 * @returns Whether the message is an encoded error.
 */
const isEncodedMessage = (message: string): boolean => {
  const startsAt = message.lastIndexOf(CODE_WRAPPER.prefix);
  const codeStartsAt = startsAt + CODE_WRAPPER.prefix.length;
  const codeEndsAt = message.length - CODE_WRAPPER.suffix.length;

  return startsAt >= 0 && codeStartsAt < codeEndsAt && message.endsWith(CODE_WRAPPER.suffix);
};

/**
 * Extracts the code wrapped at the end of an encoded message. The code is always returned as a
 * string, even when it looks numeric. Without one, the code is the default and `startsAt` is -1.
 * @param message The message to unwrap.
 * @returns The unwrapped code and the index its wrapper starts at.
 */
export const unwrapCode = (message: string): IUnwrappedErrorCode => {
  if (isEncodedMessage(message)) {
    const startsAt = message.lastIndexOf(CODE_WRAPPER.prefix);
    return {
      code: message.substring(
        startsAt + CODE_WRAPPER.prefix.length,
        message.lastIndexOf(CODE_WRAPPER.suffix),
      ),
      startsAt,
    };
  }
  return { code: DEFAULT_CODE, startsAt: -1 };
};
