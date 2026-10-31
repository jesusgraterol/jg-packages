import { prettifyFileSize } from 'jg-utilities';
import {
  DEFAULT_FILE_UPLOAD_MESSAGES,
  type IFileUploadErrorDetails,
  type IFileUploadErrorFeedback,
  type IFileUploadPolicy,
} from 'jg-react';

import type { IErrorFeedbackResolver } from '../../contracts/index.js';
import { DEFAULT_ERROR_FEEDBACK_RESOLVER } from '../../shared/error-feedback/index.js';

// common MIME labels keep policy copy compact and understandable.
const FILE_UPLOAD_TYPE_LABELS: Readonly<Record<string, string>> = {
  'application/pdf': 'PDF',
  'image/gif': 'GIF',
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/svg+xml': 'SVG',
  'image/webp': 'WebP',
  'text/csv': 'CSV',
  'text/plain': 'plain text',
};

/**
 * Creates concise dialog copy from the normalized upload policy.
 * @param policy The validated file count, type, and byte limits.
 * @returns A readable description of the allowed selection.
 */
export const createFileUploadPolicyDescription = (policy: IFileUploadPolicy): string => {
  const countLabel = policy.maxFiles === 1 ? 'one file' : `up to ${policy.maxFiles} files`;
  const typeLabel = createAcceptedFileTypesLabel(policy.acceptedFileTypes);
  const totalLimit =
    policy.maxTotalBytes === null ? '' : `, with ${prettifyFileSize(policy.maxTotalBytes)} total`;

  return `Add ${countLabel}${typeLabel === null ? '' : ` in ${typeLabel} format`}. Each file can be up to ${prettifyFileSize(policy.maxFileBytes)}${totalLimit}.`;
};

/** Formats accepted MIME and extension tokens as natural-language policy copy. */
const createAcceptedFileTypesLabel = (acceptedFileTypes: readonly string[]): string | null => {
  if (acceptedFileTypes.length === 0) return null;

  const labels = [
    ...new Set(
      acceptedFileTypes.map((acceptedFileType) => {
        const knownLabel = FILE_UPLOAD_TYPE_LABELS[acceptedFileType];

        if (knownLabel !== undefined) return knownLabel;
        if (acceptedFileType === 'image/*') return 'image';
        if (acceptedFileType.startsWith('.')) return acceptedFileType.slice(1).toUpperCase();

        return acceptedFileType;
      }),
    ),
  ];

  if (labels.length === 1) return labels.join('');
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;

  return `${labels.slice(0, -1).join(', ')}, or ${labels.at(-1)}`;
};

/**
 * Extracts display-safe upload failure details while retaining the original cause.
 * @param cause The unknown rejection received from a handler or validator.
 * @param fallbackMessage Authored copy for an upload or finalization operation.
 * @returns The normalized message, optional code, and original cause.
 */
export const createFileUploadErrorDetails = (
  cause: unknown,
  fallbackMessage = DEFAULT_FILE_UPLOAD_MESSAGES.uploadFailed,
  resolveErrorFeedback: IErrorFeedbackResolver = DEFAULT_ERROR_FEEDBACK_RESOLVER,
): IFileUploadErrorDetails => {
  const feedback = resolveErrorFeedback(cause, {
    fallbackMessage,
  });

  return {
    cause,
    code: feedback.code,
    message: feedback.message,
  };
};

/**
 * Gives the display-safe feedback for a failed upload or a validator that threw.
 * @param error The unknown rejection received from a handler or validator.
 * @returns The authored message and optional public code.
 */
export const getFileUploadErrorFeedback = (
  error: unknown,
  resolveErrorFeedback: IErrorFeedbackResolver = DEFAULT_ERROR_FEEDBACK_RESOLVER,
): IFileUploadErrorFeedback =>
  resolveErrorFeedback(error, { fallbackMessage: DEFAULT_FILE_UPLOAD_MESSAGES.uploadFailed });
