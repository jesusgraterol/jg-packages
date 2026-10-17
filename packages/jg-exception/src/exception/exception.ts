import { UNKNOWN_ERROR_CODE } from '../shared/constants.js';
import type { IJSONValue } from '../shared/types.js';
import { EXCEPTION_BRAND } from './constants.js';
import type { IExceptionJSON, IExceptionOptions } from './types.js';

/**
 * Makes data safe to serialize by passing it through JSON. A type can't rule out an object that
 * refers back to itself, or a value cast from `any`, so whatever JSON can't hold becomes `null`.
 * @param data The exception's data.
 * @returns The data as JSON would carry it, or `null` when there's none or it can't be serialized.
 */
const toSerializableData = (data: IJSONValue | undefined): IJSONValue => {
  try {
    const serialized = JSON.stringify(data);
    return serialized === undefined ? null : (JSON.parse(serialized) as IJSONValue);
  } catch {
    return null;
  }
};

/**
 * An `Error` with a stable string code and optional JSON data, the error every jg package throws.
 * @example
 * import { Exception } from 'jg-exception';
 *
 * const exception = new Exception('The user was not found.', {
 *   code: 'USER_NOT_FOUND',
 *   data: { id: 1 },
 * });
 * exception.code; // => 'USER_NOT_FOUND'
 * exception.data; // => { id: 1 }
 * @example
 * import { Exception } from 'jg-exception';
 *
 * // the message says what failed at this step, and the cause keeps the error underneath
 * const readSettings = (text: string): unknown => {
 *   try {
 *     return JSON.parse(text);
 *   } catch (error) {
 *     throw new Exception("Couldn't read the settings.", { code: 'SETTINGS_INVALID', cause: error });
 *   }
 * };
 * readSettings('{"theme":"dark"}'); // => { theme: 'dark' }
 */
export class Exception extends Error {
  // the stable code callers handle the error by
  public readonly code: string;

  // context that helps whoever handles or debugs the error
  public readonly data: IJSONValue | undefined;

  /**
   * Creates an exception.
   * @param message What failed, for people reading logs.
   * @param options The code, and optionally the data and the error underneath as `cause`.
   */
  constructor(message: string, options: IExceptionOptions) {
    // callers that skip type checking may leave the options out, and creating an error mustn't throw
    const { code, data, cause } = (options as IExceptionOptions | undefined) ?? { code: '' };
    super(message, cause === undefined ? undefined : { cause });

    this.name = 'Exception';
    this.code = typeof code === 'string' && code.length > 0 ? code : UNKNOWN_ERROR_CODE;
    this.data = data;
    Object.defineProperty(this, EXCEPTION_BRAND, { value: true });
  }

  /**
   * Converts the exception to a plain object, which `JSON.stringify` calls.
   * @returns The name, code, message, and data, with `null` for data that is missing or can't be
   * serialized.
   * @example
   * import { Exception } from 'jg-exception';
   *
   * const json = new Exception('Not found', { code: 'NOT_FOUND', data: { id: 1 } }).toJSON();
   * json; // => { name: 'Exception', code: 'NOT_FOUND', message: 'Not found', data: { id: 1 } }
   */
  public toJSON(): IExceptionJSON {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      data: toSerializableData(this.data),
    };
  }

  /**
   * Describes the exception in one line, with its code.
   * @returns The name, code, and message, such as `Exception [NOT_FOUND]: Not found`.
   */
  public override toString(): string {
    return `${this.name} [${this.code}]: ${this.message}`;
  }
}
