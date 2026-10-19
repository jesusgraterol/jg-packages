// @vitest-environment node
import { describe, expect, test } from 'vitest';

import type { IGithubPermissions } from './types.js';
import { findScopeMismatch, readToken, readTokenDetails, type ITokenDetails } from './utilities.js';
import type { IRequestedRepositories } from './validations.js';

const DETAILS: ITokenDetails = {
  expiresAt: new Date('2026-10-19T18:00:00Z'),
  permissions: { contents: 'read', metadata: 'read' },
  repositorySelection: 'selected',
  repositories: [
    { id: 1, name: 'app', fullName: 'acme/app' },
    { id: 2, name: 'Docs', fullName: 'acme/Docs' },
  ],
};
const BY_NAME: IRequestedRepositories = { kind: 'names', values: ['App', 'docs'] };
const BY_ID: IRequestedRepositories = { kind: 'ids', values: [2, 1] };
const PERMISSIONS: IGithubPermissions = { contents: 'read' };

describe('findScopeMismatch', () => {
  test('accepts exactly the requested repositories, by name ignoring case or by ID', () => {
    expect(findScopeMismatch(DETAILS, BY_NAME, PERMISSIONS)).toBeNull();
    expect(findScopeMismatch(DETAILS, BY_ID, PERMISSIONS)).toBeNull();
  });

  test('accepts metadata: read granted without being asked, or asked for', () => {
    expect(findScopeMismatch(DETAILS, BY_ID, { contents: 'read', metadata: 'read' })).toBeNull();
    expect(
      findScopeMismatch({ ...DETAILS, permissions: { contents: 'read' } }, BY_ID, PERMISSIONS),
    ).toBeNull();
  });

  test.each([
    ['every repository of the installation', { repositorySelection: 'all' }],
    ['a missing repository', { repositories: [DETAILS.repositories[0]!] }],
    [
      'an extra repository',
      { repositories: [...DETAILS.repositories, { id: 3, name: 'infra', fullName: 'acme/infra' }] },
    ],
    [
      'a repeated repository instead of one requested',
      { repositories: [DETAILS.repositories[0]!, DETAILS.repositories[0]!] },
    ],
  ])('refuses %s', (_description, overrides) => {
    const details = { ...DETAILS, ...overrides };

    expect(findScopeMismatch(details, BY_NAME, PERMISSIONS)).toBe(
      'repositorySelection' in overrides ? 'repository_selection' : 'repositories',
    );
    expect(findScopeMismatch(details, BY_ID, PERMISSIONS)).toBe(
      'repositorySelection' in overrides ? 'repository_selection' : 'repositories',
    );
  });

  test('compares repositories as they were requested, not by the other key', () => {
    const renamed = {
      ...DETAILS,
      repositories: [
        { id: 1, name: 'renamed', fullName: 'acme/renamed' },
        { id: 2, name: 'docs', fullName: 'acme/docs' },
      ],
    };

    expect(findScopeMismatch(renamed, BY_NAME, PERMISSIONS)).toBe('repositories');
    expect(findScopeMismatch(renamed, BY_ID, PERMISSIONS)).toBeNull();
  });

  test.each([
    ['a higher level', { contents: 'write', metadata: 'read' }],
    ['an extra permission', { contents: 'read', issues: 'read' }],
    ['a missing permission', { metadata: 'read' }],
    ['metadata: write', { contents: 'read', metadata: 'write' }],
    ['no permissions', {}],
  ])('refuses %s', (_description, permissions) => {
    expect(findScopeMismatch({ ...DETAILS, permissions }, BY_ID, PERMISSIONS)).toBe('permissions');
  });

  test("never matches a requested permission against the object's prototype", () => {
    expect(
      findScopeMismatch({ ...DETAILS, permissions: {} }, BY_ID, {
        constructor: 'read',
      } as IGithubPermissions),
    ).toBe('permissions');
  });
});

describe('readToken and readTokenDetails', () => {
  const RESPONSE = {
    token: 'ghs_16C7e42F292c6912E7710c838347Ae178B4a',
    expires_at: '2026-10-19T18:00:00Z',
    permissions: { contents: 'read', metadata: 'read' },
    repository_selection: 'selected',
    repositories: [
      { id: 1, name: 'app', full_name: 'acme/app', private: true },
      { id: 2, name: 'Docs', full_name: 'acme/Docs', private: false },
    ],
  };

  test("reads GitHub's answer", () => {
    expect(readToken(RESPONSE)).toBe(RESPONSE.token);
    expect(readTokenDetails(RESPONSE)).toStrictEqual(DETAILS);
  });

  test('reads an answer for every repository, which lists none', () => {
    expect(
      readTokenDetails({ ...RESPONSE, repositories: undefined, repository_selection: 'all' }),
    ).toStrictEqual({
      ...DETAILS,
      repositorySelection: 'all',
      repositories: [],
    });
  });

  test.each([
    ['no token', { token: undefined }],
    ['an empty token', { token: '' }],
    ['a token with a space', { token: 'ghs_a b' }],
    ['a token that is not a string', { token: 42 }],
  ])('reads no token from an answer with %s', (_description, overrides) => {
    expect(readToken({ ...RESPONSE, ...overrides })).toBeUndefined();
  });

  test('reads no token from an answer that is not an object', () => {
    expect(readToken(null)).toBeUndefined();
    expect(readToken([RESPONSE])).toBeUndefined();
  });

  test.each([
    ['no expiry', { expires_at: undefined }],
    ['an expiry that is not a date', { expires_at: 'tomorrow' }],
    ['permissions that are not an object', { permissions: ['contents'] }],
    ['a permission level that is not a string', { permissions: { contents: 1 } }],
    ['no repository selection', { repository_selection: undefined }],
    ['repositories that are not an array', { repositories: {} }],
    ['a repository without its full name', { repositories: [{ id: 1, name: 'app' }] }],
    [
      'a repository whose ID is a string',
      { repositories: [{ id: '1', name: 'app', full_name: 'acme/app' }] },
    ],
    [
      'a repository whose ID is 0',
      { repositories: [{ id: 0, name: 'app', full_name: 'acme/app' }] },
    ],
    ['a repository without its name', { repositories: [{ id: 1, full_name: 'acme/app' }] }],
  ])('reads no details from an answer with %s', (_description, overrides) => {
    expect(readTokenDetails({ ...RESPONSE, ...overrides })).toBeUndefined();
  });

  test('reads no details from an answer that is not an object', () => {
    expect(readTokenDetails('token')).toBeUndefined();
  });
});
