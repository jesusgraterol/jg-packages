import { prettifyFileSize, prettifyNumber } from 'jg-utilities';

import type { IFileUploadMessages } from './types.js';

// one file, as for an avatar, unless the policy admits more
export const FILE_UPLOAD_DEFAULT_MAX_FILES = 1;

// two uploads at once, which keeps the browser's and the API's load predictable
export const FILE_UPLOAD_DEFAULT_MAX_CONCURRENT_UPLOADS = 2;

// an accepted file extension, such as `.png` or `.tar.gz`
export const FILE_UPLOAD_EXTENSION_PATTERN = /^\.[a-z0-9][a-z0-9._+-]*$/i;

// an accepted MIME type, such as `image/png` or `image/*`, without parameters
export const FILE_UPLOAD_MIME_TYPE_PATTERN =
  /^[a-z0-9][a-z0-9!#$&^_.+-]*\/(?:\*|[a-z0-9][a-z0-9!#$&^_.+-]*)$/i;

// the queue's text in English, which messages overrides
export const DEFAULT_FILE_UPLOAD_MESSAGES: IFileUploadMessages = {
  emptyFile: (fileName) => `"${fileName}" is empty and cannot be uploaded.`,
  unsupportedFileType: (fileName, acceptedFileTypes) =>
    `"${fileName}" is not an accepted file type. Choose ${acceptedFileTypes.join(', ')}.`,
  fileTooLarge: (fileName, maxFileBytes, excessBytes) =>
    `"${fileName}" exceeds the ${prettifyFileSize(maxFileBytes)} maximum file size (${prettifyNumber(maxFileBytes)} bytes) by ${prettifyNumber(excessBytes)} ${excessBytes === 1 ? 'byte' : 'bytes'}.`,
  duplicateFile: (fileName) => `"${fileName}" is already in the upload queue.`,
  fileCountExceeded: (maxFiles) =>
    `Only ${String(maxFiles)} ${maxFiles === 1 ? 'file' : 'files'} can be uploaded at a time.`,
  totalSizeExceeded: (fileName, maxTotalBytes) =>
    `Adding "${fileName}" would exceed the ${prettifyFileSize(maxTotalBytes)} total upload limit.`,
  uploadFailed: 'We could not upload this file. Check the file and try again.',
  fileIssue: (fileName, message) => `${fileName}: ${message}`,
  queued: (fileName) => `${fileName}: Queued.`,
  uploadStarted: (fileName) => `${fileName}: Upload started.`,
  uploadComplete: (fileName) => `${fileName}: Upload complete.`,
  canceled: (fileName) => `${fileName}: Canceled.`,
  queuedForRetry: (fileName) => `${fileName}: Queued for retry.`,
  queueCleared: 'Upload queue cleared.',
  queueClearedWhileProcessing:
    'Cancelable queue entries cleared. Processing uploads will continue.',
};
