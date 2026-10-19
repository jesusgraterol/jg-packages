import { isHeaderValue, isRecord } from '../shared/index.js';
import { IMPLICIT_PERMISSION } from './constants.js';
import type { IGithubPermissions, IGithubRepository } from './types.js';
import type { IRequestedRepositories } from './validations.js';

// a granted repository, as GitHub describes it
export type IGrantedRepository = IGithubRepository & {
  // the repository's name, without its owner
  name: string;
};

// what GitHub's answer to a token request says, once read
export type ITokenDetails = {
  expiresAt: Date;
  permissions: Record<string, string>;
  repositorySelection: string;
  repositories: IGrantedRepository[];
};

// what in a granted token differs from the request
export type IScopeMismatch = 'repository_selection' | 'repositories' | 'permissions';

/**
 * Reads the token from GitHub's answer to a token request.
 * @param data The answer, parsed from JSON.
 * @returns The token, or undefined when there's none.
 */
export const readToken = (data: unknown): string | undefined =>
  isRecord(data) && isHeaderValue(data['token']) && !data['token'].includes(' ')
    ? data['token']
    : undefined;

/**
 * Reads a granted repository.
 * @param value The repository, parsed from JSON.
 * @returns The repository, or undefined when it isn't one.
 */
const readRepository = (value: unknown): IGrantedRepository | undefined =>
  isRecord(value) &&
  Number.isSafeInteger(value['id']) &&
  (value['id'] as number) > 0 &&
  typeof value['name'] === 'string' &&
  typeof value['full_name'] === 'string'
    ? { id: value['id'] as number, name: value['name'], fullName: value['full_name'] }
    : undefined;

/**
 * Reads the rest of GitHub's answer to a token request: when it expires, its permissions, and
 * the repositories it reaches, which an answer for every repository leaves out.
 * @param data The answer, parsed from JSON.
 * @returns The details, or undefined when the answer isn't valid.
 */
export const readTokenDetails = (data: unknown): ITokenDetails | undefined => {
  if (!isRecord(data) || typeof data['expires_at'] !== 'string') {
    return undefined;
  }
  const expiresAt = new Date(data['expires_at']);
  const permissions = data['permissions'];
  const repositorySelection = data['repository_selection'];
  const rawRepositories = data['repositories'] ?? [];
  if (
    Number.isNaN(expiresAt.getTime()) ||
    !isRecord(permissions) ||
    !Object.values(permissions).every((level) => typeof level === 'string') ||
    typeof repositorySelection !== 'string' ||
    !Array.isArray(rawRepositories)
  ) {
    return undefined;
  }
  const repositories = rawRepositories.map(readRepository);
  if (repositories.includes(undefined)) {
    return undefined;
  }
  return {
    expiresAt,
    permissions: permissions as Record<string, string>,
    repositorySelection,
    repositories: repositories as IGrantedRepository[],
  };
};

/**
 * Checks whether two lists hold the same values, each once.
 * @param granted The granted values.
 * @param requested The requested values, without repeats.
 * @returns Whether they're the same set.
 */
const isSameSet = <T>(granted: readonly T[], requested: readonly T[]): boolean => {
  const grantedSet = new Set(granted);
  return (
    grantedSet.size === granted.length &&
    grantedSet.size === requested.length &&
    requested.every((value) => grantedSet.has(value))
  );
};

/**
 * Compares a granted token's scope with the request: it must reach only the selected
 * repositories, exactly the requested ones, by name ignoring case or by ID, as they were
 * requested, and grant exactly the requested permissions, plus `metadata: 'read'` when GitHub
 * adds it.
 * @param details The granted token's details.
 * @param requested The requested repositories.
 * @param permissions The requested permissions.
 * @returns What differs, or null when nothing does.
 */
export const findScopeMismatch = (
  details: ITokenDetails,
  requested: IRequestedRepositories,
  permissions: IGithubPermissions,
): IScopeMismatch | null => {
  if (details.repositorySelection !== 'selected') {
    return 'repository_selection';
  }
  const isSameRepositories =
    requested.kind === 'names'
      ? isSameSet(
          details.repositories.map(({ name }) => name.toLowerCase()),
          requested.values.map((name) => name.toLowerCase()),
        )
      : isSameSet(
          details.repositories.map(({ id }) => id),
          requested.values,
        );
  if (!isSameRepositories) {
    return 'repositories';
  }
  const granted = Object.entries(details.permissions);
  const isSamePermissions =
    Object.entries(permissions).every(
      ([name, level]) =>
        Object.hasOwn(details.permissions, name) && details.permissions[name] === level,
    ) &&
    granted.every(
      ([name, level]) =>
        Object.hasOwn(permissions, name) ||
        (name === IMPLICIT_PERMISSION.name && level === IMPLICIT_PERMISSION.level),
    );
  return isSamePermissions ? null : 'permissions';
};
