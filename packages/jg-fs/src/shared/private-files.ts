import { Exception } from 'jg-exception';

import { ERRORS } from './errors.js';
import { isNotFoundError } from './validations.js';

/*
 * The checks and exceptions the async and sync private file functions share. Windows reports only
 * a file's read-only attribute as its mode, so the permission checks run on POSIX alone.
 */

// whether the platform reports POSIX permission bits that say who can access a file
export const HAS_POSIX_PERMISSIONS = process.platform !== 'win32';

// the permissions a private file and a private directory are created with
export const PRIVATE_FILE_MODE = 0o600;
export const PRIVATE_DIRECTORY_MODE = 0o700;

/**
 * Checks whether permission bits let the group or anyone else read, write, or enter the path.
 * @param mode The path's mode, from stat.
 * @returns Whether it isn't private to its owner.
 */
export const hasSharedAccess = (mode: number): boolean => (mode & 0o077) !== 0;

/**
 * Formats a mode's permission bits as four octal digits, such as `0644`.
 * @param mode The mode.
 * @returns The digits.
 */
const formatMode = (mode: number): string => (mode & 0o777).toString(8).padStart(4, '0');

/**
 * Builds the exception for a file that other users can access.
 * @param path The file's path.
 * @param mode Its mode.
 * @returns The FILE_NOT_PRIVATE exception.
 */
export const fileNotPrivate = (path: string, mode: number): Exception =>
  new Exception(`The file '${path}' can be accessed by other users.`, {
    code: ERRORS.FILE_NOT_PRIVATE,
    data: { path, mode: formatMode(mode) },
  });

/**
 * Builds the exception for a directory that other users can access.
 * @param path The directory's path.
 * @param mode Its mode.
 * @returns The DIRECTORY_NOT_PRIVATE exception.
 */
export const directoryNotPrivate = (path: string, mode: number): Exception =>
  new Exception(`The directory '${path}' can be accessed by other users.`, {
    code: ERRORS.DIRECTORY_NOT_PRIVATE,
    data: { path, mode: formatMode(mode) },
  });

/**
 * Builds the exception for a path that goes through a symbolic link.
 * @param path The path.
 * @returns The PATH_NOT_CANONICAL exception.
 */
export const pathNotCanonical = (path: string): Exception =>
  new Exception(`The path '${path}' goes through a symbolic link.`, {
    code: ERRORS.PATH_NOT_CANONICAL,
    data: { path },
  });

/**
 * Builds the exception for a path that isn't strictly inside its root.
 * @param path The path.
 * @param rootPath The root.
 * @returns The PATH_OUTSIDE_ROOT exception.
 */
export const pathOutsideRoot = (path: string, rootPath: string): Exception =>
  new Exception(`The path '${path}' is not inside '${rootPath}'.`, {
    code: ERRORS.PATH_OUTSIDE_ROOT,
    data: { path, rootPath },
  });

/**
 * Builds the exception for an exclusive write over a path that already exists.
 * @param path The path.
 * @returns The FILE_ALREADY_EXISTS exception.
 */
export const fileAlreadyExists = (path: string): Exception =>
  new Exception(`The file '${path}' already exists.`, {
    code: ERRORS.FILE_ALREADY_EXISTS,
    data: { path },
  });

/**
 * Checks whether an error means a path doesn't exist: it, or a directory on its way, is missing
 * (ENOENT), or a file sits where a directory should be (ENOTDIR).
 * @param error The error.
 * @returns Whether the path doesn't exist.
 */
export const isMissingPathError = (error: unknown): boolean =>
  isNotFoundError(error) || (error instanceof Error && 'code' in error && error.code === 'ENOTDIR');

/**
 * Maps a failure to open a private file without following links: a file that doesn't exist throws
 * NON_EXISTENT_FILE, so callers can tell it from a path that isn't a regular file.
 * @param path The file's path.
 * @param error The error opening it, which wraps a missing path's ENOENT as its cause.
 * @returns The error to throw.
 */
export const mapPrivateOpenError = (path: string, error: unknown): unknown => {
  const openError = error instanceof Error && isNotFoundError(error.cause) ? error.cause : error;
  return isMissingPathError(openError)
    ? new Exception(`The file '${path}' does not exist.`, {
        code: ERRORS.NON_EXISTENT_FILE,
        data: { path },
        cause: openError,
      })
    : error;
};
