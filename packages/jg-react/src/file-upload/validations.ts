import { DEFAULT_FILE_UPLOAD_MESSAGES } from './constants.js';
import type {
  IFileUploadMessages,
  IFileUploadPolicy,
  IFileUploadValidationIssue,
  IFileUploadValidationReason,
} from './types.js';

/**
 * Checks whether a file matches one of the accepted types: an extension against its name, a MIME
 * type against its type, and `type/*` against its type's prefix.
 * @param file The file.
 * @param acceptedFileTypes The policy's accepted types.
 * @returns Whether it matches, or true when every type is accepted.
 */
export const doesFileMatchAcceptedType = (
  file: File,
  acceptedFileTypes: readonly string[],
): boolean => {
  if (acceptedFileTypes.length === 0) {
    return true;
  }
  const fileName = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();
  return acceptedFileTypes.some((acceptedFileType) => {
    if (acceptedFileType.startsWith('.')) {
      return fileName.endsWith(acceptedFileType);
    }
    if (acceptedFileType.endsWith('/*')) {
      return mimeType.startsWith(acceptedFileType.slice(0, -1));
    }
    return mimeType === acceptedFileType;
  });
};

/**
 * Checks whether two files are the same selection: the same name, size, type, and date.
 * @param first The first file.
 * @param second The second file.
 * @returns Whether they're duplicates.
 */
export const areFilesDuplicates = (first: File, second: File): boolean =>
  first.name === second.name &&
  first.size === second.size &&
  first.type === second.type &&
  first.lastModified === second.lastModified;

/**
 * Builds a built-in check's issue, without a code or a cause.
 * @param reason The check that failed.
 * @param message The message to show.
 * @returns The issue.
 */
const createValidationIssue = (
  reason: IFileUploadValidationReason,
  message: string,
): IFileUploadValidationIssue => ({ cause: null, code: null, message, reason });

/**
 * Checks a file against a policy and the files already admitted, in a fixed order: empty, type,
 * size, duplicate, count, and total size.
 * @param file The file.
 * @param admittedFiles The files that count toward the limits.
 * @param policy The policy, from resolveFileUploadPolicy.
 * @param messages The text of the issues. Defaults to DEFAULT_FILE_UPLOAD_MESSAGES.
 * @returns The first issue, or null when the file is admitted.
 * @example
 * import { resolveFileUploadPolicy, validateFileUploadCandidate } from 'jg-react';
 *
 * const policy = resolveFileUploadPolicy({ acceptedFileTypes: ['image/*'], maxFileBytes: 1024 });
 * validateFileUploadCandidate(new File([], 'empty.png', { type: 'image/png' }), [], policy);
 * // { reason: 'empty-file', message: '"empty.png" is empty and cannot be uploaded.', ... }
 */
export const validateFileUploadCandidate = (
  file: File,
  admittedFiles: readonly File[],
  policy: IFileUploadPolicy,
  messages: IFileUploadMessages = DEFAULT_FILE_UPLOAD_MESSAGES,
): IFileUploadValidationIssue | null => {
  if (file.size === 0) {
    return createValidationIssue('empty-file', messages.emptyFile(file.name));
  }
  if (!doesFileMatchAcceptedType(file, policy.acceptedFileTypes)) {
    return createValidationIssue(
      'unsupported-file-type',
      messages.unsupportedFileType(file.name, policy.acceptedFileTypes),
    );
  }
  if (file.size > policy.maxFileBytes) {
    return createValidationIssue(
      'file-too-large',
      messages.fileTooLarge(file.name, policy.maxFileBytes, file.size - policy.maxFileBytes),
    );
  }
  if (
    !policy.allowDuplicateFiles &&
    admittedFiles.some((admittedFile) => areFilesDuplicates(file, admittedFile))
  ) {
    return createValidationIssue('duplicate-file', messages.duplicateFile(file.name));
  }
  if (admittedFiles.length >= policy.maxFiles) {
    return createValidationIssue(
      'file-count-exceeded',
      messages.fileCountExceeded(policy.maxFiles),
    );
  }
  if (policy.maxTotalBytes !== null) {
    const admittedBytes = admittedFiles.reduce(
      (total, admittedFile) => total + admittedFile.size,
      0,
    );
    if (admittedBytes + file.size > policy.maxTotalBytes) {
      return createValidationIssue(
        'total-size-exceeded',
        messages.totalSizeExceeded(file.name, policy.maxTotalBytes),
      );
    }
  }
  return null;
};
