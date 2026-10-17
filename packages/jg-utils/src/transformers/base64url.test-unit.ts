// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/errors.js';
import { expectToThrowCode } from 'jg-exception/testing';

import { decodeBase64Url, encodeBase64Url } from './base64url.js';

// the btoa-based encoding the package replaces, valid only for Latin-1 input
const encodeWithBtoa = (value: string): string =>
  btoa(value).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

describe('encodeBase64Url', () => {
  test.each([
    ['{"id":"9b1deb4d","createdAt":1733412835329}'],
    ['{"cursor":"a?b>c"}'],
    ['a'],
    ['ab'],
    ['abc'],
  ])('encodeBase64Url(%s) -> the btoa-based encoding', (value) => {
    expect(encodeBase64Url(value)).toBe(encodeWithBtoa(value));
  });

  test('encodes UTF-8 bytes for characters outside Latin-1', () => {
    expect(encodeBase64Url('€')).toBe('4oKs');
  });

  test('round-trips strings longer than one conversion chunk', () => {
    const value = 'é'.repeat(100_000);

    expect(decodeBase64Url(encodeBase64Url(value))).toBe(value);
  });
});

describe('decodeBase64Url', () => {
  test.each([
    [''],
    ['{"query":"funny movie","page":2}'],
    ['Ünïcödé 文字 🚀'],
    ['﻿starts with a byte order mark'],
  ])('decodeBase64Url(encodeBase64Url(%s)) -> the same string', (value) => {
    expect(decodeBase64Url(encodeBase64Url(value))).toBe(value);
  });

  test.each([
    ['ab+c', 'a standard base64 character'],
    ['ab/c', 'a standard base64 character'],
    ['YQ==', 'padding'],
    ['YWJjZ', 'a length of 1 modulo 4'],
    ['_w', 'bytes that are not valid UTF-8'],
    ['YR', 'a non-canonical encoding'],
    ['YQ ', 'whitespace'],
  ])('decodeBase64Url(%s) -> throws for %s', (value) => {
    expectToThrowCode(() => decodeBase64Url(value), ERRORS.INVALID_BASE64URL);
  });

  test('throws for values that are not strings', () => {
    expectToThrowCode(() => decodeBase64Url(123 as unknown as string), ERRORS.INVALID_BASE64URL);
  });
});
