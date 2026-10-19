import { invalidArgument, isRecord } from '../shared/index.js';
import {
  INSTALLATION_ID_PATTERN,
  PERMISSION_LEVELS,
  PERMISSION_NAME_PATTERN,
  REPOSITORY_NAME_PATTERN,
} from './constants.js';
import type { IGithubPermissionLevel, IGithubPermissions } from './types.js';

// the repositories a token is requested for, checked
export type IRequestedRepositories =
  { kind: 'names'; values: string[] } | { kind: 'ids'; values: number[] };

/**
 * Reads an installation's ID as the string the URL takes.
 * @param installationId The ID.
 * @returns The ID.
 * @throws
 * - GITHUB_INVALID_ARGUMENT: An argument isn't valid.
 */
export const readInstallationId = (installationId: unknown): string => {
  const value =
    typeof installationId === 'number' && Number.isSafeInteger(installationId)
      ? String(installationId)
      : installationId;
  if (typeof value !== 'string' || !INSTALLATION_ID_PATTERN.test(value)) {
    throw invalidArgument('installationId');
  }
  return value;
};

/**
 * Checks the permissions a token is requested with: at least one, each a known level, because
 * GitHub reads no permissions as every permission of the installation.
 * @param permissions The permissions.
 * @returns The permissions.
 * @throws
 * - GITHUB_INVALID_ARGUMENT: An argument isn't valid.
 */
export const readPermissions = (permissions: unknown): IGithubPermissions => {
  if (
    !isRecord(permissions) ||
    Object.keys(permissions).length === 0 ||
    !Object.entries(permissions).every(
      ([name, level]) =>
        PERMISSION_NAME_PATTERN.test(name) &&
        PERMISSION_LEVELS.has(level as IGithubPermissionLevel),
    )
  ) {
    throw invalidArgument('permissions');
  }
  return { ...(permissions as IGithubPermissions) };
};

/**
 * Checks that a list has at least one item, each valid, and no two the same once normalized.
 * @param values The list.
 * @param isValid Whether an item is valid.
 * @param normalize What two items are compared by.
 * @returns Whether the list is valid.
 */
const isUniqueList = (
  values: unknown,
  isValid: (value: unknown) => boolean,
  normalize: (value: unknown) => unknown,
): boolean =>
  Array.isArray(values) &&
  values.length > 0 &&
  values.every(isValid) &&
  new Set(values.map(normalize)).size === values.length;

/**
 * Checks the repositories a token is requested for: by name or by ID, exactly one of them, with
 * at least one repository and no repeats; names are compared ignoring case, as GitHub does.
 * @param repositories The names, or undefined.
 * @param repositoryIds The IDs, or undefined.
 * @returns The repositories.
 * @throws
 * - GITHUB_INVALID_ARGUMENT: An argument isn't valid.
 */
export const readRequestedRepositories = (
  repositories: unknown,
  repositoryIds: unknown,
): IRequestedRepositories => {
  if ((repositories === undefined) === (repositoryIds === undefined)) {
    throw invalidArgument('repositories');
  }
  if (repositories !== undefined) {
    if (
      !isUniqueList(
        repositories,
        (name) =>
          typeof name === 'string' &&
          REPOSITORY_NAME_PATTERN.test(name) &&
          name !== '.' &&
          name !== '..',
        (name) => (name as string).toLowerCase(),
      )
    ) {
      throw invalidArgument('repositories');
    }
    return { kind: 'names', values: [...(repositories as string[])] };
  }
  if (
    !isUniqueList(
      repositoryIds,
      (id) => Number.isSafeInteger(id) && (id as number) > 0,
      (id) => id,
    )
  ) {
    throw invalidArgument('repositoryIds');
  }
  return { kind: 'ids', values: [...(repositoryIds as number[])] };
};
