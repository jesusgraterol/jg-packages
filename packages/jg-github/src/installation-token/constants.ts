import type { IFetchErrorKind } from 'jg-fetch';

import type { IGithubPermissionLevel } from './types.js';

// the access levels a permission can ask for
export const PERMISSION_LEVELS: ReadonlySet<IGithubPermissionLevel> = new Set([
  'read',
  'write',
  'admin',
]);

// a permission's name, such as 'contents' or 'pull_requests'
export const PERMISSION_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

// a repository's name, without its owner
export const REPOSITORY_NAME_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

// an installation's ID
export const INSTALLATION_ID_PATTERN = /^[1-9]\d{0,19}$/;

// the permission GitHub may grant without being asked, since every token can read metadata
export const IMPLICIT_PERMISSION = { name: 'metadata', level: 'read' } as const;

// jg-fetch's failures that mean the request's own options weren't valid, such as a timeout of 0
export const INVALID_ARGUMENT_KINDS: ReadonlySet<IFetchErrorKind> = new Set([
  'INVALID_URL',
  'INVALID_OPTIONS',
  'INVALID_HEADERS',
  'INVALID_BODY',
]);

// jg-fetch's failures that mean GitHub's answer couldn't be read
export const RESPONSE_INVALID_KINDS: ReadonlySet<IFetchErrorKind> = new Set([
  'PARSE_ERROR',
  'RESPONSE_TOO_LARGE',
  'RESPONSE_INVALID',
  'ENVELOPE_INVALID',
  'API_ERROR',
]);
