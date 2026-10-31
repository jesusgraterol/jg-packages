import type { IFileUploadRejectedHandler } from 'jg-react';
import { requireFixture } from './file-upload.test-utils.js';
import * as React from 'react';
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createErrorFeedback, Exception } from 'jg-exception';
import type {
  IFileUploadControls,
  IFileUploadHandler,
  IFileUploadHandlerContext,
  IFileUploadItem,
  IFileUploadItemsChangeHandler,
  IFileUploadValidationIssue,
} from 'jg-react';

import { FileUpload } from './file-upload.component.js';
import { ErrorFeedbackProvider } from '../error-feedback-provider/index.js';

const revokeObjectUrlMock = vi.fn<(url: string) => void>();

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

// deferred promises expose pending upload and validation states to tests.
type IDeferred<TResult> = {
  promise: Promise<TResult>;
  reject: (reason?: unknown) => void;
  resolve: (result: TResult) => void;
};

/**
 * Creates a manually controlled promise.
 * @returns The promise and its resolve/reject controls.
 */
const createDeferred = <TResult,>(): IDeferred<TResult> => {
  let rejectDeferred: ((reason?: unknown) => void) | null = null;
  let resolveDeferred: ((result: TResult) => void) | null = null;
  const promise = new Promise<TResult>((resolve, reject) => {
    rejectDeferred = reject;
    resolveDeferred = resolve;
  });

  if (rejectDeferred === null || resolveDeferred === null) {
    throw new Error('Deferred promise controls were not initialized.');
  }

  return {
    promise,
    reject: rejectDeferred,
    resolve: resolveDeferred,
  };
};

/**
 * Creates a deterministic browser file.
 * @param name The file name.
 * @param size The file size in bytes.
 * @param type The browser-reported MIME type.
 * @param lastModified The browser-reported modification timestamp.
 * @returns A File with the requested metadata.
 */
const createFile = (name: string, size = 4, type = 'image/png', lastModified = 1): File =>
  new File([new Uint8Array(size)], name, {
    lastModified,
    type,
  });

/**
 * Dispatches a native input selection with deterministic files.
 * @param input The native file input.
 * @param files The selected files.
 */
const selectFiles = (input: HTMLInputElement, files: readonly File[]): void => {
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: files,
  });
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

/**
 * Flushes serialized selection, React effects, and fallback animation frames.
 * @returns A promise that resolves after pending zero-delay browser work.
 */
const flushFileUpload = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await Promise.resolve();
  });
};

/**
 * Retrieves the FileUpload native input.
 * @param container The rendered component container.
 * @returns The native file input.
 */
const getFileInput = (container: HTMLElement): HTMLInputElement => {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');

  if (input === null) {
    throw new Error('FileUpload input was not rendered.');
  }

  return input;
};

/** Returns a button by its visible accessible name. */
const getButton = (container: HTMLElement, name: string): HTMLButtonElement => {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === name,
  );
  if (button === undefined) throw new Error(`Button "${name}" was not rendered.`);
  return button;
};

