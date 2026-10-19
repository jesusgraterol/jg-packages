import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';
import {
  createFileUploadAcceptValue,
  getAdmittedFileUploadFiles,
  resolveFileUploadPolicy,
} from './transformers.js';
import type { IFileUploadItem, IFileUploadPolicyOptions } from './types.js';
import { createValidatingFileUploadItem, fileUploadReducer } from './utilities.js';

/**
 * Creates a file with fixed metadata.
 * @param name The file's name.
 * @param size Its size in bytes.
 * @param type Its MIME type.
 * @returns The file.
 */
const createFile = (name: string, size: number, type = ''): File =>
  new File([new Uint8Array(size)], name, { lastModified: 1, type });

describe('resolveFileUploadPolicy', () => {
  test('normalizes the accepted types and fills in bounded defaults', () => {
    expect(
      resolveFileUploadPolicy({
        acceptedFileTypes: [' IMAGE/PNG ', '.JPG', 'image/png'],
        maxConcurrentUploads: 8,
        maxFileBytes: 1024,
        maxFiles: 4,
      }),
    ).toStrictEqual({
      acceptedFileTypes: ['image/png', '.jpg'],
      allowDuplicateFiles: false,
      autoUpload: true,
      maxConcurrentUploads: 4,
      maxFileBytes: 1024,
      maxFiles: 4,
      maxTotalBytes: null,
      replaceSingleFile: false,
    });
  });

  test('accepts an empty type list as accepting every type', () => {
    const policy = resolveFileUploadPolicy({ acceptedFileTypes: [], maxFileBytes: 1024 });

    expect(policy.acceptedFileTypes).toStrictEqual([]);
    expect(policy.replaceSingleFile).toBe(true);
    expect(createFileUploadAcceptValue(policy.acceptedFileTypes)).toBeUndefined();
    expect(createFileUploadAcceptValue(['image/png', '.jpg'])).toBe('image/png,.jpg');
  });

  test.each<[Record<string, unknown>, string]>([
    [
      { acceptedFileTypes: 'image/png', maxFileBytes: 1 },
      'The accepted file types must be an array.',
    ],
    [{ acceptedFileTypes: [7], maxFileBytes: 1 }, 'Each accepted file type must be a string.'],
    [
      { acceptedFileTypes: ['image'], maxFileBytes: 1 },
      'Each accepted file type must be a file extension, such as .png, or a MIME type, such as image/png.',
    ],
    [
      { acceptedFileTypes: [''], maxFileBytes: 1 },
      'Each accepted file type must be a file extension, such as .png, or a MIME type, such as image/png.',
    ],
    [
      { acceptedFileTypes: [], maxFileBytes: 0 },
      'The maximum file size must be a positive integer of bytes.',
    ],
    [
      { acceptedFileTypes: [], maxFileBytes: 1, maxFiles: 0 },
      'The maximum file count must be a positive integer.',
    ],
    [
      { acceptedFileTypes: [], maxConcurrentUploads: 0, maxFileBytes: 1 },
      'The maximum concurrent uploads must be a positive integer.',
    ],
    [
      { acceptedFileTypes: [], maxFileBytes: 1, maxTotalBytes: 0 },
      'The maximum total size must be a positive integer of bytes, when given.',
    ],
  ])('throws INVALID_FILE_UPLOAD_POLICY for %o', (options, message) => {
    expectToThrowCode(
      () => resolveFileUploadPolicy(options as IFileUploadPolicyOptions),
      ERRORS.INVALID_FILE_UPLOAD_POLICY,
      message,
    );
  });
});

describe('getAdmittedFileUploadFiles', () => {
  test('leaves validating and rejected items out of the limits', () => {
    const validatingItem = createValidatingFileUploadItem(
      createFile('validating.png', 1, 'image/png'),
      'validating',
    );
    const [queuedItem] = fileUploadReducer<null>([validatingItem], {
      type: 'queue',
      uploadId: validatingItem.uploadId,
      previewUrl: null,
    });
    const rejectedSource = createValidatingFileUploadItem(
      createFile('rejected.png', 1, 'image/png'),
      'rejected',
    );
    const [rejectedItem] = fileUploadReducer<null>([rejectedSource], {
      type: 'reject',
      uploadId: rejectedSource.uploadId,
      issue: { cause: null, code: null, message: 'Rejected.', reason: 'custom' },
    });
    if (queuedItem === undefined || rejectedItem === undefined) {
      throw new Error('The reducer dropped an item.');
    }
    const items: readonly IFileUploadItem<null>[] = [validatingItem, queuedItem, rejectedItem];

    expect(getAdmittedFileUploadFiles(items)).toStrictEqual([queuedItem.file]);
  });
});
