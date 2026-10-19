// @vitest-environment node
import { expectToThrowCode } from 'jg-exception/testing';
import { expect, test } from 'vitest';

import { GITHUB_API_VERSION } from './constants.js';
import { ERRORS } from './errors.js';
import { createGithubHeaders } from './headers.js';

test('builds the media type, the bearer token, the User-Agent, and the API version', () => {
  expect(createGithubHeaders('ghs_token', { userAgent: 'acme-bot/1.0 (ops)' })).toStrictEqual({
    accept: 'application/vnd.github+json',
    authorization: 'Bearer ghs_token',
    'user-agent': 'acme-bot/1.0 (ops)',
    'x-github-api-version': GITHUB_API_VERSION,
  });
});

test('asks for the API version it is given', () => {
  expect(
    createGithubHeaders('ghs_token', { userAgent: 'acme-bot', apiVersion: '2022-11-28' }),
  ).toMatchObject({ 'x-github-api-version': '2022-11-28' });
});

test.each([
  ['an empty token', '', {}],
  ['a token with a space', 'ghs_a b', {}],
  ['a token with a line break', 'ghs_a\r\nX-Injected: 1', {}],
  ['an empty User-Agent', 'ghs_token', { userAgent: '' }],
  ['a User-Agent with a line break', 'ghs_token', { userAgent: 'bot\n' }],
  ['an empty API version', 'ghs_token', { apiVersion: '' }],
])('rejects %s', (_description, token, overrides) => {
  expectToThrowCode(
    () => createGithubHeaders(token, { userAgent: 'acme-bot', ...overrides }),
    ERRORS.GITHUB_INVALID_ARGUMENT,
  );
});
