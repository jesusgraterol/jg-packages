import { describe, expect, test } from 'vitest';

import { resolveFileUploadPolicy } from './transformers.js';
import type { IFileUploadAction, IFileUploadItem } from './types.js';
import {
  createCustomFileUploadValidationIssue,
  createFileUploadErrorDetails,
  createFileUploadSummary,
  createInitialFileUploadProgress,
  createValidatingFileUploadItem,
  fileUploadReducer,
  getCandidateAdmissionFiles,
  hasDraggedFiles,
  normalizeFileUploadProgress,
} from './utilities.js';

/**
 * Creates a PNG file with fixed metadata.
 * @param name The file's name.
 * @param size Its size in bytes.
 * @returns The file.
 */
const createFile = (name: string, size: number): File =>
  new File([new Uint8Array(size)], name, { lastModified: 1, type: 'image/png' });

// what the queue shows for a failure without an app's feedback
const DEFAULT_FEEDBACK = () => ({ message: 'The upload failed.', code: null });

describe('normalizeFileUploadProgress', () => {
  test('keeps the first valid total, and never lets the uploaded bytes go back', () => {
    const initial = createInitialFileUploadProgress(10);
    const first = normalizeFileUploadProgress(initial, 5, 20);
    const decreasing = normalizeFileUploadProgress(first, 2, 40);
    const complete = normalizeFileUploadProgress(decreasing, 30, 40);

    expect(first).toStrictEqual({
      hasReportedProgress: true,
      percentage: 25,
      totalBytes: 20,
      uploadedBytes: 5,
    });
    expect(decreasing).toBe(first);
    expect(complete).toStrictEqual({
      hasReportedProgress: true,
      percentage: 100,
      totalBytes: 20,
      uploadedBytes: 20,
    });
  });

  test.each([
    [Number.NaN, 10],
    [1, Number.POSITIVE_INFINITY],
    [-1, 10],
    [1, 0],
    [0.5, 10],
    [1, Number.MAX_SAFE_INTEGER + 1],
  ])('ignores the report (%s, %s)', (uploadedBytes, totalBytes) => {
    const current = createInitialFileUploadProgress(10);

    expect(normalizeFileUploadProgress(current, uploadedBytes, totalBytes)).toBe(current);
  });
});

describe('createFileUploadErrorDetails', () => {
  test("gives the feedback's message and code, keeping the error as the cause", () => {
    const error = Object.assign(new Error('Upload timed out.'), { code: 'UPLOAD_TIMEOUT' });

    expect(createFileUploadErrorDetails(error, DEFAULT_FEEDBACK)).toStrictEqual({
      cause: error,
      code: null,
      message: 'The upload failed.',
    });
    expect(
      createFileUploadErrorDetails(error, (cause) => ({
        message: 'The upload took too long. Try again.',
        code: (cause as { code: string }).code,
      })),
    ).toStrictEqual({
      cause: error,
      code: 'UPLOAD_TIMEOUT',
      message: 'The upload took too long. Try again.',
    });
  });

  test("turns a validator's error into a custom issue the same way", () => {
    const error = new Error('Image dimensions are invalid.');

    expect(createCustomFileUploadValidationIssue(error, DEFAULT_FEEDBACK)).toStrictEqual({
      cause: error,
      code: null,
      message: 'The upload failed.',
      reason: 'custom',
    });
  });
});

