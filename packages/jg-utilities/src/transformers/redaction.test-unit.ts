// @vitest-environment node
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import { SECRET_TOKEN_PATTERNS } from './constants.js';
import { redactSecrets, redactUrlQueryParams } from './redaction.js';

// the number of lines a text has, whichever line breaks it uses
const countLines = (text: string): number => text.split(/\r\n|\r|\n/u).length;

describe('redactUrlQueryParams', () => {
  test.each([
    ['/health'],
    ['/projects?include=members#overview'],
    ['https://example.com/settings#?unsubscribe_token=fragment-only'],
    ['/search?token_count=3'],
  ])('redactUrlQueryParams(%s) -> unchanged', (url) => {
    expect(redactUrlQueryParams(url, ['unsubscribe_token'])).toBe(url);
  });

  test.each([
    ['/unsubscribe?unsubscribe_token=secret#confirmation', '/unsubscribe'],
    [
      'https://api.example.com/unsubscribe?source=email&unsubscribe_token=secret',
      'https://api.example.com/unsubscribe',
    ],
    ['/unsubscribe?unsubscribe%5Ftoken=secret', '/unsubscribe'],
    ['/unsubscribe?source=email&unsubscribe_token=first&unsubscribe_token=second', '/unsubscribe'],
    ['/unsubscribe?unsubscribe_token[]=secret', '/unsubscribe'],
    ['/unsubscribe?unsubscribe_token%5B0%5D=secret', '/unsubscribe'],
    ['/unsubscribe?unsubscribe_token', '/unsubscribe'],
    ['https://[::1?unsubscribe_token=secret', 'https://[::1'],
  ])('redactUrlQueryParams(%s) -> %s', (url, expected) => {
    expect(redactUrlQueryParams(url, ['unsubscribe_token'])).toBe(expected);
  });

  test('decodes a plus sign in a name as a space', () => {
    expect(redactUrlQueryParams('/sign-in?api+key=secret', ['api key'])).toBe('/sign-in');
  });

  test('redacts the URL when any of several names is present', () => {
    expect(redactUrlQueryParams('/callback?state=1&code=abc', ['token', 'code'])).toBe('/callback');
  });

  test('gives the marker when a name cannot be decoded, because it could hide a match', () => {
    expect(redactUrlQueryParams('/unsubscribe?unsubscribe_token%ZZ=secret', ['other'])).toBe(
      '[redacted]',
    );
  });

  test('gives the marker for a URL that is only a query, without exposing it', () => {
    expect(redactUrlQueryParams('?unsubscribe_token=secret', ['unsubscribe_token'])).toBe(
      '[redacted]',
    );
  });
});

