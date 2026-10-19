// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { z } from 'zod';

import { readInternalUrl, retainSearchParams } from './utilities.js';

describe('retainSearchParams', () => {
  const RULES = {
    status: { schema: z.enum(['all', 'open']), defaultValue: 'all' },
    cursor: {},
  };

  test.each([
    ['status=open&cursor=abc&lookup=private', 'status=open&cursor=abc'],
    ['status=all', ''],
    ['', ''],
    ['cursor=anything goes', 'cursor=anything+goes'],
  ])('retainSearchParams(%s) -> %s', (search, expected) => {
    expect(retainSearchParams(new URLSearchParams(search), RULES)?.toString()).toBe(expected);
  });

  test.each([
    ['a repeated parameter', 'status=open&status=all'],
    ['a value the schema rejects', 'status=closed'],
  ])('gives null for %s', (_, search) => {
    expect(retainSearchParams(new URLSearchParams(search), RULES)).toBeNull();
  });
});

describe('readInternalUrl', () => {
  test('drops the hash and the trailing slash, keeping the root', () => {
    expect(readInternalUrl('/projects/?a=1#top', [])?.href).toBe(
      'https://page-return.invalid/projects?a=1',
    );
    expect(readInternalUrl('/', [])?.pathname).toBe('/');
  });

  test('gives null for a path with an empty segment', () => {
    expect(readInternalUrl('/projects//settings', [])).toBeNull();
  });
});
