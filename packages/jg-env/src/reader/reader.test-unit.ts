import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';

import { ERRORS, type ISchema } from '../shared/index.js';
import { catchError, expectNoValue } from '../shared/leak.test-utils.js';
import { createEnvironmentReader } from './reader.js';

describe('readString', () => {
  test('reads the current value each time, without caching or trimming it', () => {
    const environment: Record<string, unknown> = { NAME: ' first ' };
    const { readEnum, readString } = createEnvironmentReader(environment);

    expect(readString('NAME')).toBe(' first ');
    environment['NAME'] = 'second';
    expect(readEnum('NAME', ['second'])).toBe('second');
    expectToThrowCode(
      () => readEnum('NAME', ['first']),
      ERRORS.ENV_VARIABLE_INVALID,
      'The environment variable NAME is not one of first.',
    );
  });

  test.each([undefined, '', '   '])('readString(%o) -> ENV_VARIABLE_MISSING', (value) => {
    const { readString } = createEnvironmentReader({ REQUIRED: value });

    expectToThrowCode(
      () => readString('REQUIRED'),
      ERRORS.ENV_VARIABLE_MISSING,
      'The environment variable REQUIRED is not set.',
    );
  });

  test.each([null, 1, true, {}])('readString(%o) -> ENV_VARIABLE_INVALID', (value) => {
    const { readString } = createEnvironmentReader({ REQUIRED: value });

    expectToThrowCode(
      () => readString('REQUIRED'),
      ERRORS.ENV_VARIABLE_INVALID,
      'The environment variable REQUIRED is not a string.',
    );
  });

  test("reads only the source's own entries, never an inherited one", () => {
    const { readOptionalString, readString } = createEnvironmentReader({});

    expect(readOptionalString('toString')).toBeUndefined();
    expectToThrowCode(() => readString('constructor'), ERRORS.ENV_VARIABLE_MISSING);
  });

  test("accepts a source with other values, such as Vite's import.meta.env", () => {
    const { readBoolean, readString } = createEnvironmentReader({
      DEV: true,
      PROD: false,
      BASE_URL: '/',
      VITE_FLAG: 'true',
    });

    expect(readString('BASE_URL')).toBe('/');
    expect(readBoolean('VITE_FLAG')).toBe(true);
    expectToThrowCode(() => readString('DEV'), ERRORS.ENV_VARIABLE_INVALID);
  });
});

describe('readEnum', () => {
  test('returns an allowed value, and names the allowed values when it is not one', () => {
    const { readEnum } = createEnvironmentReader({ NODE_ENV: 'staging' });
    const error = catchError(() => readEnum('NODE_ENV', ['development', 'production']));

    expect(readEnum('NODE_ENV', ['staging', 'production'])).toBe('staging');
    expect(error).toMatchObject({
      code: ERRORS.ENV_VARIABLE_INVALID,
      message: 'The environment variable NODE_ENV is not one of development, production.',
      data: { key: 'NODE_ENV', allowedValues: ['development', 'production'] },
    });
  });
});

describe('readBoolean', () => {
  test.each([
    ['true', true],
    ['false', false],
  ])('readBoolean(%s) -> %s', (value, expected) => {
    expect(createEnvironmentReader({ FLAG: value }).readBoolean('FLAG')).toBe(expected);
  });

  test.each(['TRUE', '1', 'false ', 'yes'])('readBoolean(%s) -> ENV_VARIABLE_INVALID', (value) => {
    expectToThrowCode(
      () => createEnvironmentReader({ FLAG: value }).readBoolean('FLAG'),
      ERRORS.ENV_VARIABLE_INVALID,
      'The environment variable FLAG is not true or false.',
    );
  });
});

describe('readInteger', () => {
  test.each([
    ['0', 0],
    ['-2', -2],
    ['8080', 8080],
    ['9007199254740991', Number.MAX_SAFE_INTEGER],
  ])('readInteger(%s) -> %d', (value, expected) => {
    expect(createEnvironmentReader({ COUNT: value }).readInteger('COUNT')).toBe(expected);
  });

  // '1e3', which Moldea's reader took as 1000, is rejected, with the rest of Number's notations
  test.each([
    '1e3',
    '0x10',
    ' 12',
    '12 ',
    '12.0',
    '1.5',
    '-0',
    '007',
    '+5',
    'Infinity',
    'NaN',
    'count',
    '9007199254740992',
  ])('readInteger(%s) -> ENV_VARIABLE_INVALID', (value) => {
    expectToThrowCode(
      () => createEnvironmentReader({ COUNT: value }).readInteger('COUNT'),
      ERRORS.ENV_VARIABLE_INVALID,
      'The environment variable COUNT is not a safe integer in plain decimal digits.',
    );
  });
});

