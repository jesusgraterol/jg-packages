import { act, cleanup, render, renderHook } from '@testing-library/react';
import { Activity, createElement, createRef, type ReactElement } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { useFileUploadQueue } from './file-upload-queue.hook.js';
import type {
  IFileUploadControls,
  IFileUploadHandler,
  IFileUploadHandlerContext,
  IFileUploadRejectedHandler,
  IFileUploadValidationIssue,
  IUseFileUploadQueueOptions,
  IUseFileUploadQueueResult,
} from './types.js';
import { hasDraggedFiles } from './utilities.js';

type IOptions = IUseFileUploadQueueOptions<string>;

afterEach(() => {
  // Vitest runs without globals here, so Testing Library can't unmount on its own
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * Creates a promise the test settles.
 * @returns The promise and its resolve and reject functions.
 */
const createDeferred = <T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
};

/**
 * Creates a file with fixed metadata.
 * @param name The file's name.
 * @param size Its size in bytes.
 * @param type Its MIME type.
 * @param lastModified Its date, in milliseconds.
 * @returns The file.
 */
const createFile = (name: string, size = 4, type = 'image/png', lastModified = 1): File =>
  new File([new Uint8Array(size)], name, { lastModified, type });

/**
 * Lets the queue settle: the selection chain, React's effects, and the next frame's progress.
 */
const flush = async (): Promise<void> => {
  await act(async () => {
    for (let index = 0; index < 3; index += 1) {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }
  });
};

/**
 * Renders the queue with the given options.
 * @param options The options, on top of an image policy of 100 bytes per file.
 * @returns The rendered hook.
 */
const renderQueue = (options: Partial<IOptions> & Pick<IOptions, 'uploadFile'>) =>
  renderHook((props: IOptions) => useFileUploadQueue(props), {
    initialProps: { acceptedFileTypes: ['image/*'], maxFileBytes: 100, ...options },
  });

/**
 * Reads the statuses of the queue's items, by file name.
 * @param result The hook's result.
 * @returns Each file's status.
 */
const readStatuses = (result: { current: IUseFileUploadQueueResult<string> }) =>
  Object.fromEntries(result.current.items.map((item) => [item.file.name, item.status]));

describe('useFileUploadQueue', () => {
  test('admits dropped files through the same path as selected ones', async () => {
    const uploadFile = vi.fn<IFileUploadHandler<string>>(() => Promise.resolve('uploaded'));
    const { result } = renderQueue({ uploadFile, maxFiles: 2 });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(createFile('dropped.png'));
    dataTransfer.items.add(createFile('dropped.txt', 4, 'text/plain'));

    expect(hasDraggedFiles(dataTransfer.types)).toBe(true);
    act(() => {
      result.current.addFiles(dataTransfer.files);
    });
    await flush();

    expect(readStatuses(result)).toStrictEqual({
      'dropped.png': 'succeeded',
      'dropped.txt': 'rejected',
    });
    expect(uploadFile).toHaveBeenCalledTimes(1);
  });

  test('ignores new files, starts, and retries while disabled', async () => {
    const uploadFile = vi.fn<IFileUploadHandler<string>>(() => Promise.resolve('uploaded'));
    const { result } = renderQueue({ uploadFile, disabled: true, autoUpload: false });

    act(() => {
      result.current.addFiles([createFile('disabled.png')]);
      result.current.startUploads();
    });
    await flush();

    expect(result.current.items).toStrictEqual([]);
    expect(uploadFile).not.toHaveBeenCalled();
  });

  test('keeps a slow validation visible, and admits the valid files of a mixed batch', async () => {
    const validation = createDeferred<IFileUploadValidationIssue | null>();
    const upload = createDeferred<string>();
    const uploadFile = vi.fn<IFileUploadHandler<string>>(() => upload.promise);
    const onFileRejected = vi.fn();
    const validateFile = vi.fn((file: File) =>
      file.name === 'valid.png'
        ? validation.promise
        : Promise.resolve<IFileUploadValidationIssue>({
            cause: null,
            code: null,
            message: 'The image dimensions are too small.',
            reason: 'custom',
          }),
    );
    const { result } = renderQueue({ uploadFile, validateFile, onFileRejected, maxFiles: 4 });

    act(() => {
      result.current.addFiles([
        createFile('valid.png'),
        createFile('custom-rejected.png'),
        createFile('empty.png', 0),
      ]);
    });
    await flush();

    expect(readStatuses(result)).toMatchObject({ 'valid.png': 'validating' });
    expect(result.current.summary.validatingFiles).toBe(3);
    expect(uploadFile).not.toHaveBeenCalled();

    await act(async () => {
      validation.resolve(null);
      await validation.promise;
    });
    await flush();

    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(onFileRejected).toHaveBeenCalledTimes(2);
    expect(
      result.current.items.flatMap((item) =>
        item.status === 'rejected' ? [item.validationIssue.message] : [],
      ),
    ).toStrictEqual([
      'The image dimensions are too small.',
      '"empty.png" is empty and cannot be uploaded.',
    ]);
    upload.resolve('uploaded');
    await flush();
  });

  test('uploads first in, first out within the slots, and processes after the last byte', async () => {
    const uploads = [createDeferred<string>(), createDeferred<string>(), createDeferred<string>()];
    const contexts: IFileUploadHandlerContext[] = [];
    let activeUploads = 0;
    let maximumActiveUploads = 0;
    const uploadFile = vi.fn<IFileUploadHandler<string>>(async (_file, context) => {
      const upload = uploads[contexts.length];
      contexts.push(context);
      activeUploads += 1;
      maximumActiveUploads = Math.max(maximumActiveUploads, activeUploads);
      try {
        return await (upload?.promise ?? Promise.reject(new Error('No upload.')));
      } finally {
        activeUploads -= 1;
      }
    });
    const { result } = renderQueue({ uploadFile, maxConcurrentUploads: 2, maxFiles: 4 });

    act(() => {
      result.current.addFiles([
        createFile('first.png', 10),
        createFile('second.png', 30),
        createFile('third.png', 20),
      ]);
    });
    await flush();

    expect(uploadFile).toHaveBeenCalledTimes(2);
    expect(readStatuses(result)).toStrictEqual({
      'first.png': 'uploading',
      'second.png': 'uploading',
      'third.png': 'queued',
    });

    act(() => {
      contexts[0]?.reportProgress(4, 10);
      contexts[0]?.reportProgress(10, 10);
    });
    await flush();

    expect(readStatuses(result)['first.png']).toBe('processing');
    expect(result.current.items[0]?.progress.percentage).toBe(100);
    expect(result.current.summary.activeUploads).toBe(2);

    await act(async () => {
      uploads[0]?.resolve('first-result');
      await uploads[0]?.promise;
    });
    await flush();

    expect(uploadFile).toHaveBeenCalledTimes(3);
    expect(uploadFile.mock.calls[2]?.[0].name).toBe('third.png');
    expect(maximumActiveUploads).toBe(2);
    uploads[1]?.resolve('second-result');
    uploads[2]?.resolve('third-result');
    await flush();
    expect(result.current.summary.succeededFiles).toBe(3);
  });

  test('keeps a processing upload through cancel, remove, and reset', async () => {
    const upload = createDeferred<string>();
    const contexts: IFileUploadHandlerContext[] = [];
    const onUploadCanceled = vi.fn();
    const onUploadSuccess = vi.fn();
    const uploadFile = vi.fn<IFileUploadHandler<string>>((_file, context) => {
      contexts.push(context);
      return upload.promise;
    });
    const { result } = renderQueue({ uploadFile, onUploadCanceled, onUploadSuccess });
    act(() => {
      result.current.addFiles([createFile('committed.png', 10)]);
    });
    await flush();
    act(() => {
      contexts[0]?.reportProgress(10, 10);
    });
    await flush();
    const uploadId = contexts[0]?.uploadId ?? '';

    act(() => {
      result.current.cancelUpload(uploadId);
      result.current.cancelAllUploads();
      result.current.removeFile(uploadId);
      result.current.reset();
    });
    await flush();

    expect(contexts[0]?.signal.aborted).toBe(false);
    expect(readStatuses(result)).toStrictEqual({ 'committed.png': 'processing' });
    expect(onUploadCanceled).not.toHaveBeenCalled();
    expect(result.current.announcement).toBe(
      'Cancelable queue entries cleared. Processing uploads will continue.',
    );

    upload.resolve('uploaded');
    await flush();

    expect(readStatuses(result)).toStrictEqual({ 'committed.png': 'succeeded' });
    expect(onUploadSuccess).toHaveBeenCalledTimes(1);
  });

  test('waits for startUploads without autoUpload, through controlsRef too', async () => {
    const controlsRef = createRef<IFileUploadControls>();
    const uploadFile = vi.fn<IFileUploadHandler<string>>(() => Promise.resolve('uploaded'));
    const { result } = renderQueue({ uploadFile, autoUpload: false, controlsRef, maxFiles: 2 });

    act(() => {
      controlsRef.current?.addFiles([createFile('manual.png')]);
    });
    await flush();

    expect(readStatuses(result)).toStrictEqual({ 'manual.png': 'queued' });
    expect(uploadFile).not.toHaveBeenCalled();

    act(() => {
      controlsRef.current?.startUploads();
    });
    await flush();

    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(readStatuses(result)).toStrictEqual({ 'manual.png': 'succeeded' });
    expect(controlsRef.current?.addFiles).toBe(result.current.addFiles);
  });

  test('counts the existing files toward the duplicate, count, and total rules', async () => {
    const onFileRejected = vi.fn<IFileUploadRejectedHandler>();
    const uploadFile = vi.fn<IFileUploadHandler<string>>();
    const { result } = renderQueue({
      uploadFile,
      onFileRejected,
      autoUpload: false,
      existingFiles: [createFile('existing.png', 4, 'image/png', 10)],
      maxFileBytes: 10,
      maxFiles: 2,
      maxTotalBytes: 6,
      replaceSingleFile: false,
    });

    act(() => {
      result.current.addFiles([
        createFile('existing.png', 4, 'image/png', 10),
        createFile('too-much.png', 3),
        createFile('accepted.png', 2),
      ]);
    });
    await flush();

    expect(onFileRejected.mock.calls.map(([item]) => item.validationIssue.reason)).toStrictEqual([
      'duplicate-file',
      'total-size-exceeded',
    ]);
    expect(readStatuses(result)['accepted.png']).toBe('queued');
  });

  test("shows a failure's feedback, then retries it as the next attempt under the same id", async () => {
    const retry = createDeferred<string>();
    const contexts: IFileUploadHandlerContext[] = [];
    const onUploadFailure = vi.fn();
    const uploadFile = vi.fn<IFileUploadHandler<string>>((_file, context) => {
      contexts.push(context);
      return contexts.length === 1
        ? Promise.reject(Object.assign(new Error('Timed out.'), { code: 'UPLOAD_TIMEOUT' }))
        : retry.promise;
    });
    const { result } = renderQueue({
      uploadFile,
      onUploadFailure,
      getErrorFeedback: (error) => ({
        message: 'The upload took too long.',
        code: (error as { code: string }).code,
      }),
    });

    act(() => {
      result.current.addFiles([createFile('retry.png')]);
    });
    await flush();

    const [failedItem] = result.current.items;
    expect(failedItem?.status === 'failed' ? failedItem.error : undefined).toMatchObject({
      code: 'UPLOAD_TIMEOUT',
      message: 'The upload took too long.',
    });
    expect(onUploadFailure).toHaveBeenCalledTimes(1);
    expect(result.current.announcement).toBe('retry.png: The upload took too long.');

    act(() => {
      result.current.retryUpload(failedItem?.uploadId ?? '');
    });
    await flush();

    expect(contexts.map(({ uploadId, attemptNumber }) => [uploadId, attemptNumber])).toStrictEqual([
      [failedItem?.uploadId, 1],
      [failedItem?.uploadId, 2],
    ]);
    retry.resolve('uploaded');
    await flush();
    expect(readStatuses(result)).toStrictEqual({ 'retry.png': 'succeeded' });
  });

  test('aborts a canceled upload, ignores its late success, and frees its slot only when it settles', async () => {
    const upload = createDeferred<string>();
    const contexts: IFileUploadHandlerContext[] = [];
    const onUploadCanceled = vi.fn();
    const onUploadSuccess = vi.fn();
    const uploadFile = vi.fn<IFileUploadHandler<string>>((_file, context) => {
      contexts.push(context);
      return contexts.length === 1 ? upload.promise : Promise.resolve('second');
    });
    const { result } = renderQueue({
      uploadFile,
      onUploadCanceled,
      onUploadSuccess,
      maxConcurrentUploads: 1,
      maxFiles: 2,
    });
    act(() => {
      result.current.addFiles([createFile('cancel.png'), createFile('next.png')]);
    });
    await flush();

    act(() => {
      result.current.cancelUpload(contexts[0]?.uploadId ?? '');
    });
    await flush();

    expect(contexts[0]?.signal.aborted).toBe(true);
    expect(readStatuses(result)).toStrictEqual({ 'cancel.png': 'canceled', 'next.png': 'queued' });
    expect(onUploadCanceled).toHaveBeenCalledTimes(1);

    upload.resolve('late-success');
    await flush();

    expect(onUploadSuccess).toHaveBeenCalledTimes(1);
    expect(readStatuses(result)).toStrictEqual({
      'cancel.png': 'canceled',
      'next.png': 'succeeded',
    });
  });

  test('revokes the previews of a replaced file and a removed one', async () => {
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL');
    const uploadFile = vi.fn<IFileUploadHandler<string>>((file) => Promise.resolve(file.name));
    const { result } = renderQueue({ uploadFile, isPreviewEnabled: true });

    act(() => {
      result.current.addFiles([createFile('first.png')]);
    });
    await flush();
    const firstPreview = result.current.items[0]?.previewUrl;
    act(() => {
      result.current.addFiles([createFile('second.png')]);
    });
    await flush();

    expect(firstPreview).toMatch(/^blob:/);
    expect(revokeObjectURL).toHaveBeenCalledWith(firstPreview);
    expect(readStatuses(result)).toStrictEqual({ 'second.png': 'succeeded' });
    const [second] = result.current.items;

    act(() => {
      result.current.removeFile(second?.uploadId ?? '');
    });

    expect(revokeObjectURL).toHaveBeenCalledWith(second?.previewUrl);
    expect(result.current.items).toStrictEqual([]);
  });

  test('keeps the current single file when its replacement is rejected', async () => {
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL');
    const uploadFile = vi.fn<IFileUploadHandler<string>>((file) => Promise.resolve(file.name));
    const { result } = renderQueue({ uploadFile, isPreviewEnabled: true });
    act(() => {
      result.current.addFiles([createFile('current.png')]);
    });
    await flush();
    const currentPreview = result.current.items[0]?.previewUrl;

    act(() => {
      result.current.addFiles([createFile('rejected.txt', 4, 'text/plain')]);
    });
    await flush();

    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(readStatuses(result)).toStrictEqual({
      'current.png': 'succeeded',
      'rejected.txt': 'rejected',
    });
    expect(revokeObjectURL).not.toHaveBeenCalledWith(currentPreview);
  });

  test('reports errors the callbacks throw without stopping the queue', async () => {
    const rejectionError = new Error('The rejection callback failed.');
    const successError = new Error('The success callback failed.');
    const reportError = vi.fn();
    vi.stubGlobal('reportError', reportError);
    const uploadFile = vi.fn<IFileUploadHandler<string>>((file) => Promise.resolve(file.name));
    const { result } = renderQueue({
      uploadFile,
      maxFiles: 3,
      onFileRejected: () => {
        throw rejectionError;
      },
      onUploadSuccess: () => {
        throw successError;
      },
    });

    act(() => {
      result.current.addFiles([
        createFile('rejected.txt', 4, 'text/plain'),
        createFile('first.png'),
      ]);
    });
    await flush();
    act(() => {
      result.current.addFiles([createFile('second.png')]);
    });
    await flush();

    expect(uploadFile).toHaveBeenCalledTimes(2);
    expect(result.current.summary).toMatchObject({ succeededFiles: 2, rejectedFiles: 1 });
    expect(reportError).toHaveBeenCalledWith(rejectionError);
    expect(reportError).toHaveBeenCalledWith(successError);
  });

  test('starts a queued upload once in Strict Mode', async () => {
    const upload = createDeferred<string>();
    const uploadFile = vi.fn<IFileUploadHandler<string>>(() => upload.promise);
    const { result } = renderHook((props: IOptions) => useFileUploadQueue(props), {
      initialProps: { acceptedFileTypes: ['image/*'], maxFileBytes: 100, uploadFile },
      reactStrictMode: true,
    });

    act(() => {
      result.current.addFiles([createFile('strict.png')]);
    });
    await flush();

    expect(uploadFile).toHaveBeenCalledTimes(1);
    upload.resolve('uploaded');
    await flush();
    expect(readStatuses(result)).toStrictEqual({ 'strict.png': 'succeeded' });
  });

  test('aborts running uploads and revokes previews on unmount', async () => {
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL');
    const upload = createDeferred<string>();
    const signals: AbortSignal[] = [];
    const onUploadSuccess = vi.fn();
    const uploadFile = vi.fn<IFileUploadHandler<string>>((_file, { signal }) => {
      signals.push(signal);
      return upload.promise;
    });
    const { result, unmount } = renderQueue({
      uploadFile,
      onUploadSuccess,
      isPreviewEnabled: true,
    });
    act(() => {
      result.current.addFiles([createFile('unmount.png')]);
    });
    await flush();
    const preview = result.current.items[0]?.previewUrl;

    unmount();

    expect(signals[0]?.aborted).toBe(true);
    expect(revokeObjectURL).toHaveBeenCalledWith(preview);
    upload.resolve('late-success');
    await upload.promise;
    expect(onUploadSuccess).not.toHaveBeenCalled();
  });

  test('cancels the work an <Activity> stopped once it shows again, with new previews', async () => {
    const validation = createDeferred<IFileUploadValidationIssue | null>();
    const upload = createDeferred<string>();
    const contexts: IFileUploadHandlerContext[] = [];
    const onUploadCanceled = vi.fn();
    const uploadFile = vi.fn<IFileUploadHandler<string>>((_file, context) => {
      contexts.push(context);
      return upload.promise;
    });
    const results: IUseFileUploadQueueResult<string>[] = [];
    const Queue = (): null => {
      results.push(
        useFileUploadQueue({
          acceptedFileTypes: ['image/*'],
          maxFileBytes: 100,
          maxFiles: 3,
          isPreviewEnabled: true,
          uploadFile,
          validateFile: (file) => (file.name === 'slow.png' ? validation.promise : null),
          onUploadCanceled,
        }),
      );
      return null;
    };
    const renderActivity = (mode: 'visible' | 'hidden'): ReactElement =>
      createElement(Activity, { mode, children: createElement(Queue) });
    const view = render(renderActivity('visible'));
    const latest = (): IUseFileUploadQueueResult<string> | undefined => results.at(-1);
    act(() => {
      latest()?.addFiles([createFile('uploading.png'), createFile('processing.png', 10)]);
    });
    await flush();
    act(() => {
      contexts[1]?.reportProgress(10, 10);
      latest()?.addFiles([createFile('slow.png')]);
    });
    await flush();
    const oldPreview = latest()?.items[0]?.previewUrl;
    expect(latest()?.items.map(({ status }) => status)).toStrictEqual([
      'uploading',
      'processing',
      'validating',
    ]);

    view.rerender(renderActivity('hidden'));
    await flush();
    view.rerender(renderActivity('visible'));
    await flush();

    expect(latest()?.items.map(({ status }) => status)).toStrictEqual([
      'canceled',
      'canceled',
      'canceled',
    ]);
    expect(onUploadCanceled).toHaveBeenCalledTimes(3);
    expect(latest()?.items[0]?.previewUrl).toMatch(/^blob:/);
    expect(latest()?.items[0]?.previewUrl).not.toBe(oldPreview);
    upload.resolve('late');
    validation.resolve(null);
    await flush();
    expect(latest()?.items.map(({ status }) => status)).toStrictEqual([
      'canceled',
      'canceled',
      'canceled',
    ]);
    act(() => {
      latest()?.retryUpload(latest()?.items[0]?.uploadId ?? '');
    });
    await flush();
    expect(uploadFile).toHaveBeenCalledTimes(3);
  });

  test('cancels, removes, and clears work that has not committed, and ignores retries that do not fit', async () => {
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL');
    const uploads = [createDeferred<string>(), createDeferred<string>()];
    const contexts: IFileUploadHandlerContext[] = [];
    const onUploadCanceled = vi.fn();
    const uploadFile = vi.fn<IFileUploadHandler<string>>((_file, context) => {
      contexts.push(context);
      return uploads[contexts.length - 1]?.promise ?? Promise.resolve('more');
    });
    const { result, rerender } = renderQueue({
      uploadFile,
      onUploadCanceled,
      isPreviewEnabled: true,
      maxConcurrentUploads: 1,
      maxFiles: 4,
    });
    act(() => {
      result.current.addFiles([]);
      result.current.addFiles([createFile('a.png'), createFile('b.png'), createFile('c.png')]);
    });
    await flush();
    expect(readStatuses(result)).toStrictEqual({
      'a.png': 'uploading',
      'b.png': 'queued',
      'c.png': 'queued',
    });

    act(() => {
      result.current.removeFile(contexts[0]?.uploadId ?? '');
    });
    expect(contexts[0]?.signal.aborted).toBe(true);
    expect(Object.keys(readStatuses(result))).toStrictEqual(['b.png', 'c.png']);

    act(() => {
      result.current.cancelAllUploads();
    });
    expect(readStatuses(result)).toStrictEqual({ 'b.png': 'canceled', 'c.png': 'canceled' });
    expect(onUploadCanceled).toHaveBeenCalledTimes(3);

    const [canceledB] = result.current.items;
    rerender({
      acceptedFileTypes: ['image/*'],
      maxFileBytes: 100,
      maxFiles: 4,
      uploadFile,
      onUploadCanceled,
      isPreviewEnabled: true,
      disabled: true,
    });
    act(() => {
      result.current.retryUpload(canceledB?.uploadId ?? '');
      result.current.retryUpload('unknown');
    });
    expect(readStatuses(result)['b.png']).toBe('canceled');

    act(() => {
      result.current.reset();
    });
    expect(result.current.items).toStrictEqual([]);
    expect(result.current.announcement).toBe('Upload queue cleared.');
    expect(revokeObjectURL).toHaveBeenCalledTimes(3);
    uploads[0]?.resolve('late');
    await flush();
    expect(result.current.items).toStrictEqual([]);
  });

  test('rejects a file whose validator throws, unless it was canceled meanwhile', async () => {
    const thrown = createDeferred<IFileUploadValidationIssue | null>();
    const canceled = createDeferred<IFileUploadValidationIssue | null>();
    const onFileRejected = vi.fn();
    const uploadFile = vi.fn<IFileUploadHandler<string>>();
    const { result } = renderQueue({
      uploadFile,
      onFileRejected,
      autoUpload: false,
      maxFiles: 4,
      validateFile: (file) => (file.name === 'thrown.png' ? thrown.promise : canceled.promise),
    });
    act(() => {
      result.current.addFiles([createFile('thrown.png')]);
    });
    await flush();
    await act(async () => {
      thrown.reject(new Error('Image decoding failed.'));
      await thrown.promise.catch(() => undefined);
    });
    await flush();

    const [rejected] = result.current.items;
    expect(rejected?.status === 'rejected' ? rejected.validationIssue : undefined).toMatchObject({
      reason: 'custom',
      code: null,
      message: 'We could not upload this file. Check the file and try again.',
    });

    act(() => {
      result.current.addFiles([createFile('canceled.png')]);
    });
    await flush();
    act(() => {
      result.current.cancelUpload(result.current.items[1]?.uploadId ?? '');
    });
    await act(async () => {
      canceled.reject(new Error('Aborted.'));
      await canceled.promise.catch(() => undefined);
    });
    await flush();

    expect(readStatuses(result)['canceled.png']).toBe('canceled');
    expect(onFileRejected).toHaveBeenCalledTimes(1);
  });

  test('checks a file again after its validator, against the queue as it is then', async () => {
    const validation = createDeferred<IFileUploadValidationIssue | null>();
    const uploadFile = vi.fn<IFileUploadHandler<string>>();
    const options: IOptions = {
      acceptedFileTypes: ['image/*'],
      maxFileBytes: 100,
      maxFiles: 2,
      replaceSingleFile: false,
      autoUpload: false,
      uploadFile,
      validateFile: () => validation.promise,
    };
    const { result, rerender } = renderHook((props: IOptions) => useFileUploadQueue(props), {
      initialProps: options,
    });
    act(() => {
      result.current.addFiles([createFile('late.png')]);
    });
    await flush();

    rerender({ ...options, existingFiles: [createFile('one.png'), createFile('two.png')] });
    await act(async () => {
      validation.resolve(null);
      await validation.promise;
    });
    await flush();

    const [item] = result.current.items;
    expect(item?.status === 'rejected' ? item.validationIssue.reason : undefined).toBe(
      'file-count-exceeded',
    );
  });

  test('skips a file canceled while an earlier file of its selection validates', async () => {
    const validation = createDeferred<IFileUploadValidationIssue | null>();
    const uploadFile = vi.fn<IFileUploadHandler<string>>();
    const { result } = renderQueue({
      uploadFile,
      autoUpload: false,
      maxFiles: 4,
      validateFile: (file) => (file.name === 'first.png' ? validation.promise : null),
    });
    act(() => {
      result.current.addFiles([createFile('first.png'), createFile('second.png')]);
    });
    await flush();

    act(() => {
      result.current.cancelUpload(result.current.items[1]?.uploadId ?? '');
    });
    await act(async () => {
      validation.resolve(null);
      await validation.promise;
    });
    await flush();

    expect(readStatuses(result)).toStrictEqual({ 'first.png': 'queued', 'second.png': 'canceled' });
  });

  test("ignores progress from a canceled or an earlier attempt, and a canceled upload's failure", async () => {
    const uploads = [createDeferred<string>(), createDeferred<string>()];
    const contexts: IFileUploadHandlerContext[] = [];
    const onUploadFailure = vi.fn();
    const uploadFile = vi.fn<IFileUploadHandler<string>>((_file, context) => {
      contexts.push(context);
      return uploads[contexts.length - 1]?.promise ?? Promise.resolve('more');
    });
    const { result } = renderQueue({ uploadFile, onUploadFailure });
    act(() => {
      result.current.addFiles([createFile('photo.png', 10)]);
    });
    await flush();
    const uploadId = contexts[0]?.uploadId ?? '';

    act(() => {
      result.current.cancelUpload(uploadId);
      contexts[0]?.reportProgress(5, 10);
    });
    await flush();
    expect(result.current.items[0]?.progress.uploadedBytes).toBe(0);

    act(() => {
      result.current.retryUpload(uploadId);
    });
    await flush();
    // the canceled attempt holds the item's slot until its promise settles
    expect(readStatuses(result)).toStrictEqual({ 'photo.png': 'queued' });
    expect(uploadFile).toHaveBeenCalledTimes(1);

    uploads[0]?.reject(new Error('Aborted.'));
    await flush();
    expect(onUploadFailure).not.toHaveBeenCalled();
    expect(uploadFile).toHaveBeenCalledTimes(2);

    act(() => {
      contexts[0]?.reportProgress(8, 10);
      contexts[1]?.reportProgress(3, 10);
    });
    await flush();
    expect(result.current.items[0]?.progress.uploadedBytes).toBe(3);
    uploads[1]?.resolve('done');
    await flush();
    expect(readStatuses(result)).toStrictEqual({ 'photo.png': 'succeeded' });
  });

  test('stops a selection and its waiting progress when the hook unmounts', async () => {
    const validation = createDeferred<IFileUploadValidationIssue | null>();
    const upload = createDeferred<string>();
    const contexts: IFileUploadHandlerContext[] = [];
    const validateFile = vi.fn((file: File) =>
      file.name === 'first.png' ? validation.promise : null,
    );
    const uploadFile = vi.fn<IFileUploadHandler<string>>((_file, context) => {
      contexts.push(context);
      return upload.promise;
    });
    const cancelAnimationFrame = vi.spyOn(window, 'cancelAnimationFrame');
    const { result, unmount } = renderQueue({ uploadFile, validateFile, maxFiles: 4 });
    act(() => {
      result.current.addFiles([createFile('uploading.png')]);
    });
    await flush();
    act(() => {
      result.current.addFiles([createFile('first.png'), createFile('second.png')]);
      contexts[0]?.reportProgress(5, 10);
    });

    unmount();
    validation.resolve(null);
    upload.resolve('late');
    await flush();

    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(validateFile).toHaveBeenCalledTimes(1);
    expect(uploadFile).toHaveBeenCalledTimes(1);
  });

  test('aborts a running upload on reset, and ignores a retry of a running one', async () => {
    const upload = createDeferred<string>();
    const contexts: IFileUploadHandlerContext[] = [];
    const onUploadCanceled = vi.fn();
    const uploadFile = vi.fn<IFileUploadHandler<string>>((_file, context) => {
      contexts.push(context);
      return upload.promise;
    });
    const { result } = renderQueue({ uploadFile, onUploadCanceled });
    act(() => {
      result.current.addFiles([createFile('running.png')]);
    });
    await flush();

    act(() => {
      result.current.retryUpload(contexts[0]?.uploadId ?? '');
    });
    expect(readStatuses(result)).toStrictEqual({ 'running.png': 'uploading' });

    act(() => {
      result.current.reset();
    });
    expect(contexts[0]?.signal.aborted).toBe(true);
    expect(onUploadCanceled).toHaveBeenCalledTimes(1);
    expect(result.current.items).toStrictEqual([]);
    upload.resolve('late');
    await flush();
  });

  test('aborts the current single upload once its replacement validates', async () => {
    const uploads = [createDeferred<string>(), createDeferred<string>()];
    const contexts: IFileUploadHandlerContext[] = [];
    const onUploadCanceled = vi.fn();
    const uploadFile = vi.fn<IFileUploadHandler<string>>((_file, context) => {
      contexts.push(context);
      return uploads[contexts.length - 1]?.promise ?? Promise.resolve('more');
    });
    const { result } = renderQueue({ uploadFile, onUploadCanceled });
    act(() => {
      result.current.addFiles([createFile('current.png')]);
    });
    await flush();

    act(() => {
      result.current.addFiles([createFile('replacement.png')]);
    });
    await flush();

    expect(contexts[0]?.signal.aborted).toBe(true);
    expect(onUploadCanceled).toHaveBeenCalledTimes(1);
    expect(Object.keys(readStatuses(result))).toStrictEqual(['replacement.png']);
    uploads[0]?.resolve('late');
    await flush();
    expect(uploadFile).toHaveBeenCalledTimes(2);
    uploads[1]?.resolve('done');
    await flush();
    expect(readStatuses(result)).toStrictEqual({ 'replacement.png': 'succeeded' });
  });

  test('keeps its result when a parent renders again with equal options', () => {
    const uploadFile = vi.fn<IFileUploadHandler<string>>();
    const options = (): IOptions => ({
      acceptedFileTypes: ['image/*'],
      maxFileBytes: 100,
      uploadFile,
      messages: { queued: (fileName) => `${fileName} is waiting.` },
    });
    const { result, rerender } = renderHook((props: IOptions) => useFileUploadQueue(props), {
      initialProps: options(),
    });
    const first = result.current;

    rerender(options());

    expect(result.current).toBe(first);
    expect(result.current.policy).toBe(first.policy);
  });
});