describe('fileUploadReducer', () => {
  test('moves one item to success, keeping the identity of every other item', () => {
    const first = createValidatingFileUploadItem(createFile('first.png', 10), 'first');
    const second = createValidatingFileUploadItem(createFile('second.png', 20), 'second');
    const queued = fileUploadReducer<string>([first, second], {
      type: 'queue',
      uploadId: 'first',
      previewUrl: 'blob:first',
    });
    const uploading = fileUploadReducer(queued, {
      type: 'start',
      uploadId: 'first',
      attemptNumber: 1,
    });
    const processing = fileUploadReducer(uploading, {
      type: 'progress',
      uploadId: 'first',
      attemptNumber: 1,
      uploadedBytes: 10,
      totalBytes: 10,
    });
    const succeeded = fileUploadReducer(processing, {
      type: 'succeed',
      uploadId: 'first',
      attemptNumber: 1,
      result: 'https://example.com/first.png',
    });

    expect(queued[1]).toBe(second);
    expect(uploading[1]).toBe(second);
    expect(processing[0]?.status).toBe('processing');
    expect(succeeded[0]).toMatchObject({
      attemptNumber: 1,
      result: 'https://example.com/first.png',
      status: 'succeeded',
      uploadId: 'first',
    });
    expect(succeeded[1]).toBe(second);
  });

  test("ignores an earlier attempt's late outcome", () => {
    const validating = createValidatingFileUploadItem(createFile('photo.png', 10), 'photo');
    const queued = fileUploadReducer<string>([validating], {
      type: 'queue',
      uploadId: 'photo',
      previewUrl: null,
    });
    const uploading = fileUploadReducer(queued, {
      type: 'start',
      uploadId: 'photo',
      attemptNumber: 2,
    });

    expect(
      fileUploadReducer(uploading, {
        type: 'succeed',
        uploadId: 'photo',
        attemptNumber: 1,
        result: 'stale',
      }),
    ).toBe(uploading);
  });

  test('cancels and retries an item under its id, keeping its attempt number', () => {
    const validating = createValidatingFileUploadItem(createFile('photo.png', 10), 'photo');
    const queued = fileUploadReducer<null>([validating], {
      type: 'queue',
      uploadId: 'photo',
      previewUrl: null,
    });
    const uploading = fileUploadReducer(queued, {
      type: 'start',
      uploadId: 'photo',
      attemptNumber: 1,
    });
    const canceled = fileUploadReducer(uploading, { type: 'cancel', uploadId: 'photo' });
    const retried = fileUploadReducer(canceled, { type: 'retry', uploadId: 'photo' });

    expect(canceled[0]).toMatchObject({ attemptNumber: 1, status: 'canceled', uploadId: 'photo' });
    expect(retried[0]).toMatchObject({ attemptNumber: 1, status: 'queued', uploadId: 'photo' });
  });

  test('restores interrupted items as canceled, with new preview URLs, keeping the rest', () => {
    const validating = createValidatingFileUploadItem(createFile('validating.png', 10), 'v');
    const queuedSource = createValidatingFileUploadItem(createFile('queued.png', 10), 'q');
    let items: readonly IFileUploadItem<null>[] = [validating, queuedSource];
    items = fileUploadReducer(items, { type: 'queue', uploadId: 'q', previewUrl: 'blob:old' });
    const queued = items[1];

    const restored = fileUploadReducer(items, {
      type: 'restore',
      interruptedIds: new Set(['v']),
      previewUrls: new Map([['q', 'blob:new']]),
    });

    expect(restored[0]).toMatchObject({ status: 'canceled', uploadId: 'v' });
    expect(restored[1]).toMatchObject({ status: 'queued', previewUrl: 'blob:new' });
    expect(
      fileUploadReducer(restored, {
        type: 'restore',
        interruptedIds: new Set(['q']),
        previewUrls: new Map([['q', 'blob:new']]),
      }),
    ).toBe(restored);
    expect(queued?.previewUrl).toBe('blob:old');
  });
});

describe('fileUploadReducer, ignoring what does not fit', () => {
  const validating = createValidatingFileUploadItem(createFile('photo.png', 10), 'photo');
  const queued = fileUploadReducer<string>([validating], {
    type: 'queue',
    uploadId: 'photo',
    previewUrl: null,
  });
  const uploading = fileUploadReducer(queued, {
    type: 'start',
    uploadId: 'photo',
    attemptNumber: 1,
  });
  const processing = fileUploadReducer(uploading, {
    type: 'progress',
    uploadId: 'photo',
    attemptNumber: 1,
    uploadedBytes: 10,
    totalBytes: 10,
  });
  const succeeded = fileUploadReducer(processing, {
    type: 'succeed',
    uploadId: 'photo',
    attemptNumber: 1,
    result: 'done',
  });
  const failed = fileUploadReducer(uploading, {
    type: 'fail',
    uploadId: 'photo',
    attemptNumber: 1,
    error: { cause: null, code: null, message: 'Failed.' },
  });

  test.each<[string, readonly IFileUploadItem<string>[], IFileUploadAction<string>]>([
    ['an empty selection', queued, { type: 'add-validating', items: [] }],
    ['queuing a queued item', queued, { type: 'queue', uploadId: 'photo', previewUrl: null }],
    [
      'rejecting a queued item',
      queued,
      {
        type: 'reject',
        uploadId: 'photo',
        issue: { cause: null, code: null, message: 'No.', reason: 'custom' },
      },
    ],
    [
      'starting an uploading item',
      uploading,
      { type: 'start', uploadId: 'photo', attemptNumber: 2 },
    ],
    [
      'progress for a queued item',
      queued,
      { type: 'progress', uploadId: 'photo', attemptNumber: 0, uploadedBytes: 5, totalBytes: 10 },
    ],
    [
      'progress for an earlier attempt',
      uploading,
      { type: 'progress', uploadId: 'photo', attemptNumber: 0, uploadedBytes: 5, totalBytes: 10 },
    ],
    [
      'progress that changes nothing',
      processing,
      { type: 'progress', uploadId: 'photo', attemptNumber: 1, uploadedBytes: 10, totalBytes: 10 },
    ],
    [
      'success for a queued item',
      queued,
      { type: 'succeed', uploadId: 'photo', attemptNumber: 0, result: 'done' },
    ],
    [
      'a failure for a succeeded item',
      succeeded,
      {
        type: 'fail',
        uploadId: 'photo',
        attemptNumber: 1,
        error: { cause: null, code: null, message: 'Failed.' },
      },
    ],
    [
      'a failure for an earlier attempt',
      uploading,
      {
        type: 'fail',
        uploadId: 'photo',
        attemptNumber: 0,
        error: { cause: null, code: null, message: 'Failed.' },
      },
    ],
    ['canceling a processing item', processing, { type: 'cancel', uploadId: 'photo' }],
    ['retrying a succeeded item', succeeded, { type: 'retry', uploadId: 'photo' }],
    ['removing a processing item', processing, { type: 'remove', uploadId: 'photo' }],
    ['removing an unknown item', queued, { type: 'remove', uploadId: 'unknown' }],
    ['resetting only processing items', processing, { type: 'reset' }],
    ['a transition for an unknown item', queued, { type: 'cancel', uploadId: 'unknown' }],
  ])('keeps the same items for %s', (_, items, action) => {
    expect(fileUploadReducer(items, action)).toBe(items);
  });

  test('retries a failed item, and resets every item but the processing ones', () => {
    expect(fileUploadReducer(failed, { type: 'retry', uploadId: 'photo' })[0]?.status).toBe(
      'queued',
    );
    expect(fileUploadReducer([...queued, ...processing], { type: 'reset' })).toStrictEqual(
      processing,
    );
  });
});

