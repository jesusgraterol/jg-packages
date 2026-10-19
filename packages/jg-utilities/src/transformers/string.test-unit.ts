// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/errors.js';
import { expectToThrowCode } from 'jg-exception/testing';

import {
  applySubstitutions,
  capitalizeFirst,
  escapeHtml,
  maskMiddle,
  normalizeQuery,
  pluralize,
  stringifyValue,
  toSlug,
  toTitleCase,
  truncateText,
  truncateToUtf8Bytes,
} from './string.js';

// ASCII and C1 control characters that search normalization replaces with word separators
const CONTROL_CHARACTERS = String.fromCharCode(0, 31, 127, 159);

describe('capitalizeFirst', () => {
  test.each([
    ['', ''],
    ['hello world', 'Hello world'],
    ['this should work', 'This should work'],
    ['hello World', 'Hello World'],
  ])('capitalizeFirst(%s) -> %s', (a, expected) => {
    expect(capitalizeFirst(a)).toBe(expected);
  });
});

describe('toTitleCase', () => {
  test.each([
    ['', ''],
    ['hello world', 'Hello World'],
    ['This should work', 'This Should Work'],
    ['jesus graterol', 'Jesus Graterol'],
    ['JESUS GRATEROL', 'Jesus Graterol'],
  ])('toTitleCase(%s) -> %s', (a, expected) => {
    expect(toTitleCase(a)).toBe(expected);
  });
});

describe('toSlug', () => {
  test.each([
    ['hello world', 'hello-world'],
    ['hello - world', 'hello-world'],
    ['Hello World', 'hello-world'],
    ['HELLO WORLD', 'hello-world'],
    ['---Hello World', 'hello-world'],
    ['Hello World---', 'hello-world'],
    ['@@@Hello World!!!', 'hello-world'],
    ['Hello 🌎 World 🚀', 'hello-world'],
    ['This Should work!!@', 'this-should-work'],
    ['Cómo crear un blog en 2026', 'como-crear-un-blog-en-2026'],
    ['  Node.js & TypeScript: Best Practices!  ', 'node-js-typescript-best-practices'],
    ['¡Hola Mundo!', 'hola-mundo'],
    ['¿Cómo estás?', 'como-estas'],
    ['À la carte', 'a-la-carte'],
    ['Æther & Œuvre', 'ther-uvre'],
    ['Lina’s article', 'linas-article'],
    ['already---valid---slug', 'already-valid-slug'],
    ['hello_world_test', 'hello-world-test'],
    ['blog\\posts\\typescript', 'blog-posts-typescript'],
  ])('toSlug(%s) -> %s', (a, expected) => {
    expect(toSlug(a)).toBe(expected);
  });

  test.each(['', '!!!@@@###', '--__--', '@-@'])('toSlug(%s) -> throws', (a) => {
    expectToThrowCode(
      () => toSlug(a),
      ERRORS.UNABLE_TO_SLUGIFY_STRING,
      `Failed to slugify the string '${a}': the resulting slug is empty.`,
    );
  });
});

describe('truncateText', () => {
  test.each([
    ['This is a message', 18, 'This is a message'],
    ['This is a message', 17, 'This is a message'],
    ['This is a message', 16, 'This is a mes...'],
    ['This is a message', 15, 'This is a me...'],
    ['This is a message', 14, 'This is a m...'],
  ])('truncateText(%s, %i) -> %s', (text, maxLength, expected) => {
    expect(truncateText(text, maxLength)).toBe(expected);
  });
});