describe('redactSecrets', () => {
  test('leaves text without secrets unchanged', () => {
    expect(redactSecrets('export const port = 3000;')).toStrictEqual({
      text: 'export const port = 3000;',
      count: 0,
    });
  });

  test('replaces every default token form, and counts them', () => {
    const text = [
      'ghp_abcdefghijklmnopqrstuvwxyz',
      'gho_abcdefghijklmnopqrstuvwxyz',
      'github_pat_abcdefghijklmnopqrstuvwxyz_0123',
      'sk-abcdefghijklmnop-qrstuvwxyz',
      'ghp_tooshort',
    ].join(' ');

    expect(redactSecrets(text)).toStrictEqual({
      text: '[redacted] [redacted] [redacted] [redacted] ghp_tooshort',
      count: 4,
    });
  });

  test('uses the given replacement, literally', () => {
    const text =
      'const first = "ghp_abcdefghijklmnopqrstuvwxyz"; const second = "sk-abcdefghijklmnopqrstuvwxyz";';

    expect(redactSecrets(text, { replacement: '[REDACTED]' }).text).toBe(
      'const first = "[REDACTED]"; const second = "[REDACTED]";',
    );
    expect(redactSecrets('ghp_abcdefghijklmnopqrstuvwxyz', { replacement: '$&' }).text).toBe('$&');
  });

  test('replaces every match of a given pattern, even one without the g flag, and leaves it as it was', () => {
    const pattern = /AKIA[A-Z0-9]{16}/u;

    expect(
      redactSecrets('AKIAABCDEFGHIJKLMNOP and AKIAQRSTUVWXYZ012345', { patterns: [pattern] }),
    ).toStrictEqual({ text: '[redacted] and [redacted]', count: 2 });
    expect(pattern.flags).toBe('u');
    expect(pattern.lastIndex).toBe(0);
  });

  test('leaves the default patterns as they were', () => {
    redactSecrets('ghp_abcdefghijklmnopqrstuvwxyz ghp_abcdefghijklmnopqrstuvwxyz');

    expect(SECRET_TOKEN_PATTERNS.map((pattern) => pattern.lastIndex)).toStrictEqual([0, 0, 0]);
  });

  test.each(['\n', '\r\n', '\r'])(
    'keeps the %j line breaks of a private key with preserveLineBreaks',
    (lineBreak) => {
      const text = [
        'before',
        '-----BEGIN TEST PRIVATE KEY-----',
        'synthetic key body',
        '-----END TEST PRIVATE KEY-----',
        'after',
      ].join(lineBreak);

      expect(redactSecrets(text, { preserveLineBreaks: true })).toStrictEqual({
        text: ['before', '[redacted]', '', '', 'after'].join(lineBreak),
        count: 1,
      });
      expect(redactSecrets(text)).toStrictEqual({
        text: ['before', '[redacted]', 'after'].join(lineBreak),
        count: 1,
      });
    },
  );

  test.each(['\n', '\r\n', '\r'])(
    'keeps the line count when a private key ends the text, with %j line breaks',
    (lineBreak) => {
      const text = [
        'before',
        '-----BEGIN TEST PRIVATE KEY-----',
        'synthetic body',
        '-----END TEST PRIVATE KEY-----',
      ].join(lineBreak);
      const result = redactSecrets(text, { preserveLineBreaks: true });

      expect(result).toStrictEqual({
        text: ['before', '', '', '[redacted]'].join(lineBreak),
        count: 1,
      });
      expect(countLines(result.text)).toBe(countLines(text));
    },
  );

  test('redacts only complete blocks, with nested starts, stray ends, and different labels', () => {
    const text = [
      '-----END TEST PRIVATE KEY-----',
      '-----BEGIN TEST PRIVATE KEY-----',
      '-----BEGIN OTHER PRIVATE KEY-----',
      'synthetic body',
      '-----END DIFFERENT PRIVATE KEY-----',
      '-----BEGIN PRIVATE KEY-----synthetic-----END PRIVATE KEY-----',
      '-----BEGIN UNFINISHED PRIVATE KEY-----',
    ].join('\n');

    expect(redactSecrets(text)).toStrictEqual({
      text: [
        '-----END TEST PRIVATE KEY-----',
        '[redacted]',
        '[redacted]',
        '-----BEGIN UNFINISHED PRIVATE KEY-----',
      ].join('\n'),
      count: 2,
    });
  });

  test('scans many unterminated starts in one pass', () => {
    const prefix = '-----BEGIN PRIVATE KEY-----\n'.repeat(32_768);

    expect(redactSecrets(`${prefix}github_pat_synthetic_abcdefghijklmnopqrstuvwxyz`)).toStrictEqual(
      {
        text: `${prefix}[redacted]`,
        count: 1,
      },
    );
    expect(redactSecrets(`${prefix}-----END PRIVATE KEY-----`)).toStrictEqual({
      text: '[redacted]',
      count: 1,
    });
  });

  test('never leaves a token in the text, and never throws', () => {
    fc.assert(
      fc.property(
        fc.array(fc.stringMatching(/^[a-z ,.:;=\n]{0,12}$/u), { minLength: 1, maxLength: 4 }),
        fc.array(fc.stringMatching(/^(?:ghp|gho|ghs)_[A-Za-z0-9]{20,40}$/u), {
          minLength: 1,
          maxLength: 3,
        }),
        fc.boolean(),
        (words, tokens, preserveLineBreaks) => {
          const text = tokens
            .map((token, index) => `${words[index % words.length] ?? ''} ${token} `)
            .join('');
          const result = redactSecrets(text, { preserveLineBreaks });

          expect(result.count).toBe(tokens.length);
          for (const token of tokens) {
            expect(result.text).not.toContain(token);
          }
        },
      ),
    );
    fc.assert(
      fc.property(fc.string(), fc.boolean(), (text, preserveLineBreaks) => {
        expect(typeof redactSecrets(text, { preserveLineBreaks }).text).toBe('string');
      }),
    );
  });
});