describe('FileUpload', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn((file: File) => `blob:${file.name}`),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectUrlMock,
    });
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback): number =>
        window.setTimeout(() => callback(performance.now()), 0),
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      value: (frameId: number): void => window.clearTimeout(frameId),
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('nested file drags remain active until the final leave and unrelated drags stay native', () => {
    const uploadFile = vi.fn<IFileUploadHandler<string>>();
    const render = (disabled = false) =>
      root.render(
        <FileUpload
          acceptedFileTypes={[]}
          maxFileBytes={1024}
          maxFiles={1}
          disabled={disabled}
          description="Choose a document"
          inputProps={{ 'aria-describedby': 'external-help' }}
          isPolicyVisible={false}
          uploadFile={uploadFile}
        />,
      );
    act(() => render());
    const area = container.querySelector<HTMLElement>('[data-slot="file-upload-drop-zone"]');
    if (area === null) throw new Error('The drop target was not rendered.');
    const dispatch = (type: string, hasFiles = true) => {
      const transfer = new DataTransfer();
      if (hasFiles) transfer.items.add(createFile('notes.txt', 4, 'text/plain'));
      else transfer.setData('text/plain', 'ordinary selection');
      const event = new DragEvent(type, {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      });
      act(() => {
        area.dispatchEvent(event);
      });
      return event;
    };
    const input = getFileInput(container);
    expect(input.getAttribute('aria-describedby')).toContain('external-help');
    expect(input.multiple).toBe(false);
    expect(container.textContent).toContain('Any file type');
    dispatch('dragenter');
    dispatch('dragenter');
    expect(area.hasAttribute('data-drag-active')).toBe(true);
    expect(dispatch('dragover').defaultPrevented).toBe(true);
    dispatch('dragleave');
    expect(area.hasAttribute('data-drag-active')).toBe(true);
    dispatch('dragleave');
    expect(area.hasAttribute('data-drag-active')).toBe(false);
    for (const type of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      expect(dispatch(type, false).defaultPrevented).toBe(false);
    }
    act(() => render(true));
    for (const type of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      expect(dispatch(type).defaultPrevented).toBe(false);
    }
    expect(area.hasAttribute('data-drag-active')).toBe(false);
    expect(uploadFile).not.toHaveBeenCalled();
  });

  test('shows reviewed scoped error copy and its code while retaining private upload diagnostics', async () => {
    const failure = new Exception('Private storage diagnostics', { code: 'STORAGE_DOWN' });
    const onUploadFailure = vi.fn();
    const resolver = createErrorFeedback({
      fallbackMessage: 'Upload unavailable.',
      messagesByCode: { STORAGE_DOWN: 'Storage is temporarily unavailable.' },
    });
    act(() =>
      root.render(
        <ErrorFeedbackProvider resolveErrorFeedback={resolver}>
          <FileUpload
            acceptedFileTypes={[]}
            maxFileBytes={1024}
            uploadFile={() => Promise.reject(failure)}
            onUploadFailure={onUploadFailure}
          />
        </ErrorFeedbackProvider>,
      ),
    );
    act(() => selectFiles(getFileInput(container), [createFile('notes.txt', 4, 'text/plain')]));
    await flushFileUpload();
    expect(container.textContent).toContain('Storage is temporarily unavailable.');
    expect(container.textContent).toContain('Code STORAGE_DOWN');
    expect(container.textContent).not.toContain('Private storage diagnostics');
    expect(onUploadFailure).toHaveBeenCalledOnce();
  });

  test('an empty native file selection preserves the queue and aggregate policy', () => {
    const uploadFile = vi.fn<IFileUploadHandler<string>>();
    act(() =>
      root.render(
        <FileUpload
          acceptedFileTypes={[]}
          maxFileBytes={1024}
          maxFiles={1}
          maxTotalBytes={2048}
          uploadFile={uploadFile}
        />,
      ),
    );
    const input = getFileInput(container);
    Object.defineProperty(input, 'files', { configurable: true, value: null });
    act(() => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.textContent).toContain('2.00 kB total, 1 file maximum.');
    expect(uploadFile).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  test('renders an accessible native policy and keyboard-operable browse action', () => {
    const uploadFile = vi.fn<IFileUploadHandler<string>>();

    act(() => {
      root.render(
        <FileUpload
          acceptedFileTypes={['image/*', '.jpg']}
          description="Use a square profile image."
          label="Profile image"
          maxFileBytes={1024}
          maxFiles={4}
          uploadFile={uploadFile}
        />,
      );
    });

    const input = getFileInput(container);
    const label = container.querySelector<HTMLLabelElement>('label');
    const browseButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Choose files'),
    );
    const inputClick = vi.spyOn(input, 'click').mockImplementation(() => undefined);

    expect(label?.htmlFor).toBe(input.id);
    expect(label?.textContent).toBe('Profile image');
    expect(input.accept).toBe('image/*,.jpg');
    expect(input.multiple).toBe(true);
    expect(input.getAttribute('aria-describedby')).toContain('description');
    expect(container.textContent).toContain('Use a square profile image.');
    expect(container.textContent).toContain('1.00 kB per file');
    expect(browseButton?.tagName).toBe('BUTTON');

    act(() => {
      browseButton?.click();
    });

    expect(inputClick).toHaveBeenCalledTimes(1);
  });

  test('uses the same admission path for dropped files', async () => {
    const uploadDeferred = createDeferred<string>();
    const uploadFile = vi.fn<IFileUploadHandler<string>>(() => uploadDeferred.promise);

    act(() => {
      root.render(
        <FileUpload
          acceptedFileTypes={['image/*']}
          maxFileBytes={1024}
          uploadFile={uploadFile}
        />,
      );
    });

    const dropZone = container.querySelector<HTMLElement>('[data-slot="file-upload-drop-zone"]');
    const dropEvent = new Event('drop', { bubbles: true, cancelable: true });

    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: {
        files: [createFile('dropped.png')],
        types: ['Files'],
      },
    });

    act(() => {
      dropZone?.dispatchEvent(dropEvent);
    });
    await flushFileUpload();

    expect(dropEvent.defaultPrevented).toBe(true);
    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('dropped.png');

    await act(async () => {
      uploadDeferred.resolve('uploaded');
      await uploadDeferred.promise;
    });
  });

  test('disables selection and visible queue commands without canceling work implicitly', async () => {
    const uploadDeferred = createDeferred<string>();
    const uploadFile = vi.fn<IFileUploadHandler<string>>(() => uploadDeferred.promise);

    act(() => {
      root.render(
        <FileUpload
          acceptedFileTypes={['image/*']}
          disabled
          maxFileBytes={100}
          uploadFile={uploadFile}
        />,
      );
    });

    const input = getFileInput(container);
    const browseButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Choose file'),
    );

    expect(input.disabled).toBe(true);
    expect(browseButton?.disabled).toBe(true);

    act(() => {
      selectFiles(input, [createFile('disabled.png')]);
    });
    await flushFileUpload();

    expect(uploadFile).not.toHaveBeenCalled();
    expect(container.querySelector('[data-slot="file-upload-item"]')).toBeNull();
  });

  test('keeps asynchronous validation visible and admits valid members of a mixed batch', async () => {
    const validationDeferred = createDeferred<IFileUploadValidationIssue | null>();
    const uploadDeferred = createDeferred<string>();
    const uploadFile = vi.fn<IFileUploadHandler<string>>(() => uploadDeferred.promise);
    const onFileRejected = vi.fn<IFileUploadRejectedHandler>();
    const validateFile = vi.fn((file: File) =>
      file.name === 'valid.png'
        ? validationDeferred.promise
        : Promise.resolve<IFileUploadValidationIssue | null>({
            cause: null,
            code: null,
            message: 'The image dimensions are too small.',
            reason: 'custom',
          }),
    );

    act(() => {
      root.render(
        <FileUpload
          acceptedFileTypes={['image/*']}
          maxFileBytes={10}
          maxFiles={4}
          uploadFile={uploadFile}
          validateFile={validateFile}
          onFileRejected={onFileRejected}
        />,
      );
    });

    act(() => {
      selectFiles(getFileInput(container), [
        createFile('valid.png'),
        createFile('custom-rejected.png'),
        createFile('empty.png', 0),
      ]);
    });
    await flushFileUpload();

    expect(container.querySelector('[data-status="validating"]')?.textContent).toContain(
      'valid.png',
    );
    expect(uploadFile).not.toHaveBeenCalled();

    await act(async () => {
      validationDeferred.resolve(null);
      await validationDeferred.promise;
    });
    await flushFileUpload();

    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('The image dimensions are too small.');
    expect(container.textContent).toContain('"empty.png" is empty and cannot be uploaded.');
    expect(onFileRejected).toHaveBeenCalledTimes(2);

    await act(async () => {
      uploadDeferred.resolve('uploaded');
      await uploadDeferred.promise;
    });
  });

  test('bounds FIFO concurrency and separates byte upload from result processing', async () => {
    const deferredUploads = [
      createDeferred<string>(),
      createDeferred<string>(),
      createDeferred<string>(),
    ];
    const handlerContexts: IFileUploadHandlerContext[] = [];
    let activeUploads = 0;
    let maximumActiveUploads = 0;
    const uploadFile = vi.fn<IFileUploadHandler<string>>((_file, context) => {
      const deferredUpload = requireFixture(deferredUploads[handlerContexts.length]);

      handlerContexts.push(context);
      activeUploads += 1;
      maximumActiveUploads = Math.max(maximumActiveUploads, activeUploads);

      return deferredUpload.promise.finally(() => {
        activeUploads -= 1;
      });
    });

    act(() => {
      root.render(
        <FileUpload
          acceptedFileTypes={['image/*']}
          maxConcurrentUploads={2}
          maxFileBytes={100}
          maxFiles={4}
          uploadFile={uploadFile}
        />,
      );
    });

    act(() => {
      selectFiles(getFileInput(container), [
        createFile('first.png', 10),
        createFile('second.png', 30),
        createFile('third.png', 20),
      ]);
    });
    await flushFileUpload();

    expect(uploadFile).toHaveBeenCalledTimes(2);
    expect(maximumActiveUploads).toBe(2);
    expect(container.querySelectorAll('[data-status="queued"]')).toHaveLength(1);
    expect(container.textContent).not.toContain('Overall progress');
    expect(container.querySelector('[aria-label="Overall upload progress"]')).toBeNull();
    expect(container.querySelectorAll('[role="progressbar"]')).toHaveLength(2);
    expect(
      Array.from(container.querySelectorAll('[role="progressbar"]')).every(
        (progress) =>
          progress.getAttribute('aria-valuenow') === '0' &&
          !progress.hasAttribute('data-indeterminate'),
      ),
    ).toBe(true);

    act(() => {
      requireFixture(handlerContexts[0]).reportProgress(10, 10);
    });
    await flushFileUpload();

    expect(
      Array.from(container.querySelectorAll('[data-slot="file-upload-item"]'))
        .find((item) => item.textContent?.includes('first.png'))
        ?.getAttribute('data-status'),
    ).toBe('processing');
    expect(container.textContent).toContain('Waiting for the upload result');
    expect(
      Array.from(container.querySelectorAll('[data-slot="file-upload-item"]'))
        .find((item) => item.textContent?.includes('first.png'))
        ?.querySelector('[role="progressbar"]')
        ?.getAttribute('aria-valuenow'),
    ).toBe('100');

    await act(async () => {
      requireFixture(deferredUploads[0]).resolve('first-result');
      await requireFixture(deferredUploads[0]).promise;
    });
    await flushFileUpload();

    expect(uploadFile).toHaveBeenCalledTimes(3);
    expect(maximumActiveUploads).toBe(2);
    expect(requireFixture(uploadFile.mock.calls[2])[0].name).toBe('third.png');

    await act(async () => {
      requireFixture(deferredUploads[1]).resolve('second-result');
      requireFixture(deferredUploads[2]).resolve('third-result');
      await Promise.all([
        requireFixture(deferredUploads[1]).promise,
        requireFixture(deferredUploads[2]).promise,
      ]);
    });
  });

  test('preserves committed processing work across cancellation and reset controls', async () => {
    const controlsRef = createRef<IFileUploadControls>();
    const uploadDeferred = createDeferred<string>();
    const contexts: IFileUploadHandlerContext[] = [];
    const onUploadCanceled = vi.fn();
    const onUploadSuccess = vi.fn();
    const uploadFile = vi.fn<IFileUploadHandler<string>>((_file, context) => {
      contexts.push(context);
      return uploadDeferred.promise;
    });

    act(() => {
      root.render(
        <FileUpload
          acceptedFileTypes={['image/*']}
          controlsRef={controlsRef}
          maxFileBytes={100}
          uploadFile={uploadFile}
          onUploadCanceled={onUploadCanceled}
          onUploadSuccess={onUploadSuccess}
        />,
      );
    });

    act(() => {
      selectFiles(getFileInput(container), [createFile('committed.png', 10)]);
    });
    await flushFileUpload();

    act(() => {
      requireFixture(contexts[0]).reportProgress(10, 10);
    });
    await flushFileUpload();

    const uploadId = requireFixture(contexts[0]).uploadId;
    expect(container.querySelector('[data-status="processing"]')).not.toBeNull();
    expect(
      container.querySelector<HTMLElement>('[data-slot="file-upload-drop-zone"]')?.hidden,
    ).toBe(true);
    expect(
      Array.from(container.querySelectorAll('button')).some((button) =>
        button.getAttribute('aria-label')?.includes('Cancel committed.png'),
      ),
    ).toBe(false);
    expect(container.textContent).not.toContain('Cancel all');

    act(() => {
      controlsRef.current?.cancelUpload(uploadId);
      controlsRef.current?.cancelAllUploads();
      controlsRef.current?.removeFile(uploadId);
      controlsRef.current?.reset();
    });
    await flushFileUpload();

    expect(requireFixture(contexts[0]).signal.aborted).toBe(false);
    expect(container.querySelector('[data-status="processing"]')).not.toBeNull();
    expect(onUploadCanceled).not.toHaveBeenCalled();
    expect(getButton(container, 'Show upload area').getAttribute('aria-expanded')).toBe('false');

    await act(async () => {
      uploadDeferred.resolve('uploaded');
      await uploadDeferred.promise;
    });
    await flushFileUpload();

    expect(container.querySelector('[data-status="succeeded"]')).not.toBeNull();
    expect(onUploadSuccess).toHaveBeenCalledTimes(1);
  });

  test('waits for manual start and exposes the same action through controlsRef', async () => {
    const controlsRef = createRef<IFileUploadControls>();
    const uploadDeferred = createDeferred<string>();
    const uploadFile = vi.fn<IFileUploadHandler<string>>(() => uploadDeferred.promise);

    act(() => {
      root.render(
        <FileUpload
          acceptedFileTypes={['image/*']}
          autoUpload={false}
          controlsRef={controlsRef}
          maxFileBytes={100}
          maxFiles={2}
          uploadFile={uploadFile}
        />,
      );
    });

    act(() => {
      controlsRef.current?.addFiles([createFile('manual.png')]);
    });
    await flushFileUpload();

    expect(uploadFile).not.toHaveBeenCalled();
    expect(container.querySelector('[data-status="queued"]')).not.toBeNull();
    expect(container.textContent).toContain('Start uploads');

    act(() => {
      controlsRef.current?.startUploads();
    });
    await flushFileUpload();

    expect(uploadFile).toHaveBeenCalledTimes(1);

    await act(async () => {
      uploadDeferred.resolve('uploaded');
      await uploadDeferred.promise;
    });
  });

  test('counts existing files across duplicate, count, and aggregate-size admission rules', async () => {
    const controlsRef = createRef<IFileUploadControls>();
    const existingFile = createFile('existing.png', 4, 'image/png', 10);
    const onFileRejected = vi.fn<IFileUploadRejectedHandler>();
    const uploadFile = vi.fn<IFileUploadHandler<string>>();

    act(() => {
      root.render(
        <FileUpload
          acceptedFileTypes={['image/*']}
          autoUpload={false}
          controlsRef={controlsRef}
          existingFiles={[existingFile]}
          maxFileBytes={10}
          maxFiles={2}
          maxTotalBytes={6}
          replaceSingleFile={false}
          uploadFile={uploadFile}
          onFileRejected={onFileRejected}
        />,
      );
    });

    act(() => {
      controlsRef.current?.addFiles([
        createFile('existing.png', 4, 'image/png', 10),
        createFile('too-much.png', 3),
        createFile('accepted.png', 2),
      ]);
    });
    await flushFileUpload();

    expect(onFileRejected.mock.calls.map(([item]) => item.validationIssue.reason)).toStrictEqual([
      'duplicate-file',
      'total-size-exceeded',
    ]);
    expect(container.querySelector('[data-status="queued"]')?.textContent).toContain(
      'accepted.png',
    );
    expect(uploadFile).not.toHaveBeenCalled();
  });

  test('preserves coded failures and retries the same upload id as the next attempt', async () => {
    const retryDeferred = createDeferred<string>();
    const contexts: IFileUploadHandlerContext[] = [];
    const onUploadFailure = vi.fn();
    const uploadFile = vi.fn<IFileUploadHandler<string>>((_file, context) => {
      contexts.push(context);

      if (contexts.length === 1) {
        return Promise.reject(new Exception('The upload timed out.', { code: 'UPLOAD_TIMEOUT' }));
      }

      return retryDeferred.promise;
    });

    act(() => {
      root.render(
        <FileUpload
          acceptedFileTypes={['image/*']}
          maxFileBytes={100}
          uploadFile={uploadFile}
          onUploadFailure={onUploadFailure}
        />,
      );
    });

    act(() => {
      selectFiles(getFileInput(container), [createFile('retry.png')]);
    });
    await flushFileUpload();

    const failedItem = container.querySelector<HTMLElement>('[data-status="failed"]');

    expect(failedItem?.textContent).toContain(
      'We could not upload this file. Check the file and try again.',
    );
    expect(failedItem?.textContent).not.toContain('Code UPLOAD_TIMEOUT');
    expect(failedItem?.textContent).not.toContain('Waiting for progress');
    expect(failedItem?.querySelector('[role="progressbar"]')).toBeNull();
    expect(onUploadFailure).toHaveBeenCalledTimes(1);
    expect(uploadFile).toHaveBeenCalledTimes(1);

    const retryButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.getAttribute('aria-label')?.includes('Retry retry.png'),
    );

    act(() => {
      retryButton?.click();
    });
    await flushFileUpload();

    expect(uploadFile).toHaveBeenCalledTimes(2);
    expect(requireFixture(contexts[1]).uploadId).toBe(requireFixture(contexts[0]).uploadId);
    expect(contexts.map((context) => context.attemptNumber)).toStrictEqual([1, 2]);

    await act(async () => {
      retryDeferred.resolve('uploaded');
      await retryDeferred.promise;
    });
  });

  test('aborts active work, classifies cancellation, and ignores late success', async () => {
    const uploadDeferred = createDeferred<string>();
    const contexts: IFileUploadHandlerContext[] = [];
    const onUploadCanceled = vi.fn();
    const onUploadSuccess = vi.fn();
    const uploadFile = vi.fn<IFileUploadHandler<string>>((_file, context) => {
      contexts.push(context);
      return uploadDeferred.promise;
    });

    act(() => {
      root.render(
        <FileUpload
          acceptedFileTypes={['image/*']}
          maxFileBytes={100}
          uploadFile={uploadFile}
          onUploadCanceled={onUploadCanceled}
          onUploadSuccess={onUploadSuccess}
        />,
      );
    });

    act(() => {
      selectFiles(getFileInput(container), [createFile('cancel.png')]);
    });
    await flushFileUpload();

    const cancelButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.getAttribute('aria-label')?.includes('Cancel cancel.png'),
    );

    act(() => {
      cancelButton?.click();
    });

    expect(requireFixture(contexts[0]).signal.aborted).toBe(true);
    expect(container.querySelector('[data-status="canceled"]')).not.toBeNull();
    expect(onUploadCanceled).toHaveBeenCalledTimes(1);

    await act(async () => {
      uploadDeferred.resolve('late-success');
      await uploadDeferred.promise;
    });
    await flushFileUpload();

    expect(onUploadSuccess).not.toHaveBeenCalled();
    expect(container.querySelector('[data-status="canceled"]')).not.toBeNull();
  });

  test('revokes previews on replacement and removal', async () => {
    const uploadFile = vi.fn<IFileUploadHandler<string>>((file) => Promise.resolve(file.name));
    const renderPreview = (item: IFileUploadItem<string>): React.ReactNode =>
      item.previewUrl === null ? null : (
        <img
          src={item.previewUrl}
          alt={`Preview of ${item.file.name}`}
        />
      );

    act(() => {
      root.render(
        <FileUpload
          acceptedFileTypes={['image/*']}
          maxFileBytes={100}
          renderPreview={renderPreview}
          uploadFile={uploadFile}
        />,
      );
    });

    act(() => {
      selectFiles(getFileInput(container), [createFile('first.png')]);
    });
    await flushFileUpload();

    expect(container.querySelector('img')?.src).toContain('blob:first.png');

    act(() => {
      selectFiles(getFileInput(container), [createFile('second.png')]);
    });
    await flushFileUpload();

    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:first.png');
    expect(container.querySelector('img')?.src).toContain('blob:second.png');

    const removeButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.getAttribute('aria-label')?.includes('Remove second.png'),
    );

    act(() => {
      removeButton?.click();
    });

    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:second.png');
    expect(container.querySelector('[data-slot="file-upload-item"]')).toBeNull();
  });

  test('preserves the current single file when its replacement is rejected', async () => {
    const uploadFile = vi.fn<IFileUploadHandler<string>>((file) => Promise.resolve(file.name));
    const renderPreview = (item: IFileUploadItem<string>): React.ReactNode =>
      item.previewUrl === null ? null : (
        <img
          src={item.previewUrl}
          alt={`Preview of ${item.file.name}`}
        />
      );

    act(() => {
      root.render(
        <FileUpload
          acceptedFileTypes={['image/*']}
          maxFileBytes={100}
          renderPreview={renderPreview}
          uploadFile={uploadFile}
        />,
      );
    });

    act(() => {
      selectFiles(getFileInput(container), [createFile('current.png')]);
    });
    await flushFileUpload();

    act(() => {
      selectFiles(getFileInput(container), [createFile('rejected.txt', 4, 'text/plain')]);
    });
    await flushFileUpload();

    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(container.querySelector('img')?.src).toContain('blob:current.png');
    expect(container.querySelector('[data-status="rejected"]')?.textContent).toContain(
      'rejected.txt',
    );
    expect(revokeObjectUrlMock).not.toHaveBeenCalledWith('blob:current.png');
  });

  test('emits typed success results and avoids rerendering an unchanged preview row', async () => {
    const deferredUploads = [createDeferred<{ url: string }>(), createDeferred<{ url: string }>()];
    const contexts: IFileUploadHandlerContext[] = [];
    const onItemsChange = vi.fn();
    const onUploadSuccess = vi.fn();
    const renderPreview = vi.fn((item: IFileUploadItem<{ url: string }>) => item.file.name);
    const uploadFile = vi.fn<IFileUploadHandler<{ url: string }>>((_file, context) => {
      const deferredUpload = requireFixture(deferredUploads[contexts.length]);

      contexts.push(context);
      return deferredUpload.promise;
    });

    act(() => {
      root.render(
        <FileUpload
          acceptedFileTypes={['image/*']}
          maxConcurrentUploads={2}
          maxFileBytes={100}
          maxFiles={2}
          renderPreview={renderPreview}
          uploadFile={uploadFile}
          onItemsChange={onItemsChange}
          onUploadSuccess={onUploadSuccess}
        />,
      );
    });

    act(() => {
      selectFiles(getFileInput(container), [
        createFile('first.png', 10),
        createFile('second.png', 20),
      ]);
    });
    await flushFileUpload();
    renderPreview.mockClear();

    const notificationCount = onItemsChange.mock.calls.length;
    act(() => getButton(container, 'Show upload area').click());
    act(() => getButton(container, 'Hide upload area').click());
    expect(renderPreview).not.toHaveBeenCalled();
    expect(onItemsChange).toHaveBeenCalledTimes(notificationCount);

    act(() => {
      requireFixture(contexts[0]).reportProgress(5, 10);
    });
    await flushFileUpload();

    expect(renderPreview).toHaveBeenCalledTimes(1);
    expect(requireFixture(renderPreview.mock.calls[0])[0].file.name).toBe('first.png');

    await act(async () => {
      requireFixture(deferredUploads[0]).resolve({ url: 'https://example.com/first.png' });
      await requireFixture(deferredUploads[0]).promise;
    });
    await flushFileUpload();

    expect(onUploadSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        result: { url: 'https://example.com/first.png' },
        status: 'succeeded',
      }),
    );
    expect(onItemsChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          result: { url: 'https://example.com/first.png' },
          status: 'succeeded',
        }),
      ]),
      expect.objectContaining({ succeededFiles: 1 }),
    );

    await act(async () => {
      requireFixture(deferredUploads[1]).resolve({ url: 'https://example.com/second.png' });
      await requireFixture(deferredUploads[1]).promise;
    });
  });

  test('reports callback errors without interrupting the current or future queue', async () => {
    const rejectionCallbackError = new Error('The rejection callback failed.');
    const successCallbackError = new Error('The success callback failed.');
    const reportError = vi.fn();
    const uploadFile = vi.fn<IFileUploadHandler<string>>((file) => Promise.resolve(file.name));

    vi.stubGlobal('reportError', reportError);

    act(() => {
      root.render(
        <FileUpload
          acceptedFileTypes={['image/*']}
          maxFileBytes={100}
          maxFiles={3}
          uploadFile={uploadFile}
          onFileRejected={() => {
            throw rejectionCallbackError;
          }}
          onUploadSuccess={() => {
            throw successCallbackError;
          }}
        />,
      );
    });

    act(() => {
      selectFiles(getFileInput(container), [
        createFile('rejected.txt', 4, 'text/plain'),
        createFile('first.png'),
      ]);
    });
    await flushFileUpload();

    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(uploadFile.mock.calls[0]?.[0].name).toBe('first.png');
    expect(container.querySelectorAll('[data-status="succeeded"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-status="rejected"]')).toHaveLength(1);

    act(() => {
      selectFiles(getFileInput(container), [createFile('second.png')]);
    });
    await flushFileUpload();

    expect(uploadFile).toHaveBeenCalledTimes(2);
    expect(container.querySelectorAll('[data-status="succeeded"]')).toHaveLength(2);
    expect(reportError).toHaveBeenCalledWith(rejectionCallbackError);
    expect(reportError).toHaveBeenCalledWith(successCallbackError);
  });

  test('does not start one queued attempt twice under React Strict Mode', async () => {
    const uploadDeferred = createDeferred<string>();
    const uploadFile = vi.fn<IFileUploadHandler<string>>(() => uploadDeferred.promise);

    act(() => {
      root.render(
        <React.StrictMode>
          <FileUpload
            acceptedFileTypes={['image/*']}
            maxFileBytes={100}
            uploadFile={uploadFile}
          />
        </React.StrictMode>,
      );
    });

    act(() => {
      selectFiles(getFileInput(container), [createFile('strict.png')]);
    });
    await flushFileUpload();

    expect(uploadFile).toHaveBeenCalledTimes(1);

    await act(async () => {
      uploadDeferred.resolve('uploaded');
      await uploadDeferred.promise;
    });
  });

  test('keeps validation and rejected-only queues expanded before the first attempt', async () => {
    const validation = createDeferred<IFileUploadValidationIssue | null>();
    const upload = createDeferred<string>();
    const uploadFile = vi.fn<IFileUploadHandler<string>>(() => upload.promise);
    act(() =>
      root.render(
        <FileUpload
          acceptedFileTypes={['image/png']}
          maxFileBytes={100}
          maxFiles={2}
          validateFile={() => validation.promise}
          uploadFile={uploadFile}
        />,
      ),
    );
    const area = container.querySelector<HTMLElement>('[data-slot="file-upload-drop-zone"]');
    act(() => selectFiles(getFileInput(container), [createFile('rejected.txt', 4, 'text/plain')]));
    await flushFileUpload();
    expect(container.querySelector('[data-status="rejected"]')).not.toBeNull();
    expect(area?.hidden).toBe(false);
    expect(container.querySelector('[aria-controls]')).toBeNull();

    act(() => selectFiles(getFileInput(container), [createFile('valid.png')]));
    await flushFileUpload();
    expect(container.querySelector('[data-status="validating"]')).not.toBeNull();
    expect(area?.hidden).toBe(false);
    await act(async () => {
      validation.resolve(null);
      await validation.promise;
    });
    await flushFileUpload();
    expect(area?.hidden).toBe(true);
    await act(async () => {
      upload.resolve('uploaded');
      await upload.promise;
    });
  });

  test.each(['fulfilled', 'rejected'] as const)(
    'first-attempt collapse survives an immediately %s handler',
    async (outcome) => {
      const uploadFile: IFileUploadHandler<string> = () => {
        if (outcome === 'rejected')
          return Promise.reject(new DOMException('Upload unavailable', 'NetworkError'));
        return Promise.resolve('uploaded');
      };
      act(() =>
        root.render(
          <FileUpload
            acceptedFileTypes={[]}
            maxFileBytes={100}
            uploadFile={uploadFile}
          />,
        ),
      );
      act(() => selectFiles(getFileInput(container), [createFile('fast.png')]));
      await flushFileUpload();
      expect(
        container.querySelector<HTMLElement>('[data-slot="file-upload-drop-zone"]')?.hidden,
      ).toBe(true);
      expect(getButton(container, 'Show upload area').getAttribute('aria-expanded')).toBe('false');
      expect(
        container.querySelector(
          `[data-status="${outcome === 'fulfilled' ? 'succeeded' : 'failed'}"]`,
        ),
      ).not.toBeNull();
    },
  );

  test('preserves manual visibility, composes notifications, and restores an empty queue', async () => {
    const upload = createDeferred<string>();
    const contexts: IFileUploadHandlerContext[] = [];
    const controlsRef = createRef<IFileUploadControls>();
    const onItemsChange = vi.fn<IFileUploadItemsChangeHandler<string>>();
    const onUploadAreaExpand = vi.fn();
    const uploadFile: IFileUploadHandler<string> = (_file, context) => {
      contexts.push(context);
      return upload.promise;
    };
    act(() =>
      root.render(
        <FileUpload
          acceptedFileTypes={[]}
          autoUpload={false}
          controlsRef={controlsRef}
          description="Attach a file."
          maxFileBytes={100}
          uploadFile={uploadFile}
          hideUploadAreaLabel="Hide picker"
          showUploadAreaLabel="Show picker"
          onItemsChange={onItemsChange}
          onUploadAreaExpand={onUploadAreaExpand}
        />,
      ),
    );
    const input = getFileInput(container);
    const area = container.querySelector<HTMLElement>('[data-slot="file-upload-drop-zone"]');
    act(() => selectFiles(input, [createFile('manual.png', 10)]));
    await flushFileUpload();
    expect(area?.hidden).toBe(false);
    expect(container.querySelector('[aria-controls]')).toBeNull();
    act(() => getButton(container, 'Start uploads').click());
    await flushFileUpload();
    const toggle = getButton(container, 'Show picker');
    expect(toggle.getAttribute('aria-controls')).toBe(area?.id);
    expect(input.hidden).toBe(true);
    expect(input.tabIndex).toBe(-1);
    expect(onUploadAreaExpand).not.toHaveBeenCalled();
    for (const id of input.getAttribute('aria-describedby')?.split(' ') ?? []) {
      expect(document.getElementById(id)).not.toBeNull();
    }

    const notificationCount = onItemsChange.mock.calls.length;
    act(() => {
      toggle.focus();
      toggle.click();
    });
    expect(document.activeElement).toBe(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(area?.hidden).toBe(false);
    expect(input.hidden).toBe(false);
    expect(onUploadAreaExpand).toHaveBeenCalledOnce();
    expect(onItemsChange).toHaveBeenCalledTimes(notificationCount);

    act(() => requireFixture(contexts[0]).reportProgress(5, 10));
    await flushFileUpload();
    expect(area?.hidden).toBe(false);
    act(() => getButton(container, 'Hide picker').click());
    await act(async () => {
      upload.resolve('uploaded');
      await upload.promise;
    });
    await flushFileUpload();
    expect(area?.hidden).toBe(true);
    expect(onUploadAreaExpand).toHaveBeenCalledOnce();
    const snapshots = onItemsChange.mock.calls.map(([items]) => items);
    expect(new Set(snapshots).size).toBe(snapshots.length);
    expect(onItemsChange.mock.calls.at(-1)?.[0][0]).toMatchObject({
      result: 'uploaded',
      status: 'succeeded',
    });
    expect(onItemsChange.mock.calls.at(-1)?.[1]).toMatchObject({
      succeededFiles: 1,
      totalFiles: 1,
    });

    act(() => controlsRef.current?.removeFile(requireFixture(contexts[0]).uploadId));
    await flushFileUpload();
    expect(area?.hidden).toBe(false);
    expect(container.querySelector('[aria-controls]')).toBeNull();
    expect(getFileInput(container)).toBe(input);
    expect(onItemsChange.mock.calls.at(-1)?.[0]).toStrictEqual([]);
    expect(onUploadAreaExpand).toHaveBeenCalledOnce();

    act(() => selectFiles(input, [createFile('reset.png')]));
    await flushFileUpload();
    expect(area?.hidden).toBe(false);
    act(() => getButton(container, 'Start uploads').click());
    await flushFileUpload();
    expect(area?.hidden).toBe(true);
    act(() => controlsRef.current?.reset());
    await flushFileUpload();
    expect(area?.hidden).toBe(false);
    expect(container.querySelector('[aria-controls]')).toBeNull();
    expect(onUploadAreaExpand).toHaveBeenCalledOnce();
  });

  test('revealing selection preserves existing-file and count admission', async () => {
    const upload = createDeferred<string>();
    const uploadFile = vi.fn<IFileUploadHandler<string>>(() => upload.promise);
    const onFileRejected = vi.fn<IFileUploadRejectedHandler>();
    act(() =>
      root.render(
        <FileUpload
          acceptedFileTypes={[]}
          existingFiles={[createFile('existing.png')]}
          maxFileBytes={100}
          maxFiles={2}
          replaceSingleFile={false}
          uploadFile={uploadFile}
          onFileRejected={onFileRejected}
        />,
      ),
    );
    const input = getFileInput(container);
    act(() => selectFiles(input, [createFile('accepted.png')]));
    await flushFileUpload();
    act(() => getButton(container, 'Show upload area').click());
    act(() => selectFiles(input, [createFile('overflow.png')]));
    await flushFileUpload();
    expect(uploadFile).toHaveBeenCalledOnce();
    expect(requireFixture(onFileRejected.mock.calls[0])[0].validationIssue.reason).toBe(
      'file-count-exceeded',
    );
    expect(getButton(container, 'Hide upload area').getAttribute('aria-expanded')).toBe('true');
    await act(async () => {
      upload.resolve('uploaded');
      await upload.promise;
    });
  });

  test.each(['picker', 'input', 'outside'] as const)(
    'automatic collapse handles focus from %s',
    async (focusTarget) => {
      const upload = createDeferred<string>();
      const uploadFile: IFileUploadHandler<string> = () => upload.promise;
      act(() =>
        root.render(
          <>
            <button type="button">Outside</button>
            <FileUpload
              acceptedFileTypes={[]}
              maxFileBytes={100}
              inputProps={{ tabIndex: 0 }}
              uploadFile={uploadFile}
            />
          </>,
        ),
      );
      const input = getFileInput(container);
      const target =
        focusTarget === 'input'
          ? input
          : getButton(container, focusTarget === 'picker' ? 'Choose file' : 'Outside');
      act(() => {
        target.focus();
        selectFiles(input, [createFile('focused.png')]);
      });
      await flushFileUpload();
      expect(document.activeElement).toBe(
        focusTarget === 'outside' ? target : getButton(container, 'Show upload area'),
      );
      expect(input.tabIndex).toBe(-1);
      act(() => getButton(container, 'Show upload area').click());
      expect(input.tabIndex).toBe(0);
      await act(async () => {
        upload.resolve('uploaded');
        await upload.promise;
      });
    },
  );

  test('shows bulk cancellation only for multiple cancelable files', async () => {
    const upload = createDeferred<string>();
    const contexts: IFileUploadHandlerContext[] = [];
    const uploadFile: IFileUploadHandler<string> = (_file, context) => {
      contexts.push(context);
      return upload.promise;
    };
    act(() =>
      root.render(
        <FileUpload
          acceptedFileTypes={[]}
          maxFileBytes={100}
          maxFiles={3}
          uploadFile={uploadFile}
        />,
      ),
    );
    const input = getFileInput(container);
    act(() => selectFiles(input, [createFile('committed.png', 10)]));
    await flushFileUpload();
    expect(container.textContent).not.toContain('Cancel all');
    expect(container.querySelector('[aria-label="Cancel committed.png"]')).not.toBeNull();

    act(() => getButton(container, 'Show upload area').click());
    act(() => selectFiles(input, [createFile('cancelable.png', 10)]));
    await flushFileUpload();
    expect(getButton(container, 'Cancel all').disabled).toBe(false);
    act(() => requireFixture(contexts[0]).reportProgress(10, 10));
    await flushFileUpload();
    expect(container.querySelector('[data-status="processing"]')).not.toBeNull();
    expect(container.textContent).not.toContain('Cancel all');
    expect(container.querySelector('[aria-label="Cancel cancelable.png"]')).not.toBeNull();

    act(() => selectFiles(input, [createFile('queued.png', 10)]));
    await flushFileUpload();
    expect(container.querySelector('[data-status="queued"]')).not.toBeNull();
    act(() => getButton(container, 'Cancel all').click());
    await flushFileUpload();
    expect(container.querySelectorAll('[data-status="canceled"]')).toHaveLength(2);
    expect(container.querySelector('[data-status="processing"]')).not.toBeNull();
    expect(requireFixture(contexts[0]).signal.aborted).toBe(false);
    expect(requireFixture(contexts[1]).signal.aborted).toBe(true);
    expect(container.textContent).not.toContain('Cancel all');
    await act(async () => {
      upload.resolve('uploaded');
      await upload.promise;
    });
    await flushFileUpload();
    expect(container.querySelectorAll('[data-status="succeeded"]')).toHaveLength(1);
  });

  test('disabled disclosure preserves active uploads and ignores expansion', async () => {
    const upload = createDeferred<string>();
    const contexts: IFileUploadHandlerContext[] = [];
    const onUploadAreaExpand = vi.fn();
    const uploadFile: IFileUploadHandler<string> = (_file, context) => {
      contexts.push(context);
      return upload.promise;
    };
    const renderUploader = (disabled: boolean) =>
      root.render(
        <FileUpload
          acceptedFileTypes={[]}
          maxFileBytes={100}
          disabled={disabled}
          uploadFile={uploadFile}
          onUploadAreaExpand={onUploadAreaExpand}
        />,
      );
    act(() => renderUploader(false));
    act(() => selectFiles(getFileInput(container), [createFile('active.png')]));
    await flushFileUpload();
    act(() => renderUploader(true));
    const toggle = getButton(container, 'Show upload area');
    expect(toggle.disabled).toBe(true);
    act(() => toggle.click());
    expect(onUploadAreaExpand).not.toHaveBeenCalled();
    expect(requireFixture(contexts[0]).signal.aborted).toBe(false);
    await act(async () => {
      upload.resolve('uploaded');
      await upload.promise;
    });
  });

  test('aborts active handlers and revokes previews on unmount', async () => {
    const uploadDeferred = createDeferred<string>();
    const uploadSignals: AbortSignal[] = [];
    const uploadFile = vi.fn<IFileUploadHandler<string>>((_file, context) => {
      uploadSignals.push(context.signal);
      return uploadDeferred.promise;
    });

    act(() => {
      root.render(
        <FileUpload
          acceptedFileTypes={['image/*']}
          maxFileBytes={100}
          renderPreview={(item) => item.file.name}
          uploadFile={uploadFile}
        />,
      );
    });

    act(() => {
      selectFiles(getFileInput(container), [createFile('unmount.png')]);
    });
    await flushFileUpload();

    act(() => {
      root.unmount();
    });

    expect(uploadSignals[0]?.aborted).toBe(true);
    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:unmount.png');

    await act(async () => {
      uploadDeferred.resolve('late-success');
      await uploadDeferred.promise;
    });

    root = createRoot(container);
  });
});