describe('getCandidateAdmissionFiles', () => {
  const policy = resolveFileUploadPolicy({ acceptedFileTypes: [], maxFileBytes: 100 });
  const queued = fileUploadReducer<null>(
    [createValidatingFileUploadItem(createFile('current.png', 10), 'current')],
    { type: 'queue', uploadId: 'current', previewUrl: null },
  );
  const current = queued[0]?.file;

  test('leaves the current single file out, so its replacement can be admitted', () => {
    expect(getCandidateAdmissionFiles([], queued, new Set(['new']), policy, false)).toStrictEqual(
      [],
    );
  });

  test('counts the current file once a replacement is admitted, or with existing files', () => {
    const existing = createFile('existing.png', 10);

    expect(getCandidateAdmissionFiles([], queued, new Set(['new']), policy, true)).toStrictEqual([
      current,
    ]);
    expect(
      getCandidateAdmissionFiles([existing], queued, new Set(['new']), policy, false),
    ).toStrictEqual([existing, current]);
  });

  test('counts a processing file, which no replacement can remove', () => {
    const processing = fileUploadReducer(
      fileUploadReducer(queued, { type: 'start', uploadId: 'current', attemptNumber: 1 }),
      {
        type: 'progress',
        uploadId: 'current',
        attemptNumber: 1,
        uploadedBytes: 10,
        totalBytes: 10,
      },
    );

    expect(
      getCandidateAdmissionFiles([], processing, new Set(['new']), policy, false),
    ).toStrictEqual([current]);
  });
});

describe('createFileUploadSummary', () => {
  test('weighs progress by bytes, leaving out rows not admitted', () => {
    let items: readonly IFileUploadItem<null>[] = [
      createValidatingFileUploadItem(createFile('first.png', 100), 'first'),
      createValidatingFileUploadItem(createFile('second.png', 300), 'second'),
      createValidatingFileUploadItem(createFile('rejected.png', 1000), 'rejected'),
    ];
    items = fileUploadReducer(items, { type: 'queue', uploadId: 'first', previewUrl: null });
    items = fileUploadReducer(items, { type: 'queue', uploadId: 'second', previewUrl: null });
    items = fileUploadReducer(items, {
      type: 'reject',
      uploadId: 'rejected',
      issue: { cause: null, code: null, message: 'Rejected.', reason: 'custom' },
    });
    items = fileUploadReducer(items, { type: 'start', uploadId: 'first', attemptNumber: 1 });
    items = fileUploadReducer(items, { type: 'start', uploadId: 'second', attemptNumber: 1 });
    items = fileUploadReducer(items, {
      type: 'progress',
      uploadId: 'first',
      attemptNumber: 1,
      uploadedBytes: 50,
      totalBytes: 100,
    });
    items = fileUploadReducer(items, {
      type: 'progress',
      uploadId: 'second',
      attemptNumber: 1,
      uploadedBytes: 75,
      totalBytes: 300,
    });

    expect(createFileUploadSummary(items)).toStrictEqual({
      activeUploads: 2,
      canceledFiles: 0,
      failedFiles: 0,
      progress: { hasReportedProgress: true, percentage: 31, totalBytes: 400, uploadedBytes: 125 },
      queuedFiles: 0,
      rejectedFiles: 1,
      succeededFiles: 0,
      totalFiles: 3,
      validatingFiles: 0,
    });
  });
});

describe('hasDraggedFiles', () => {
  test.each<[string[], boolean]>([
    [['Files'], true],
    [['text/plain', 'Files'], true],
    [['text/plain'], false],
    [[], false],
  ])('hasDraggedFiles(%o) -> %s', (types, expected) => {
    expect(hasDraggedFiles(types)).toBe(expected);
  });
});
