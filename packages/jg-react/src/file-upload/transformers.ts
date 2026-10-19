import { Exception } from 'jg-exception';
import { isIntegerValid } from 'jg-utilities';

import { ERRORS } from '../shared/index.js';

import {
  FILE_UPLOAD_DEFAULT_MAX_CONCURRENT_UPLOADS,
  FILE_UPLOAD_DEFAULT_MAX_FILES,
  FILE_UPLOAD_EXTENSION_PATTERN,
  FILE_UPLOAD_MIME_TYPE_PATTERN,
} from './constants.js';
import type { IFileUploadItem, IFileUploadPolicy, IFileUploadPolicyOptions } from './types.js';

/**
 * Builds the exception for a policy field that isn't valid.
 * @param message What's wrong with it.
 * @param data The value, when it helps.
 * @returns The INVALID_FILE_UPLOAD_POLICY exception.
 */
const invalidPolicy = (message: string, data?: Record<string, string>): Exception =>
  new Exception(message, {
    code: ERRORS.INVALID_FILE_UPLOAD_POLICY,
    ...(data === undefined ? {} : { data }),
  });

/**
 * Normalizes an accepted file type: trimmed and lowercased.
 * @param acceptedFileType The type.
 * @returns The normalized type.
 * @throws
 * - INVALID_FILE_UPLOAD_POLICY: Each accepted file type must be a string.
 * - INVALID_FILE_UPLOAD_POLICY: Each accepted file type must be a file extension, such as .png, or a MIME type, such as image/png.
 */
const normalizeAcceptedFileType = (acceptedFileType: unknown): string => {
  if (typeof acceptedFileType !== 'string') {
    throw invalidPolicy('Each accepted file type must be a string.');
  }
  const normalized = acceptedFileType.trim().toLowerCase();
  if (
    !FILE_UPLOAD_EXTENSION_PATTERN.test(normalized) &&
    !FILE_UPLOAD_MIME_TYPE_PATTERN.test(normalized)
  ) {
    throw invalidPolicy(
      'Each accepted file type must be a file extension, such as .png, or a MIME type, such as image/png.',
      { acceptedFileType: acceptedFileType.slice(0, 100) },
    );
  }
  return normalized;
};

/**
 * Checks and normalizes an upload policy: accepted types trimmed, lowercased, and without repeats,
 * the defaults filled in, concurrency capped at maxFiles, and single-file replacement only for
 * one file.
 * @param options The policy's fields.
 * @returns The policy.
 * @example
 * import { resolveFileUploadPolicy } from 'jg-react';
 *
 * resolveFileUploadPolicy({ acceptedFileTypes: [' IMAGE/PNG '], maxFileBytes: 1_048_576 });
 * // { acceptedFileTypes: ['image/png'], maxFiles: 1, maxConcurrentUploads: 1, ... }
 * @throws
 * - INVALID_FILE_UPLOAD_POLICY: The accepted file types must be an array.
 * - INVALID_FILE_UPLOAD_POLICY: Each accepted file type must be a string.
 * - INVALID_FILE_UPLOAD_POLICY: Each accepted file type must be a file extension, such as .png, or a MIME type, such as image/png.
 * - INVALID_FILE_UPLOAD_POLICY: The maximum file size must be a positive integer of bytes.
 * - INVALID_FILE_UPLOAD_POLICY: The maximum file count must be a positive integer.
 * - INVALID_FILE_UPLOAD_POLICY: The maximum concurrent uploads must be a positive integer.
 * - INVALID_FILE_UPLOAD_POLICY: The maximum total size must be a positive integer of bytes, when given.
 */
export const resolveFileUploadPolicy = ({
  acceptedFileTypes,
  allowDuplicateFiles = false,
  autoUpload = true,
  maxConcurrentUploads = FILE_UPLOAD_DEFAULT_MAX_CONCURRENT_UPLOADS,
  maxFileBytes,
  maxFiles = FILE_UPLOAD_DEFAULT_MAX_FILES,
  maxTotalBytes,
  replaceSingleFile = true,
}: IFileUploadPolicyOptions): IFileUploadPolicy => {
  if (!Array.isArray(acceptedFileTypes)) {
    throw invalidPolicy('The accepted file types must be an array.');
  }
  const normalizedAcceptedFileTypes = acceptedFileTypes.map(normalizeAcceptedFileType);
  if (!isIntegerValid(maxFileBytes, 1)) {
    throw invalidPolicy('The maximum file size must be a positive integer of bytes.');
  }
  if (!isIntegerValid(maxFiles, 1)) {
    throw invalidPolicy('The maximum file count must be a positive integer.');
  }
  if (!isIntegerValid(maxConcurrentUploads, 1)) {
    throw invalidPolicy('The maximum concurrent uploads must be a positive integer.');
  }
  if (maxTotalBytes !== undefined && !isIntegerValid(maxTotalBytes, 1)) {
    throw invalidPolicy('The maximum total size must be a positive integer of bytes, when given.');
  }
  return {
    acceptedFileTypes: [...new Set(normalizedAcceptedFileTypes)],
    allowDuplicateFiles,
    autoUpload,
    maxConcurrentUploads: Math.min(maxConcurrentUploads, maxFiles),
    maxFileBytes,
    maxFiles,
    maxTotalBytes: maxTotalBytes ?? null,
    replaceSingleFile: maxFiles === 1 && replaceSingleFile,
  };
};

/**
 * Builds a file input's `accept` attribute from a policy's accepted types.
 * @param acceptedFileTypes The policy's accepted types.
 * @returns The attribute's value, or undefined when every type is accepted.
 * @example
 * import { createFileUploadAcceptValue } from 'jg-react';
 *
 * createFileUploadAcceptValue(['image/png', '.jpg']); // 'image/png,.jpg'
 */
export const createFileUploadAcceptValue = (
  acceptedFileTypes: readonly string[],
): string | undefined => (acceptedFileTypes.length === 0 ? undefined : acceptedFileTypes.join(','));

/**
 * Gives the files that count toward the limits: every item's but the validating and rejected ones.
 * @param items The queue's items.
 * @returns The files, in queue order.
 */
export const getAdmittedFileUploadFiles = <TResult>(
  items: readonly IFileUploadItem<TResult>[],
): File[] =>
  items
    .filter((item) => item.status !== 'rejected' && item.status !== 'validating')
    .map((item) => item.file);
