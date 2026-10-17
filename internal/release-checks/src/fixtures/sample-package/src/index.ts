// the greeting used when no name is given
export const DEFAULT_NAME = 'world';

/**
 * Builds a greeting.
 * @param name Who to greet.
 * @returns The greeting.
 * @example
 * import { greet } from 'jg-release-checks-sample';
 *
 * greet('Ada'); // => 'Hello, Ada!'
 */
export const greet = (name: string = DEFAULT_NAME): string => `Hello, ${name}!`;