describe('maskMiddle', () => {
  test.each([
    ['0102', 4, undefined, '0102'],
    ['12345678', 4, undefined, '12345678'],
    ['010201023', 4, undefined, '0102...1023'],
    ['01021234567890123456', 4, undefined, '0102...3456'],
    ['01021234567890123456', 6, '********', '010212********123456'],
    ['bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 4, undefined, 'bc1q...0wlh'],
    ['bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 6, '********', 'bc1qxy********hx0wlh'],
  ])('maskMiddle(%s, %i, %s) -> %s', (text, visibleChars, mask, expected) => {
    expect(maskMiddle(text, visibleChars, mask)).toBe(expected);
  });
});

describe('normalizeQuery', () => {
  test.each([
    ['spacing and casing', '  Information     Sections  ', 'information sections'],
    ['line and tab separators', 'First\nSecond\tThird', 'first second third'],
    ['Unicode compatibility characters', 'Ｆｕｌｌｗｉｄｔｈ　Ｓｅａｒｃｈ', 'fullwidth search'],
    ['zero-width characters', 'quick\u200Bsearch\u200Cresult\uFEFF', 'quicksearchresult'],
  ])('normalizeQuery(%s) -> normalized query', (_, query, expectedQuery) => {
    expect(normalizeQuery(query)).toBe(expectedQuery);
  });

  test('replaces control characters with spaces before collapsing whitespace', () => {
    expect(normalizeQuery(`alpha${CONTROL_CHARACTERS}omega`)).toBe('alpha omega');
  });

  test('returns an empty string when only removable characters are provided', () => {
    expect(normalizeQuery(`  \u200B${CONTROL_CHARACTERS}\uFEFF  `)).toBe('');
  });

  test('limits the normalized query to the configured max length', () => {
    const maxLength = 10;
    const query = 'A'.repeat(maxLength + 1);

    expect(normalizeQuery(query, maxLength)).toBe('a'.repeat(maxLength));
  });
});

describe('stringifyValue', () => {
  test('returns string inputs unchanged', () => {
    expect(stringifyValue('hello world')).toBe('hello world');
    expect(stringifyValue('{"already":"stringified"}')).toBe('{"already":"stringified"}');
  });

  test.each(<Array<[unknown, string]>>[
    [undefined, 'undefined'],
    [null, 'null'],
    [true, 'true'],
    [false, 'false'],
    [0, '0'],
    [123.45, '123.45'],
    [NaN, 'NaN'],
    [10n, '10'],
    [Symbol('token'), 'Symbol(token)'],
  ])('stringifyValue(%o) -> %s', (value, expected) => {
    expect(stringifyValue(value)).toBe(expected);
  });

  test.each(<Array<[unknown, string]>>[
    [{ name: 'Jane', count: 2 }, '{"name":"Jane","count":2}'],
    [['ready', 3, false], '["ready",3,false]'],
    [{}, '{}'],
    [[], '[]'],
  ])('stringifyValue(%o) -> JSON string', (value, expected) => {
    expect(stringifyValue(value)).toBe(expected);
  });

  test('applies JSON indentation when stringifying objects and arrays', () => {
    expect(stringifyValue({ name: 'Jane', roles: ['admin', 'editor'] }, 2)).toBe(
      '{\n  "name": "Jane",\n  "roles": [\n    "admin",\n    "editor"\n  ]\n}',
    );
  });

  test('falls back to String when JSON stringification fails', () => {
    const circularValue: Record<string, unknown> = { name: 'Circular' };

    circularValue['self'] = circularValue;

    expect(stringifyValue(circularValue)).toBe('[object Object]');
  });
});

describe('applySubstitutions', () => {
  test('replaces placeholders with corresponding values', () => {
    expect(
      applySubstitutions('Hello, {{name}}! You have {{count}} new messages.', {
        name: 'John',
        count: 5,
      }),
    ).toBe('Hello, John! You have 5 new messages.');
  });

  test('leaves placeholders unchanged if no corresponding value is found', () => {
    expect(
      applySubstitutions('Hello, {{name}}! You have {{count}} new messages.', {
        name: 'John',
      }),
    ).toBe('Hello, John! You have {{count}} new messages.');
  });

  test('the keys in the substitutions object are case-sensitive', () => {
    expect(
      applySubstitutions('Hello, {{name}}! You have {{count}} new messages.', {
        Name: 'John',
        COUNT: 5,
      }),
    ).toBe('Hello, {{name}}! You have {{count}} new messages.');
  });

  test('handles empty input string', () => {
    expect(applySubstitutions('', { name: 'John' })).toBe('');
  });

  test('handles input string with no placeholders', () => {
    expect(applySubstitutions('Hello, world!', { name: 'John' })).toBe('Hello, world!');
  });

  test('handles empty substitutions object', () => {
    expect(applySubstitutions('Hello, {{name}}! You have {{count}} new messages.')).toBe(
      'Hello, {{name}}! You have {{count}} new messages.',
    );
  });

  test('leaves empty and whitespace-only placeholders unchanged', () => {
    expect(
      applySubstitutions('Empty: {{}}. Space: {{ }}. Valid: {{name}}.', {
        '': 'empty',
        ' ': 'space',
        name: 'Jane',
      }),
    ).toBe('Empty: {{}}. Space: {{ }}. Valid: Jane.');
  });

  test('handles placeholders with no corresponding keys in substitutions object', () => {
    expect(
      applySubstitutions('Hello, {{name}}! You have {{count}} new messages.', {
        age: 30,
        city: 'New York',
      }),
    ).toBe('Hello, {{name}}! You have {{count}} new messages.');
  });

  test('handles multiple occurrences of the same placeholder', () => {
    expect(applySubstitutions('Hello, {{name}}! Your name is {{name}}.', { name: 'John' })).toBe(
      'Hello, John! Your name is John.',
    );
  });

  test('handles placeholders with special characters in keys', () => {
    expect(
      applySubstitutions('Hello, {{user-name}}! Your email is {{user.email}}.', {
        'user-name': 'John',
        'user.email': 'john@example.com',
      }),
    ).toBe('Hello, John! Your email is john@example.com.');
  });

  test('stringifies object and array substitution values as compact JSON', () => {
    expect(
      applySubstitutions('User: {{user}}. Roles: {{roles}}.', {
        user: {
          id: 'user-1',
          name: 'Jane',
        },
        roles: ['admin', 'editor'],
      }),
    ).toBe('User: {"id":"user-1","name":"Jane"}. Roles: ["admin","editor"].');
  });

  test('applies JSON indentation to object and array substitution values', () => {
    expect(
      applySubstitutions(
        'User:\n{{user}}\nRoles:\n{{roles}}',
        {
          user: {
            id: 'user-1',
            name: 'Jane',
          },
          roles: ['admin', 'editor'],
        },
        {
          jsonIndent: 2,
        },
      ),
    ).toBe(
      'User:\n{\n  "id": "user-1",\n  "name": "Jane"\n}\nRoles:\n[\n  "admin",\n  "editor"\n]',
    );
  });

  test('replaces placeholders when their substitution value is null or undefined', () => {
    expect(
      applySubstitutions('Missing value: {{missingValue}}. Null value: {{nullValue}}.', {
        missingValue: undefined,
        nullValue: null,
      }),
    ).toBe('Missing value: undefined. Null value: null.');
  });

  test('falls back to String when a substitution value cannot be stringified as JSON', () => {
    const circularValue: Record<string, unknown> = { id: 'value-1' };

    circularValue['self'] = circularValue;

    expect(applySubstitutions('Value: {{value}}.', { value: circularValue })).toBe(
      'Value: [object Object].',
    );
  });
});

describe('escapeHtml', () => {
  test.each([
    ['<b>"Tom" & Jerry\'s</b>', '&lt;b&gt;&quot;Tom&quot; &amp; Jerry&#39;s&lt;/b&gt;'],
    ['plain text', 'plain text'],
    ['&amp;', '&amp;amp;'],
    ['', ''],
  ])('escapeHtml(%s) -> %s', (text, expected) => {
    expect(escapeHtml(text)).toBe(expected);
  });
});

describe('pluralize', () => {
  test.each([
    [1, 'file', undefined, 'file'],
    [0, 'file', undefined, 'files'],
    [2, 'file', undefined, 'files'],
    [-1, 'file', undefined, 'files'],
    [1, 'entry', 'entries', 'entry'],
    [3, 'entry', 'entries', 'entries'],
  ])('pluralize(%d, %s, %s) -> %s', (count, singular, plural, expected) => {
    expect(pluralize(count, singular, plural)).toBe(expected);
  });
});

describe('truncateToUtf8Bytes', () => {
  test.each([
    ['Hello, world', 5, 'Hello'],
    ['Hello', 5, 'Hello'],
    ['Hello', 100, 'Hello'],
    ['Hello', 0, ''],
    ['', 0, ''],
    ['café', 4, 'caf'],
    ['café', 5, 'café'],
    ['日本語', 6, '日本'],
    ['日本語', 8, '日本'],
    ['日本語', 9, '日本語'],
    ['a😀b', 4, 'a'],
    ['a😀b', 5, 'a😀'],
    ['a😀b', 6, 'a😀b'],
    ['\uD800x', 2, ''],
    ['\uD800x', 3, '\uD800'],
    ['\uDC00\uD800', 5, '\uDC00'],
  ])('truncateToUtf8Bytes(%o, %d) -> %o', (text, maxBytes, expected) => {
    expect(truncateToUtf8Bytes(text, maxBytes)).toBe(expected);
  });

  test('never splits a surrogate pair, and matches the TextEncoder byte count', () => {
    const text = '😀'.repeat(8);

    for (let maxBytes = 0; maxBytes <= 32; maxBytes += 1) {
      const result = truncateToUtf8Bytes(text, maxBytes);

      expect(result.length % 2).toBe(0);
      expect(new TextEncoder().encode(result).length).toBe(Math.floor(maxBytes / 4) * 4);
    }
  });

  test('walks a long string once, in linear time', () => {
    const text = 'é'.repeat(1_000_000);

    expect(truncateToUtf8Bytes(text, 1_000_001)).toBe('é'.repeat(500_000));
  });

  test.each([[-1], [1.5], [Number.NaN], [Number.POSITIVE_INFINITY], [2 ** 53]])(
    'truncateToUtf8Bytes(text, %d) -> throws INVALID_BYTE_LIMIT',
    (maxBytes) => {
      expectToThrowCode(() => truncateToUtf8Bytes('text', maxBytes), ERRORS.INVALID_BYTE_LIMIT);
    },
  );
});
