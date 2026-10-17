import { decodeError, encodeError } from '../error-handler/index.js';
import type { IErrorCode } from '../shared/types.js';
import { EXCEPTION_BRAND } from './constants.js';
import type { IErrorOptions, IExceptionRecord } from './types.js';

/**
 * An `Error` with a string code and optional data, created from an error of any shape. A message
 * with an encoded code, such as `Not found{(NOT_FOUND)}`, is decoded into its message and code.
 * @example
 * throw new Exception('The user was not found.', 'USER_NOT_FOUND');
 * @example
 * try {
 *   await loadUser();
 * } catch (error) {
 *   throw new Exception(`Couldn't load the user: ${extractMessage(error)}`, 'USER_LOAD_FAILED', undefined, { cause: error });
 * }
 */
export class Exception extends Error {
  // the stable code callers use to handle the error, always a string
  public readonly code: string;

  // optional context attached to the exception
  public readonly data: unknown;

  /**
   * Creates an exception from an error or message of any shape.
   * @param error The message, or the error to normalize.
   * @param code The code, which overrides any code decoded from the error.
   * @param data The data, which overrides any `data` decoded from the error.
   * @param options The native error options, such as `cause`.
   */
  constructor(error: unknown, code?: IErrorCode, data?: unknown, options?: IErrorOptions) {
    const decodedError = decodeError(error);

    super(decodedError.message, options);

    this.name = 'Exception';
    this.code = code === undefined || code === null ? decodedError.code : String(code);
    this.data = data === undefined ? decodedError.data : data;
    Object.defineProperty(this, EXCEPTION_BRAND, { value: true });
  }

  /**
   * Encodes the exception as its message followed by its wrapped code.
   * @returns The encoded message, such as `Not found{(NOT_FOUND)}`.
   */
  public override toString(): string {
    return encodeError(this.message, this.code);
  }

  /**
   * Converts the exception to its encoded message in string contexts, such as template literals.
   * @param hint The type hint for the conversion.
   * @returns The encoded message for string and default hints, otherwise `null`.
   */
  public [Symbol.toPrimitive](hint: string): string | null {
    if (hint === 'string' || hint === 'default') {
      return this.toString();
    }

    return null;
  }

  /**
   * Converts the exception to a plain record.
   * @returns The message, code, and data, with `null` for missing data.
   */
  public toRecord(): IExceptionRecord {
    return {
      message: this.message,
      code: this.code,
      data: this.data ?? null,
    };
  }
}
