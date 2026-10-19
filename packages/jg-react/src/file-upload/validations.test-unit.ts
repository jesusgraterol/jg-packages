import { describe, expect, test } from 'vitest';

import { DEFAULT_FILE_UPLOAD_MESSAGES } from './constants.js';
import { resolveFileUploadPolicy } from './transformers.js';
import {
  areFilesDuplicates,
  doesFileMatchAcceptedType,
  validateFileUploadCandidate,
} from './validations.js';

/**
 * Creates a file with fixed metadata.
 * @param name The file's name.
 * @param size Its size in bytes.
 * @param type Its MIME type.
 * @param lastModified Its date, in milliseconds.
 * @returns The file.
 */
const createFile = (name: string, size: number, type = '', lastModified = 1): File =>
  new File([new Uint8Array(size)], name, { lastModified, type });

describe('doesFileMatchAcceptedType', () => {
  test.each<[string, string, string[], boolean]>([
    ['photo.PNG', 'image/png', ['image/png'], true],
    ['photo.png', 'image/png', ['image/*'], true],
    ['photo.JPG', '', ['.jpg'], true],
    ['archive.tar.gz', '', ['.tar.gz'], true],
    ['photo.png', 'application/octet-stream', ['image/*'], false],
    ['photo.png', '', ['image/png'], false],
    ['document.pdf', 'application/pdf', [], true],
  ])('doesFileMatchAcceptedType(%s, %s, %o) -> %s', (name, type, acceptedFileTypes, expected) => {
    expect(doesFileMatchAcceptedType(createFile(name, 1, type), acceptedFileTypes)).toBe(expected);
  });
});

describe('areFilesDuplicates', () => {
  test('needs the same name, size, type, and date', () => {
    const original = createFile('photo.png', 4, 'image/png', 10);

    expect(areFilesDuplicates(original, createFile('photo.png', 4, 'image/png', 10))).toBe(true);
    expect(areFilesDuplicates(original, createFile('photo.png', 4, 'image/png', 11))).toBe(false);
    expect(areFilesDuplicates(original, createFile('photo.png', 5, 'image/png', 10))).toBe(false);
  });
});

describe('validateFileUploadCandidate', () => {
  const policy = resolveFileUploadPolicy({
    acceptedFileTypes: ['image/*', '.jpg'],
    maxFileBytes: 4,
    maxFiles: 2,
    maxTotalBytes: 7,
  });

  test.each<[File, File[], string]>([
    [createFile('empty.png', 0, 'image/png'), [], 'empty-file'],
    [createFile('document.pdf', 1, 'application/pdf'), [], 'unsupported-file-type'],
    [createFile('large.png', 5, 'image/png'), [], 'file-too-large'],
    [
      createFile('photo.png', 2, 'image/png', 10),
      [createFile('photo.png', 2, 'image/png', 10)],
      'duplicate-file',
    ],
    [
      createFile('third.png', 1, 'image/png'),
      [createFile('first.png', 1, 'image/png'), createFile('second.png', 1, 'image/png')],
      'file-count-exceeded',
    ],
    [
      createFile('second.png', 4, 'image/png'),
      [createFile('first.png', 4, 'image/png')],
      'total-size-exceeded',
    ],
  ])('gives the first issue for %s', (file, admittedFiles, reason) => {
    expect(validateFileUploadCandidate(file, admittedFiles, policy)?.reason).toBe(reason);
  });

  test('accepts files exactly at the file and total limits', () => {
    expect(
      validateFileUploadCandidate(
        createFile('second.jpg', 4),
        [createFile('first.png', 3, 'image/png')],
        policy,
      ),
    ).toBeNull();
  });

  test.each([
    [5_000_001, '1 byte'],
    [5_000_002, '2 bytes'],
  ])('gives the exact excess when the rounded sizes are equal (%d bytes)', (size, excess) => {
    const issue = validateFileUploadCandidate(createFile('screen.png', size, 'image/png'), [], {
      ...policy,
      maxFileBytes: 5_000_000,
      maxTotalBytes: null,
    });

    expect(issue?.reason).toBe('file-too-large');
    expect(issue?.message).toBe(
      `"screen.png" exceeds the 4.77 MB maximum file size (5,000,000 bytes) by ${excess}.`,
    );
  });

  test('names one file, or several, in the count issue', () => {
    const file = createFile('second.png', 1, 'image/png');
    const admitted = [createFile('first.png', 1, 'image/png')];

    expect(validateFileUploadCandidate(file, admitted, { ...policy, maxFiles: 1 })?.message).toBe(
      'Only 1 file can be uploaded at a time.',
    );
    expect(
      validateFileUploadCandidate(file, [...admitted, createFile('other.png', 1, 'image/png')], {
        ...policy,
        maxTotalBytes: null,
      })?.message,
    ).toBe('Only 2 files can be uploaded at a time.');
  });

  test('admits duplicates when the policy allows them', () => {
    const duplicate = createFile('photo.png', 2, 'image/png', 10);

    expect(
      validateFileUploadCandidate(duplicate, [duplicate], { ...policy, allowDuplicateFiles: true }),
    ).toBeNull();
  });

  test('words every issue with the given messages', () => {
    const messages = {
      ...DEFAULT_FILE_UPLOAD_MESSAGES,
      emptyFile: (name: string) => `${name} vacío`,
    };

    expect(
      validateFileUploadCandidate(createFile('empty.png', 0, 'image/png'), [], policy, messages),
    ).toStrictEqual({ cause: null, code: null, message: 'empty.png vacío', reason: 'empty-file' });
  });
});