describe('readJson', () => {
  // a schema for { ports: number[] }, without any validation library
  const PortsSchema: ISchema<{ ports: number[] }> = {
    parse: (value) => {
      const ports = (value as { ports?: unknown }).ports;
      if (!Array.isArray(ports) || !ports.every((port) => typeof port === 'number')) {
        throw new Error('Expected { ports: number[] }.');
      }
      return { ports };
    },
  };

  test('parses the value and returns what its schema returns', () => {
    const { readJson } = createEnvironmentReader({ CONFIG: '{"ports":[1,2]}' });

    expect(readJson('CONFIG', PortsSchema)).toStrictEqual({ ports: [1, 2] });
    expectToThrowCode(() => readJson('MISSING', PortsSchema), ERRORS.ENV_VARIABLE_MISSING);
  });

  test('works with a Zod schema, and reports its failure as ENV_VARIABLE_INVALID', () => {
    const schema = z.object({ origin: z.url() });
    const valid = createEnvironmentReader({ API: '{"origin":"https://api.example.com"}' });
    const invalid = createEnvironmentReader({ API: '{"origin":"not a url"}' });

    expect(valid.readJson('API', schema)).toStrictEqual({ origin: 'https://api.example.com' });
    expectToThrowCode(
      () => invalid.readJson('API', schema),
      ERRORS.ENV_VARIABLE_INVALID,
      "The environment variable API doesn't match its schema.",
    );
  });

  test('reports a value that is not JSON as ENV_VARIABLE_INVALID', () => {
    expectToThrowCode(
      () => createEnvironmentReader({ CONFIG: '{ports:[1]}' }).readJson('CONFIG', PortsSchema),
      ERRORS.ENV_VARIABLE_INVALID,
      'The environment variable CONFIG is not valid JSON.',
    );
  });
});

describe('optional readers', () => {
  test('return undefined when the variable is unset, and read it when it is set', () => {
    const empty = createEnvironmentReader({ BLANK: ' ' });
    const set = createEnvironmentReader({
      NAME: 'Ada',
      FLAG: 'false',
      COUNT: '3',
      CONFIG: '[1]',
    });
    const schema = z.array(z.number());

    expect(empty.readOptionalString('NAME')).toBeUndefined();
    expect(empty.readOptionalString('BLANK')).toBeUndefined();
    expect(empty.readOptionalBoolean('FLAG')).toBeUndefined();
    expect(empty.readOptionalInteger('COUNT')).toBeUndefined();
    expect(empty.readOptionalJson('CONFIG', schema)).toBeUndefined();
    expect(set.readOptionalString('NAME')).toBe('Ada');
    expect(set.readOptionalBoolean('FLAG')).toBe(false);
    expect(set.readOptionalInteger('COUNT')).toBe(3);
    expect(set.readOptionalJson('CONFIG', schema)).toStrictEqual([1]);
  });

  test('still reject a value that is set but invalid', () => {
    const { readOptionalBoolean, readOptionalInteger, readOptionalJson } = createEnvironmentReader({
      FLAG: 'maybe',
      COUNT: '1e3',
      CONFIG: '{',
    });

    expectToThrowCode(() => readOptionalBoolean('FLAG'), ERRORS.ENV_VARIABLE_INVALID);
    expectToThrowCode(() => readOptionalInteger('COUNT'), ERRORS.ENV_VARIABLE_INVALID);
    expectToThrowCode(() => readOptionalJson('CONFIG', z.unknown()), ERRORS.ENV_VARIABLE_INVALID);
  });
});

describe('errors', () => {
  const SECRET = 'Zq9';

  test('name the key in their data and never hold the value, in any form they print', () => {
    const reader = createEnvironmentReader({
      MODE: SECRET,
      FLAG: SECRET,
      COUNT: SECRET,
      NESTED: `{"credentials":{"token":"${SECRET}"}}`,
      BROKEN: `{"token": ${SECRET}}`,
      WEIRD: { token: SECRET },
    });
    // a schema whose error repeats its input, as many validators' messages do
    const EchoingSchema: ISchema<never> = {
      parse: (value) => {
        throw new Error(`Rejected ${JSON.stringify(value)}`);
      },
    };
    const errors = [
      catchError(() => reader.readEnum('MODE', ['a'])),
      catchError(() => reader.readBoolean('FLAG')),
      catchError(() => reader.readInteger('COUNT')),
      catchError(() =>
        reader.readJson('NESTED', z.object({ credentials: z.object({ token: z.email() }) })),
      ),
      catchError(() => reader.readJson('NESTED', EchoingSchema)),
      catchError(() => reader.readJson('BROKEN', z.unknown())),
      catchError(() => reader.readString('WEIRD')),
    ];

    for (const error of errors) {
      expect(error).toMatchObject({ code: ERRORS.ENV_VARIABLE_INVALID });
      expect((error as Error).cause).toBeUndefined();
      expectNoValue(error, SECRET);
    }
  });
});
