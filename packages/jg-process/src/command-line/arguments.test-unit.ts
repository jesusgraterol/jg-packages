// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';

import { parseStrictArgs } from './arguments.js';

// the options a command declares
const OPTIONS = {
  check: { type: 'boolean' },
  path: { type: 'string', required: true },
  tag: { type: 'string', multiple: true },
  label: { type: 'string' },
} as const;

/**
 * Parses arguments that should fail, and returns the error.
 * @param args The arguments.
 * @returns The error.
 */
const parseFailure = (args: string[]): unknown => {
  try {
    parseStrictArgs(args, OPTIONS);
  } catch (error) {
    return error;
  }
  throw new Error('The arguments were accepted.');
};

describe('parseStrictArgs', () => {
  test('returns each option, with false, an empty array, or undefined when it is missing', () => {
    expect(parseStrictArgs(['--path', 'docs'], OPTIONS)).toStrictEqual({
      check: false,
      path: 'docs',
      tag: [],
      label: undefined,
    });
  });

  test('reads flags, repeated options, and the --name=value form', () => {
    expect(
      parseStrictArgs(
        ['--check', '--path=src', '--tag', 'a', '--tag', 'b', '--label', 'x'],
        OPTIONS,
      ),
    ).toStrictEqual({ check: true, path: 'src', tag: ['a', 'b'], label: 'x' });
  });

  test.each([
    ['an option given twice', ['--path', 'a', '--path', 'b'], 'path', 'more than once'],
    ['a flag given twice', ['--path', 'a', '--check', '--check'], 'check', 'more than once'],
    ['an empty value', ['--path', ''], 'path', "can't be empty"],
    ['an empty repeated value', ['--path', 'a', '--tag', ''], 'tag', "can't be empty"],
    ['a missing required option', ['--check'], 'path', 'is required'],
  ])('throws INVALID_ARGUMENTS for %s, naming the option', (_, args, option, message) => {
    const error = parseFailure(args);

    expect(error).toMatchObject({ code: ERRORS.INVALID_ARGUMENTS, data: { option } });
    expect((error as Error).message).toContain(message);
    expect((error as Error).cause).toBeUndefined();
  });

  test.each([
    ['an unknown option', ['--path', 'a', '--force'], 'force'],
    ['a missing value', ['--path'], 'path'],
    ['a positional argument', ['--path', 'a', 'extra'], null],
  ])("throws INVALID_ARGUMENTS for %s, with Node.js's error as the cause", (_, args, option) => {
    const error = parseFailure(args);

    expect(error).toMatchObject({ code: ERRORS.INVALID_ARGUMENTS, data: { option } });
    expect((error as Error).cause).toBeInstanceOf(TypeError);
  });

  test('passes on the arguments it was given, without the program and script', () => {
    const args = ['--path', 'a'];

    parseStrictArgs(args, OPTIONS);

    expect(args).toStrictEqual(['--path', 'a']);
  });
});
