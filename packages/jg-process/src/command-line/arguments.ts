import { parseArgs, type ParseArgsOptionsConfig } from 'node:util';
import { Exception, extractMessage } from 'jg-exception';

import { ERRORS } from '../shared/index.js';

import type { IStrictArgOption, IStrictArgValues } from './types.js';

/**
 * Builds the error for arguments that don't fit the options.
 * @param message What's wrong.
 * @param option The option it concerns, or null.
 * @param cause Node.js's error, when it found the problem.
 * @returns The error.
 */
const invalidArguments = (message: string, option: string | null, cause?: unknown): Exception =>
  new Exception(message, { code: ERRORS.INVALID_ARGUMENTS, data: { option }, cause });

/**
 * Reads the option a Node.js parseArgs error names, such as `--name` in `Unknown option '--name'`.
 * @param message The error's message.
 * @returns The option's name without its dashes, or null when it names none.
 */
const readNamedOption = (message: string): string | null => {
  const quoted = /'(-{1,2}[^' ]+)/.exec(message)?.[1];
  return quoted === undefined ? null : quoted.replace(/^-+/, '');
};

/**
 * Runs Node.js's strict parser, with the tokens that show how often each option was given.
 * @param args The arguments.
 * @param config The parser's options.
 * @returns The values and the tokens.
 */
const parseWithTokens = (args: readonly string[], config: ParseArgsOptionsConfig) =>
  parseArgs({
    args: [...args],
    options: config,
    strict: true,
    allowPositionals: false,
    tokens: true,
  });

/**
 * Parses a command's arguments strictly, as `util.parseArgs` does with `strict: true` and no
 * positionals, and also refuses what parseArgs lets through: an option given twice that isn't
 * `multiple`, an empty string value, and a missing `required` option. A missing flag is false, a
 * missing `multiple` option an empty array, and a missing optional string undefined.
 * @param args The arguments, such as `process.argv.slice(2)`.
 * @param options The options, by name.
 * @returns The values, by name.
 * @example
 * import { parseStrictArgs } from 'jg-process';
 *
 * const { check, path, tag } = parseStrictArgs(['--path', 'docs', '--tag', 'a', '--tag', 'b'], {
 *   check: { type: 'boolean' },
 *   path: { type: 'string', required: true },
 *   tag: { type: 'string', multiple: true },
 * }); // check: false, path: 'docs', tag: ['a', 'b']
 * @throws
 * - INVALID_ARGUMENTS: an unknown option, a positional argument, a missing or empty value, a repeated
 * option, or a missing required one, with `data.option` naming it, and Node.js's error as the cause
 * when it found the problem
 */
export const parseStrictArgs = <TOptions extends Record<string, IStrictArgOption>>(
  args: readonly string[],
  options: TOptions,
): IStrictArgValues<TOptions> => {
  const config: ParseArgsOptionsConfig = {};
  for (const [name, option] of Object.entries(options)) {
    config[name] =
      option.type === 'boolean'
        ? { type: 'boolean' }
        : { type: 'string', multiple: option.multiple === true };
  }
  let parsed: ReturnType<typeof parseWithTokens>;
  try {
    parsed = parseWithTokens(args, config);
  } catch (error) {
    throw invalidArguments(extractMessage(error), readNamedOption(extractMessage(error)), error);
  }
  const counts = new Map<string, number>();
  for (const token of parsed.tokens) {
    if (token.kind === 'option') {
      counts.set(token.name, (counts.get(token.name) ?? 0) + 1);
    }
  }
  const values: Record<string, unknown> = {};
  for (const [name, option] of Object.entries(options)) {
    const value: unknown = parsed.values[name];
    if (option.type === 'boolean') {
      values[name] = value === true;
      continue;
    }
    if (option.multiple !== true && (counts.get(name) ?? 0) > 1) {
      throw invalidArguments(`The --${name} option was given more than once.`, name);
    }
    const strings = value === undefined ? [] : Array.isArray(value) ? value : [value];
    if (strings.some((item) => item === '')) {
      throw invalidArguments(`The --${name} option can't be empty.`, name);
    }
    if (option.required === true && strings.length === 0) {
      throw invalidArguments(`The --${name} option is required.`, name);
    }
    values[name] = option.multiple === true ? strings : strings[0];
  }
  return values as IStrictArgValues<TOptions>;
};
