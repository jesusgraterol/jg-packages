// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/errors.js';
import { expectToThrowCode } from 'jg-exception/testing';

import {
  extractEmailUsername,
  extractTokenFromAuthorizationHeader,
  getInitials,
} from './extractors.js';

describe('extractTokenFromAuthorizationHeader', () => {
  test.each([
    [
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    ],
    ['Bearer abc123.XYZ-789_token', 'abc123.XYZ-789_token'],
  ])('extractTokenFromAuthorizationHeader(%s) -> %s', (header, expected) => {
    expect(extractTokenFromAuthorizationHeader(header)).toBe(expected);
  });

  test.each([
    undefined,
    null,
    {},
    [],
    '',
    'Bearer',
    'Bearer ',
    'bearer abc123',
    'Basic abc123',
    'Bearer abc123#',
  ])('extractTokenFromAuthorizationHeader(%s) -> Error: INVALID_AUTHORIZATION_HEADER', (header) => {
    expectToThrowCode(
      () => extractTokenFromAuthorizationHeader(header as string),
      ERRORS.INVALID_AUTHORIZATION_HEADER,
    );
  });
});

describe('extractEmailUsername', () => {
  test.each([
    ['johndoe@gmail.com', 'johndoe'],
    ['john.doe@protonmail.com', 'john.doe'],
    ['john.doe+shopping@protonmail.com', 'john.doe+shopping'],
    ['JOHNDOE@GMAIL.COM', 'johndoe'],
  ])('extractEmailUsername(%s) -> %s', (email, expected) => {
    expect(extractEmailUsername(email)).toBe(expected);
  });

  test.each([
    undefined,
    null,
    {},
    [],
    '',
    ' ',
    'domain.com',
    '@domain.com',
    'johndoe@gmail',
    'johndoe@gmail.',
    'johndoe@gmail.con',
  ])('extractEmailUsername(%s) -> Error: INVALID_EMAIL_ADDRESS', (email) => {
    expectToThrowCode(() => extractEmailUsername(email as string), ERRORS.INVALID_EMAIL_ADDRESS);
  });
});

describe('getInitials', () => {
  test.each([
    ['John Doe', 1, 'J'],
    ['John Doe', 2, 'JD'],
    ['John', 2, 'JO'],
    ['123 john - 456 doe', 2, 'JD'],
    ['12345', 3, 'A'],
    ['1!23@4#5', 1, 'A'],
    ['  ', 1, 'A'],
    ['', 1, 'A'],
  ])('getInitials(%s, %i) -> %s', (value, initialsCount, expected) => {
    expect(getInitials(value, initialsCount)).toBe(expected);
  });
});
