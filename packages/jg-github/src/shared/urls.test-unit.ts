// @vitest-environment node
import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test } from 'vitest';

import { ERRORS } from './errors.js';
import { buildGithubApiUrl, buildGithubRawContentUrl } from './urls.js';

describe('buildGithubApiUrl', () => {
  test('encodes each segment, so a branch keeps its slash inside one segment', () => {
    expect(buildGithubApiUrl(['repos', 'acme', 'app', 'branches', 'feature/login'])).toBe(
      'https://api.github.com/repos/acme/app/branches/feature%2Flogin',
    );
  });

  test('encodes characters a path or a query would read, and takes numbers', () => {
    expect(buildGithubApiUrl(['app', 'installations', 42, 'a b?c#d%e'])).toBe(
      'https://api.github.com/app/installations/42/a%20b%3Fc%23d%25e',
    );
  });

  test('appends the query, leaving out undefined values', () => {
    expect(
      buildGithubApiUrl(['repos', 'acme', 'app', 'git', 'trees', 'main'], {
        recursive: 1,
        per_page: undefined,
        draft: false,
        q: 'a&b',
      }),
    ).toBe('https://api.github.com/repos/acme/app/git/trees/main?recursive=1&draft=false&q=a%26b');
  });

  test.each([
    ['https://ghe.example.com/api/v3', 'https://ghe.example.com/api/v3/installation/token'],
    ['https://ghe.example.com/api/v3/', 'https://ghe.example.com/api/v3/installation/token'],
    ['http://127.0.0.1:4010', 'http://127.0.0.1:4010/installation/token'],
    ['http://localhost:4010', 'http://localhost:4010/installation/token'],
    ['http://[::1]:4010', 'http://[::1]:4010/installation/token'],
  ])('takes the base URL %s', (apiOrigin, expected) => {
    expect(buildGithubApiUrl(['installation', 'token'], {}, { apiOrigin })).toBe(expected);
  });

  test.each([
    ['plain http on another host', { apiOrigin: 'http://api.example.com' }],
    ['credentials in the base URL', { apiOrigin: 'https://user:secret@api.github.com' }],
    ['a query in the base URL', { apiOrigin: 'https://api.github.com/?token=1' }],
    ['a fragment in the base URL', { apiOrigin: 'https://api.github.com/#x1' }],
    ['a base URL that is not a URL', { apiOrigin: 'api.github.com' }],
    ['a base URL that is not a string', { apiOrigin: 42 }],
  ])('rejects %s', (_description, options) => {
    expectToThrowCode(
      () => buildGithubApiUrl(['installation'], {}, options as { apiOrigin: string }),
      ERRORS.GITHUB_INVALID_ARGUMENT,
    );
  });

  test.each([
    ['no segments', []],
    ['segments that are not an array', 'installation'],
    ['an empty segment', ['repos', '']],
    ['a dot segment', ['repos', '.']],
    ['a segment that climbs', ['repos', '..', 'admin']],
    ['a negative number', ['installations', -1]],
    ['a fractional number', ['installations', 1.5]],
    ['a segment that is not a string or a number', ['installations', null]],
  ])('rejects %s', (_description, segments) => {
    expectToThrowCode(
      () => buildGithubApiUrl(segments as string[]),
      ERRORS.GITHUB_INVALID_ARGUMENT,
    );
  });
});

describe('buildGithubRawContentUrl', () => {
  test("keeps the ref's and the path's slashes, encoding each part", () => {
    expect(
      buildGithubRawContentUrl({
        owner: 'acme',
        repository: 'app',
        ref: 'feature/login',
        path: 'docs/set up#1.md',
      }),
    ).toBe('https://raw.githubusercontent.com/acme/app/feature/login/docs/set%20up%231.md');
  });

  test('takes a base URL for a test server', () => {
    expect(
      buildGithubRawContentUrl(
        { owner: 'acme', repository: 'app', ref: 'main', path: 'README.md' },
        { rawContentOrigin: 'http://127.0.0.1:4010' },
      ),
    ).toBe('http://127.0.0.1:4010/acme/app/main/README.md');
  });

  test.each([
    ['an empty owner', { owner: '', ref: 'main', path: 'a.md' }],
    ['an empty ref', { ref: '', path: 'a.md' }],
    ['a path that climbs', { ref: 'main', path: '../secrets.md' }],
    ['a path with an empty segment', { ref: 'main', path: 'docs//a.md' }],
    ['a path that is not a string', { ref: 'main', path: 42 }],
    [
      'a base URL on plain http',
      { ref: 'main', path: 'a.md', rawContentOrigin: 'http://raw.example.com' },
    ],
  ])('rejects %s', (_description, overrides) => {
    const { rawContentOrigin, ...location } = overrides as Record<string, unknown>;
    expectToThrowCode(
      () =>
        buildGithubRawContentUrl(
          { owner: 'acme', repository: 'app', ...location } as Parameters<
            typeof buildGithubRawContentUrl
          >[0],
          rawContentOrigin === undefined ? {} : { rawContentOrigin: rawContentOrigin as string },
        ),
      ERRORS.GITHUB_INVALID_ARGUMENT,
    );
  });
});
