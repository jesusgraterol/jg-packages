import { describe, expect, test } from 'vitest';
import { Exception } from 'jg-exception';
import type { IFileUploadPolicy } from 'jg-react';

import {
  createFileUploadErrorDetails,
  createFileUploadPolicyDescription,
  getFileUploadErrorFeedback,
} from './utilities.js';

/** Creates a normalized policy fixture for user-facing copy tests. */
const createFileUploadPolicy = (overrides: Partial<IFileUploadPolicy> = {}): IFileUploadPolicy => ({
  acceptedFileTypes: [],
  allowDuplicateFiles: false,
  autoUpload: true,
  maxConcurrentUploads: 1,
  maxFileBytes: 1024,
  maxFiles: 1,
  maxTotalBytes: null,
  replaceSingleFile: true,
  ...overrides,
});

describe('createFileUploadPolicyDescription', () => {
  test.each([
    [createFileUploadPolicy(), 'Add one file. Each file can be up to 1.00 kB.'],
    [
      createFileUploadPolicy({ acceptedFileTypes: ['application/x-owned'] }),
      'Add one file in application/x-owned format. Each file can be up to 1.00 kB.',
    ],
    [
      createFileUploadPolicy({ acceptedFileTypes: ['application/pdf'], maxFiles: 2 }),
      'Add up to 2 files in PDF format. Each file can be up to 1.00 kB.',
    ],
    [
      createFileUploadPolicy({
        acceptedFileTypes: ['image/jpeg', 'image/png'],
        maxFileBytes: 2048,
        maxFiles: 4,
        maxTotalBytes: 4096,
      }),
      'Add up to 4 files in JPEG or PNG format. Each file can be up to 2.00 kB, with 4.00 kB total.',
    ],
    [
      createFileUploadPolicy({
        acceptedFileTypes: ['image/*', '.heic', 'text/plain'],
        maxFiles: 2,
      }),
      'Add up to 2 files in image, HEIC, or plain text format. Each file can be up to 1.00 kB.',
    ],
    [
      createFileUploadPolicy({
        acceptedFileTypes: ['image/*', 'application/pdf', '.csv', 'text/csv'],
        maxFiles: 4,
      }),
      'Add up to 4 files in image, PDF, or CSV format. Each file can be up to 1.00 kB.',
    ],
  ])('formats normalized policy %o', (policy, expectedDescription) => {
    expect(createFileUploadPolicyDescription(policy)).toBe(expectedDescription);
  });
});

describe('createFileUploadErrorDetails', () => {
  test('preserves a coded Exception without duplicating the visible code', () => {
    const error = new Exception('Upload failed.', { code: 'UPLOAD_FAILED' });

    expect(createFileUploadErrorDetails(error)).toStrictEqual({
      cause: error,
      code: null,
      message: 'We could not upload this file. Check the file and try again.',
    });
  });

  test('normalizes native and custom-validation failures', () => {
    const error = new Error('Image dimensions are invalid.');

    expect(createFileUploadErrorDetails(error)).toStrictEqual({
      cause: error,
      code: null,
      message: 'We could not upload this file. Check the file and try again.',
    });
    expect(getFileUploadErrorFeedback(error)).toStrictEqual({
      code: null,
      isAccessDenied: false,
      isCancelled: false,
      message: 'We could not upload this file. Check the file and try again.',
    });
  });
});
