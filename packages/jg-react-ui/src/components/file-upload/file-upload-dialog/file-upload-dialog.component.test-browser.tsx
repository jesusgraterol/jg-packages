import { page } from 'vitest/browser';
import type { IFileUploadDialogSubmitHandler, IFileUploadDialogDiscardHandler } from './types.js';
import { requireFixture } from '../file-upload.test-utils.js';
import type { IFileUploadHandlerContext } from 'jg-react';
import { Button } from '../../button/index.js';
import type { IFileUploadDialogProps } from './types.js';
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { IFileUploadHandler } from 'jg-react';

import { FileUploadDialog } from './file-upload-dialog.component.js';

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

// stable image types prevent policy normalization from changing during fixture renders.
const TEST_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

// deferred promises expose active uploads to dismissal assertions.
type IDeferred<TResult> = {
  promise: Promise<TResult>;
  reject: (reason?: unknown) => void;
  resolve: (result: TResult) => void;
};

/** Creates a manually controlled promise for one upload attempt. */
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

  return { promise, reject: rejectDeferred, resolve: resolveDeferred };
};

/** Renders the shared dialog with a deterministic image policy. */
const TestFileUploadDialog = ({
  maxFiles = 1,
  onDiscard,
  onSubmit,
  uploadFile,
}: {
  maxFiles?: number;
  onDiscard?: React.ComponentProps<typeof FileUploadDialog<string>>['onDiscard'];
  onSubmit: React.ComponentProps<typeof FileUploadDialog<string>>['onSubmit'];
  uploadFile: IFileUploadHandler<string>;
}): React.ReactElement => (
  <FileUploadDialog
    fileUploadProps={{
      acceptedFileTypes: TEST_IMAGE_TYPES,
      maxFileBytes: 1024,
      maxFiles,
      uploadFile,
    }}
    {...(onDiscard === undefined ? {} : { onDiscard })}
    onSubmit={onSubmit}
    trigger={<button type="button">Open uploader</button>}
  />
);

/** Selects deterministic files through the dialog's native input. */
const selectFiles = (input: HTMLInputElement, files: readonly File[]): void => {
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: files,
  });
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

/** Flushes modal listeners, serialized selection, and queue effects. */
const flushDialogWork = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await Promise.resolve();
  });
};

/** Returns a visible button by its complete text. */
const getButton = (buttonText: string): HTMLButtonElement => {
  const button = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => candidate.textContent?.trim() === buttonText,
  );

  if (button === undefined) {
    throw new Error(`Button "${buttonText}" was not rendered.`);
  }

  return button;
};

/** Returns the force-mounted dialog file input. */
const getFileInput = (): HTMLInputElement => {
  const input = document.body.querySelector<HTMLInputElement>('input[type="file"]');

  if (input === null) throw new Error('The dialog file input was not rendered.');
  return input;
};

describe('FileUploadDialog', () => {
  let container: HTMLDivElement;
  let isRootMounted: boolean;
  let root: Root;

  beforeEach(async () => {
    await page.viewport(1280, 800);
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    isRootMounted = true;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn((file: File) => `blob:${file.name}`),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
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
    if (isRootMounted) act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test.each(['reportError', 'microtask'] as const)(
    'reports a throwing discard callback through %s without interrupting removal',
    async (reporter) => {
      const failure = new Error('Caller cleanup failed');
      const reportError = vi.fn();
      vi.stubGlobal('reportError', reporter === 'reportError' ? reportError : undefined);
      act(() =>
        root.render(
          <TestFileUploadDialog
            maxFiles={2}
            uploadFile={(file) =>
              file.name === 'failed.png'
                ? Promise.reject(new Error('Unavailable'))
                : Promise.resolve(file.name)
            }
            onSubmit={() => undefined}
            onDiscard={() => {
              throw failure;
            }}
          />,
        ),
      );
      act(() => getButton('Open uploader').click());
      await flushDialogWork();
      act(() =>
        selectFiles(getFileInput(), [
          new File(['voice'], 'uploaded.png', { type: 'image/png' }),
          new File(['voice'], 'failed.png', { type: 'image/png' }),
        ]),
      );
      await flushDialogWork();
      const queued: VoidFunction[] = [];
      const microtask =
        reporter === 'microtask'
          ? vi
              .spyOn(globalThis, 'queueMicrotask')
              .mockImplementation((callback) => queued.push(callback))
          : null;
      const remove = document.body.querySelector<HTMLButtonElement>(
        '[aria-label="Remove uploaded.png"]',
      );
      if (remove === null) throw new Error('The uploaded row was not rendered.');
      act(() => remove.click());
      microtask?.mockRestore();
      if (reporter === 'reportError') expect(reportError).toHaveBeenCalledExactlyOnceWith(failure);
      else {
        expect(queued).toHaveLength(1);
        const report = queued[0];
        if (report === undefined) throw new Error('No callback failure was scheduled.');
        expect(report).toThrow(failure);
      }
      expect(document.body.textContent).not.toContain('uploaded.png');
      expect(document.body.textContent).toContain('failed.png');
    },
  );

  test('does not repeat automatic finalization when a controlled owner keeps the dialog open', async () => {
    const onSubmit = vi.fn<IFileUploadDialogSubmitHandler<string>>(() => Promise.resolve());
    const onOpenChange = vi.fn<(open: boolean) => void>();
    await act(async () => {
      root.render(
        <FileUploadDialog
          open
          fileUploadProps={{
            acceptedFileTypes: TEST_IMAGE_TYPES,
            maxFileBytes: 1024,
            uploadFile: (file) => Promise.resolve(file.name),
          }}
          onSubmit={onSubmit}
          onOpenChange={onOpenChange}
        />,
      );
      await Promise.resolve();
    });
    act(() =>
      selectFiles(getFileInput(), [new File(['notes'], 'notes.png', { type: 'image/png' })]),
    );
    await flushDialogWork();
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    await flushDialogWork();
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
  });

  test('settles an abandoned finalization before reopening the mounted controlled owner', async () => {
    const pending = createDeferred<void>();
    const onSubmit = vi.fn<IFileUploadDialogSubmitHandler<string>>(() => pending.promise);
    const onDiscard = vi.fn<IFileUploadDialogDiscardHandler<string>>();
    const onOpenChangeComplete = vi.fn<(open: boolean) => void>();
    const render = (open: boolean) =>
      root.render(
        <FileUploadDialog
          open={open}
          fileUploadProps={{
            acceptedFileTypes: TEST_IMAGE_TYPES,
            maxFileBytes: 1024,
            uploadFile: (file) => Promise.resolve(file.name),
          }}
          onSubmit={onSubmit}
          onDiscard={onDiscard}
          onOpenChangeComplete={onOpenChangeComplete}
        />,
      );
    await act(async () => {
      render(true);
      await Promise.resolve();
    });
    act(() =>
      selectFiles(getFileInput(), [new File(['notes'], 'notes.png', { type: 'image/png' })]),
    );
    await flushDialogWork();
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    act(() => render(false));
    await vi.waitFor(() => expect(onOpenChangeComplete).toHaveBeenCalledWith(false));
    act(() => render(true));
    await vi.waitFor(() => expect(document.body.querySelector('[role="dialog"]')).not.toBeNull());
    await act(async () => {
      pending.reject(new Error('Abandoned request failed'));
      await expect(pending.promise).rejects.toThrow('Abandoned request failed');
    });
    expect(onDiscard).toHaveBeenCalledOnce();
    expect(onDiscard.mock.calls[0]?.[0][0]?.result).toBe('notes.png');
    expect(document.body.textContent).not.toContain('Abandoned request failed');
  });

  test('shows generated policy copy, uploads immediately, and closes after finalization', async () => {
    const uploadFile = vi.fn<IFileUploadHandler<string>>((file) => Promise.resolve(file.name));
    const onSubmit = vi.fn<IFileUploadDialogSubmitHandler<string>>().mockResolvedValue(undefined);

    act(() => {
      root.render(
        <TestFileUploadDialog
          uploadFile={uploadFile}
          onSubmit={onSubmit}
        />,
      );
    });
    const trigger = getButton('Open uploader');
    act(() => trigger.focus());
    act(() => trigger.click());
    await flushDialogWork();

    const dialog = document.body.querySelector<HTMLElement>('[data-slot="dialog-content"]');
    const uploadLabel = document.body.querySelector<HTMLLabelElement>(
      '[data-slot="file-upload"] label',
    );
    const constraints = document.body.querySelector<HTMLElement>('[id$="-constraints"]');

    expect(dialog?.dataset['size']).toBe('medium');
    expect(dialog?.textContent).toContain('Upload files');
    expect(dialog?.textContent).toContain(
      'Add one file in JPEG, PNG, or WebP format. Each file can be up to 1.00 kB.',
    );
    expect(uploadLabel?.className).toContain('sr-only');
    expect(constraints?.className).toContain('sr-only');

    act(() => {
      selectFiles(getFileInput(), [
        new File([new Uint8Array(8)], 'uploaded.png', { type: 'image/png' }),
      ]);
    });
    await flushDialogWork();
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());

    expect(uploadFile).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0]?.[0][0]).toMatchObject({
      result: 'uploaded.png',
      status: 'succeeded',
    });
    await vi.waitFor(() => expect(dialog?.dataset['state']).toBe('closed'));
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  test('disables dismissal while an immediate upload attempt is active', async () => {
    const uploadDeferred = createDeferred<string>();
    const uploadFile = vi.fn<IFileUploadHandler<string>>(() => uploadDeferred.promise);

    act(() => {
      root.render(
        <TestFileUploadDialog
          uploadFile={uploadFile}
          onSubmit={vi.fn()}
        />,
      );
    });
    act(() => getButton('Open uploader').click());
    await flushDialogWork();
    act(() => {
      selectFiles(getFileInput(), [
        new File([new Uint8Array(8)], 'active.png', { type: 'image/png' }),
      ]);
    });
    await flushDialogWork();

    expect(uploadFile).toHaveBeenCalledOnce();
    expect(
      document.body.querySelector<HTMLButtonElement>('[aria-label="Close dialog"]')?.disabled,
    ).toBe(true);
    expect(getButton('Close').disabled).toBe(true);

    await act(async () => {
      uploadDeferred.resolve('uploaded');
      await uploadDeferred.promise;
    });
  });

  test('requires manual submission after a failed upload is retried successfully', async () => {
    const uploadFile = vi
      .fn<IFileUploadHandler<string>>()
      .mockRejectedValueOnce(new Error('Storage unavailable'))
      .mockResolvedValue('uploaded');
    const onSubmit = vi.fn<IFileUploadDialogSubmitHandler<string>>().mockResolvedValue(undefined);

    act(() => {
      root.render(
        <TestFileUploadDialog
          uploadFile={uploadFile}
          onSubmit={onSubmit}
        />,
      );
    });
    act(() => getButton('Open uploader').click());
    await flushDialogWork();
    act(() => {
      selectFiles(getFileInput(), [
        new File([new Uint8Array(8)], 'retry.png', { type: 'image/png' }),
      ]);
    });
    await flushDialogWork();

    expect(document.body.querySelector('[data-status="failed"]')).not.toBeNull();
    act(() => getButton('Retry').click());
    await flushDialogWork();

    expect(document.body.querySelector('[data-status="succeeded"]')).not.toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(getButton('Submit').disabled).toBe(false);

    act(() => getButton('Submit').click());
    await flushDialogWork();
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  test('latches manual submission when automatic finalization fails', async () => {
    const uploadFile = vi.fn<IFileUploadHandler<string>>(() => Promise.resolve('uploaded'));
    const onSubmit = vi
      .fn<IFileUploadDialogSubmitHandler<string>>()
      .mockRejectedValueOnce(new Error('Registration unavailable'))
      .mockResolvedValue(undefined);

    act(() => {
      root.render(
        <TestFileUploadDialog
          uploadFile={uploadFile}
          onSubmit={onSubmit}
        />,
      );
    });
    act(() => getButton('Open uploader').click());
    await flushDialogWork();
    act(() => {
      selectFiles(getFileInput(), [
        new File([new Uint8Array(8)], 'uploaded.png', { type: 'image/png' }),
      ]);
    });
    await flushDialogWork();

    expect(onSubmit).toHaveBeenCalledOnce();

    expect(document.body.querySelector('[role="alert"]')?.textContent).toContain(
      'We could not finish adding these files. Check their status before trying again.',
    );
    expect(getButton('Submit').disabled).toBe(false);

    act(() => getButton('Submit').click());
    await flushDialogWork();
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  test('latches manual submission after validation rejection is removed', async () => {
    const uploadFile = vi.fn<IFileUploadHandler<string>>(() => Promise.resolve('uploaded'));
    const onSubmit = vi.fn<IFileUploadDialogSubmitHandler<string>>().mockResolvedValue(undefined);

    act(() => {
      root.render(
        <TestFileUploadDialog
          uploadFile={uploadFile}
          onSubmit={onSubmit}
        />,
      );
    });
    act(() => getButton('Open uploader').click());
    await flushDialogWork();
    act(() => {
      selectFiles(getFileInput(), [
        new File([new Uint8Array(8)], 'invalid.pdf', { type: 'application/pdf' }),
      ]);
    });
    await flushDialogWork();

    expect(document.body.querySelector('[data-status="rejected"]')).not.toBeNull();
    act(() => getButton('Remove').click());
    act(() => {
      selectFiles(getFileInput(), [
        new File([new Uint8Array(8)], 'valid.png', { type: 'image/png' }),
      ]);
    });
    await flushDialogWork();

    expect(document.body.querySelector('[data-status="succeeded"]')).not.toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(getButton('Submit').disabled).toBe(false);
  });

  test('latches manual submission after an active upload is canceled', async () => {
    const uploadFile = vi
      .fn<IFileUploadHandler<string>>()
      .mockImplementationOnce(
        (_file, { signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener(
              'abort',
              () => reject(new DOMException('The upload was canceled.', 'AbortError')),
              { once: true },
            );
          }),
      )
      .mockResolvedValue('uploaded');
    const onSubmit = vi.fn<IFileUploadDialogSubmitHandler<string>>().mockResolvedValue(undefined);

    act(() => {
      root.render(
        <TestFileUploadDialog
          uploadFile={uploadFile}
          onSubmit={onSubmit}
        />,
      );
    });
    act(() => getButton('Open uploader').click());
    await flushDialogWork();
    act(() => {
      selectFiles(getFileInput(), [
        new File([new Uint8Array(8)], 'canceled.png', { type: 'image/png' }),
      ]);
    });
    await flushDialogWork();

    act(() =>
      document.body.querySelector<HTMLButtonElement>('[aria-label="Cancel canceled.png"]')?.click(),
    );
    await flushDialogWork();

    expect(document.body.querySelector('[data-status="canceled"]')).not.toBeNull();
    act(() => getButton('Remove').click());
    act(() => {
      selectFiles(getFileInput(), [
        new File([new Uint8Array(8)], 'replacement.png', { type: 'image/png' }),
      ]);
    });
    await flushDialogWork();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(getButton('Submit').disabled).toBe(false);
  });

  test('finalizes only once when a successful queue rerenders', async () => {
    const finalization = createDeferred<void>();
    const uploadFile = vi.fn<IFileUploadHandler<string>>(() => Promise.resolve('uploaded'));
    const onSubmit = vi.fn(() => finalization.promise);

    act(() => {
      root.render(
        <TestFileUploadDialog
          uploadFile={uploadFile}
          onSubmit={onSubmit}
        />,
      );
    });
    act(() => getButton('Open uploader').click());
    await flushDialogWork();
    act(() => {
      selectFiles(getFileInput(), [
        new File([new Uint8Array(8)], 'uploaded.png', { type: 'image/png' }),
      ]);
    });
    await flushDialogWork();
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());

    act(() => {
      root.render(
        <TestFileUploadDialog
          uploadFile={uploadFile}
          onSubmit={onSubmit}
        />,
      );
    });
    await flushDialogWork();

    expect(onSubmit).toHaveBeenCalledOnce();
    await act(async () => {
      finalization.resolve(undefined);
      await finalization.promise;
      await Promise.resolve();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
  });

  test('reports successful uploads synchronously when they are removed after a partial failure', async () => {
    const uploadFile = vi.fn<IFileUploadHandler<string>>((file) => {
      if (file.name === 'failed.png') return Promise.reject(new Error('Storage unavailable'));
      return Promise.resolve(file.name);
    });
    const onDiscard = vi.fn<IFileUploadDialogDiscardHandler<string>>();

    act(() => {
      root.render(
        <TestFileUploadDialog
          maxFiles={2}
          uploadFile={uploadFile}
          onDiscard={onDiscard}
          onSubmit={vi.fn()}
        />,
      );
    });
    act(() => getButton('Open uploader').click());
    await flushDialogWork();
    act(() => {
      selectFiles(getFileInput(), [
        new File([new Uint8Array(8)], 'uploaded.png', { type: 'image/png' }),
        new File([new Uint8Array(8)], 'failed.png', { type: 'image/png' }),
      ]);
    });
    await flushDialogWork();

    const removeUploadedButton = document.body.querySelector<HTMLButtonElement>(
      '[aria-label="Remove uploaded.png"]',
    );

    act(() => removeUploadedButton?.click());

    await vi.waitFor(() => expect(onDiscard).toHaveBeenCalledOnce());
    expect(onDiscard.mock.calls[0]?.[0][0]).toMatchObject({
      result: 'uploaded.png',
      status: 'succeeded',
    });
  });

  test('reports successful uploads synchronously when a partial-failure dialog closes', async () => {
    const uploadFile = vi.fn<IFileUploadHandler<string>>((file) => {
      if (file.name === 'failed.png') return Promise.reject(new Error('Storage unavailable'));
      return Promise.resolve(file.name);
    });
    const onDiscard = vi.fn<IFileUploadDialogDiscardHandler<string>>();

    act(() => {
      root.render(
        <TestFileUploadDialog
          maxFiles={2}
          uploadFile={uploadFile}
          onDiscard={onDiscard}
          onSubmit={vi.fn()}
        />,
      );
    });
    act(() => getButton('Open uploader').click());
    await flushDialogWork();
    act(() => {
      selectFiles(getFileInput(), [
        new File([new Uint8Array(8)], 'uploaded.png', { type: 'image/png' }),
        new File([new Uint8Array(8)], 'failed.png', { type: 'image/png' }),
      ]);
    });
    await flushDialogWork();

    act(() => getButton('Close').click());

    await vi.waitFor(() => expect(onDiscard).toHaveBeenCalledOnce());
    expect(onDiscard.mock.calls[0]?.[0][0]).toMatchObject({
      result: 'uploaded.png',
      status: 'succeeded',
    });

    await flushDialogWork();
    act(() => getButton('Open uploader').click());
    await flushDialogWork();

    expect(document.body.querySelector('[data-slot="file-upload-item"]')).toBeNull();
    expect(getButton('Submit').disabled).toBe(true);
  });

  test('waits for a pending finalization to succeed before an unmounted session is settled', async () => {
    const finalization = createDeferred<void>();
    const onDiscard = vi.fn<IFileUploadDialogDiscardHandler<string>>();

    act(() => {
      root.render(
        <TestFileUploadDialog
          uploadFile={vi.fn<IFileUploadHandler<string>>(() => Promise.resolve('uploaded'))}
          onDiscard={onDiscard}
          onSubmit={() => finalization.promise}
        />,
      );
    });
    act(() => getButton('Open uploader').click());
    await flushDialogWork();
    act(() => {
      selectFiles(getFileInput(), [
        new File([new Uint8Array(8)], 'uploaded.png', { type: 'image/png' }),
      ]);
    });
    await flushDialogWork();

    act(() => root.unmount());
    isRootMounted = false;
    expect(onDiscard).not.toHaveBeenCalled();

    finalization.resolve(undefined);
    await finalization.promise;
    await Promise.resolve();

    expect(onDiscard).not.toHaveBeenCalled();
  });

  test('discards an unmounted session after its pending finalization fails', async () => {
    const finalization = createDeferred<void>();
    const onDiscard = vi.fn<IFileUploadDialogDiscardHandler<string>>();

    act(() => {
      root.render(
        <TestFileUploadDialog
          uploadFile={vi.fn<IFileUploadHandler<string>>(() => Promise.resolve('uploaded'))}
          onDiscard={onDiscard}
          onSubmit={() => finalization.promise}
        />,
      );
    });
    act(() => getButton('Open uploader').click());
    await flushDialogWork();
    act(() => {
      selectFiles(getFileInput(), [
        new File([new Uint8Array(8)], 'uploaded.png', { type: 'image/png' }),
      ]);
    });
    await flushDialogWork();

    act(() => root.unmount());
    isRootMounted = false;
    finalization.reject(new Error('Registration unavailable'));
    await expect(finalization.promise).rejects.toThrow('Registration unavailable');
    await vi.waitFor(() => expect(onDiscard).toHaveBeenCalledOnce());
  });

  test.each([
    ['succeeds', 0],
    ['fails', 1],
  ] as const)(
    'settles a pending finalization that %s after a controlled external close',
    async (outcome, expectedDiscardCount) => {
      const finalization = createDeferred<void>();
      const onDiscard = vi.fn<IFileUploadDialogDiscardHandler<string>>();
      const onSubmit = vi.fn(() => finalization.promise);
      const onOpenChangeComplete = vi.fn<(open: boolean) => void>();
      const uploadFile = vi.fn<IFileUploadHandler<string>>(() => Promise.resolve('uploaded'));
      const renderControlledDialog = (open: boolean): void => {
        root.render(
          <FileUploadDialog
            open={open}
            fileUploadProps={{
              acceptedFileTypes: TEST_IMAGE_TYPES,
              maxFileBytes: 1024,
              uploadFile,
            }}
            onOpenChangeComplete={onOpenChangeComplete}
            onDiscard={onDiscard}
            onSubmit={onSubmit}
          />,
        );
      };

      act(() => renderControlledDialog(true));
      await flushDialogWork();
      act(() => {
        selectFiles(getFileInput(), [
          new File([new Uint8Array(8)], 'uploaded.png', { type: 'image/png' }),
        ]);
      });
      await flushDialogWork();
      await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());

      act(() => renderControlledDialog(false));
      await flushDialogWork();
      await vi.waitFor(() => expect(onOpenChangeComplete).toHaveBeenCalledWith(false));

      expect(onDiscard).not.toHaveBeenCalled();

      await act(async () => {
        if (outcome === 'succeeds') {
          finalization.resolve(undefined);
          await finalization.promise;
        } else {
          finalization.reject(new Error('Registration unavailable'));
          await expect(finalization.promise).rejects.toThrow('Registration unavailable');
        }
        await Promise.resolve();
      });

      expect(onDiscard).toHaveBeenCalledTimes(expectedDiscardCount);
      if (expectedDiscardCount === 1) {
        expect(onDiscard.mock.calls[0]?.[0][0]).toMatchObject({
          result: 'uploaded',
          status: 'succeeded',
        });
      }
    },
  );

  test('does not discard when a controlled owner rejects a close request', async () => {
    const onDiscard = vi.fn<IFileUploadDialogDiscardHandler<string>>();
    const onOpenChange = vi.fn();
    const uploadFile = vi.fn<IFileUploadHandler<string>>((file) => {
      if (file.name === 'failed.png') return Promise.reject(new Error('Storage unavailable'));
      return Promise.resolve(file.name);
    });
    const renderControlledDialog = (open: boolean): void => {
      root.render(
        <FileUploadDialog
          open={open}
          fileUploadProps={{
            acceptedFileTypes: TEST_IMAGE_TYPES,
            maxFileBytes: 1024,
            maxFiles: 2,
            uploadFile,
          }}
          onDiscard={onDiscard}
          onOpenChange={onOpenChange}
          onSubmit={vi.fn()}
        />,
      );
    };

    act(() => renderControlledDialog(true));
    await flushDialogWork();
    act(() => {
      selectFiles(getFileInput(), [
        new File([new Uint8Array(8)], 'uploaded.png', { type: 'image/png' }),
        new File([new Uint8Array(8)], 'failed.png', { type: 'image/png' }),
      ]);
    });
    await flushDialogWork();

    act(() => getButton('Close').click());

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDiscard).not.toHaveBeenCalled();
    expect(
      document.body.querySelector<HTMLElement>('[data-slot="dialog-content"]')?.dataset['state'],
    ).toBe('open');

    act(() => renderControlledDialog(false));
    await flushDialogWork();

    await vi.waitFor(() => expect(onDiscard).toHaveBeenCalledOnce());
  });
});

{
  const reactActEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };
  const ACCEPTED_TYPES = ['image/png'];

  /** Creates one externally controlled transport response. */
  const createDeferred = <TResult,>() => {
    let resolve!: (result: TResult) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<TResult>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    return { promise, reject, resolve };
  };

  /** Finds a visible native action by its complete accessible text. */
  const getButton = (name: string): HTMLButtonElement => {
    const button = Array.from(document.body.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === name && !candidate.closest('[hidden]'),
    );
    if (button === undefined) throw new Error(`Button "${name}" was not rendered.`);
    return button;
  };

  /** Selects files through the actual dialog picker and admission pipeline. */
  const selectFiles = (files: File[]): void => {
    const input = document.body.querySelector<HTMLInputElement>('input[type="file"]');
    if (input === null) throw new Error('The file picker was not rendered.');
    Object.defineProperty(input, 'files', { configurable: true, value: files });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  /** Flushes modal work, serialized admission, and queue notifications. */
  const flushWork = async (): Promise<void> => {
    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      await Promise.resolve();
    });
  };

  describe('FileUploadDialog upload-area intent', () => {
    let container: HTMLDivElement;
    let root: Root;
    let previousActEnvironment: boolean | undefined;

    beforeEach(async () => {
      await page.viewport(1280, 800);
      previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
      reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
        window.setTimeout(() => callback(performance.now()), 0),
      );
      vi.stubGlobal('cancelAnimationFrame', (frameId: number) => window.clearTimeout(frameId));
    });

    afterEach(() => {
      act(() => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
      if (previousActEnvironment === undefined) delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
      else reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    });

    /** Opens the real shared modal with only transport and application callbacks injected. */
    const openDialog = async (
      uploadFile: IFileUploadHandler<string>,
      onSubmit: IFileUploadDialogProps<string>['onSubmit'],
      options: Partial<IFileUploadDialogProps<string>> = {},
    ): Promise<void> => {
      act(() =>
        root.render(
          <FileUploadDialog
            trigger={<Button type="button">Open uploader</Button>}
            fileUploadProps={{
              acceptedFileTypes: ACCEPTED_TYPES,
              maxFileBytes: 100,
              maxFiles: 2,
              replaceSingleFile: false,
              uploadFile,
            }}
            onSubmit={onSubmit}
            {...options}
          />,
        ),
      );
      act(() => {
        getButton('Open uploader').focus();
        getButton('Open uploader').click();
      });
      await flushWork();
    };

    /** Creates an abort-aware fake of the injected external transport only. */
    const createTransport = () => {
      const responses: ReturnType<typeof createDeferred<string>>[] = [];
      const contexts: IFileUploadHandlerContext[] = [];
      const uploadFile = vi.fn<IFileUploadHandler<string>>((_file, context) => {
        const response = createDeferred<string>();
        responses.push(response);
        contexts.push(context);
        context.signal.addEventListener(
          'abort',
          () => response.reject(new DOMException('Canceled', 'AbortError')),
          { once: true },
        );
        return response.promise;
      });
      return { contexts, responses, uploadFile };
    };

    const createFile = (name: string) =>
      new File([new Uint8Array(10)], name, { type: 'image/png' });

    test('ordinary success still finalizes once, closes, and restores trigger focus', async () => {
      const onSubmit = vi.fn<IFileUploadDialogSubmitHandler<string>>().mockResolvedValue(undefined);
      await openDialog((file) => Promise.resolve(file.name), onSubmit);
      const trigger = getButton('Open uploader');
      act(() => selectFiles([createFile('ordinary.png')]));
      await flushWork();
      await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
      expect(
        requireFixture(onSubmit.mock.calls[0])[0].map((item: { result: string }) => item.result),
      ).toStrictEqual(['ordinary.png']);
      await vi.waitFor(() =>
        expect(
          document.querySelector('[data-slot="dialog-content"]')?.getAttribute('data-state'),
        ).toBe('closed'),
      );
      await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
    });

    test.each(['uploading', 'processing'] as const)(
      'reopening during %s latches manual submission before same-batch completion',
      async (status) => {
        const transport = createTransport();
        const onSubmit = vi
          .fn<IFileUploadDialogSubmitHandler<string>>()
          .mockResolvedValue(undefined);
        await openDialog(transport.uploadFile, onSubmit);
        act(() => selectFiles([createFile('pending.png')]));
        await flushWork();
        if (status === 'processing') {
          act(() => requireFixture(transport.contexts[0]).reportProgress(10, 10));
          await flushWork();
        }
        expect(document.querySelector(`[data-status="${status}"]`)).not.toBeNull();
        expect(getButton('Submit').disabled).toBe(true);
        await act(async () => {
          getButton('Show upload area').click();
          requireFixture(transport.responses[0]).resolve('uploaded');
          await requireFixture(transport.responses[0]).promise;
        });
        await flushWork();
        expect(onSubmit).not.toHaveBeenCalled();
        expect(document.body.textContent).toContain('Choose Submit when all files are uploaded.');
        expect(getButton('Submit').disabled).toBe(false);
        act(() => getButton('Hide upload area').click());
        act(() => selectFiles([]));
        await flushWork();
        expect(onSubmit).not.toHaveBeenCalled();
        act(() => getButton('Submit').click());
        await flushWork();
        expect(onSubmit).toHaveBeenCalledOnce();
      },
    );

    test('a revealed picker adds another batch and finalizes the complete successful queue', async () => {
      const transport = createTransport();
      const onSubmit = vi.fn<IFileUploadDialogSubmitHandler<string>>().mockResolvedValue(undefined);
      const onDiscard = vi.fn<IFileUploadDialogDiscardHandler<string>>();
      await openDialog(transport.uploadFile, onSubmit, { onDiscard });
      act(() => selectFiles([createFile('first.png')]));
      await flushWork();
      act(() => getButton('Show upload area').click());
      await act(async () => {
        requireFixture(transport.responses[0]).resolve('first');
        await requireFixture(transport.responses[0]).promise;
      });
      await flushWork();
      act(() => selectFiles([createFile('second.png')]));
      await flushWork();
      expect(getButton('Submit').disabled).toBe(true);
      expect(getButton('Hide upload area').getAttribute('aria-expanded')).toBe('true');
      act(() => getButton('Hide upload area').click());
      await act(async () => {
        requireFixture(transport.responses[1]).resolve('second');
        await requireFixture(transport.responses[1]).promise;
      });
      await flushWork();
      expect(onSubmit).not.toHaveBeenCalled();
      act(() => getButton('Submit').click());
      await flushWork();
      expect(onSubmit).toHaveBeenCalledOnce();
      expect(
        requireFixture(onSubmit.mock.calls[0])[0].map((item: { result: string }) => item.result),
      ).toStrictEqual(['first', 'second']);
      expect(onDiscard).not.toHaveBeenCalled();
    });

    test('composes expansion once and supports custom submit guidance and submission recovery', async () => {
      const transport = createTransport();
      const onUploadAreaExpand = vi.fn();
      const onSubmit = vi
        .fn<IFileUploadDialogSubmitHandler<string>>()
        .mockRejectedValueOnce(new DOMException('Finalization unavailable', 'NetworkError'))
        .mockResolvedValue(undefined);
      await openDialog(transport.uploadFile, onSubmit, {
        submitLabel: 'Use image',
        fileUploadProps: {
          acceptedFileTypes: ACCEPTED_TYPES,
          maxFileBytes: 100,
          uploadFile: transport.uploadFile,
          onUploadAreaExpand,
        },
      });
      act(() => selectFiles([createFile('image.png')]));
      await flushWork();
      act(() => getButton('Show upload area').click());
      act(() => getButton('Hide upload area').click());
      expect(onUploadAreaExpand).toHaveBeenCalledOnce();
      expect(document.body.textContent).toContain('Choose Use image when all files are uploaded.');
      await act(async () => {
        requireFixture(transport.responses[0]).resolve('image');
        await requireFixture(transport.responses[0]).promise;
      });
      await flushWork();
      expect(onSubmit).not.toHaveBeenCalled();
      act(() => getButton('Use image').click());
      await flushWork();
      expect(document.querySelector('[role="alert"]')?.textContent).toBe(
        'We could not finish adding these files. Check their status before trying again.',
      );
      act(() => getButton('Use image').click());
      await flushWork();
      expect(onSubmit).toHaveBeenCalledTimes(2);
    });

    test('clearing rows keeps manual intent while closing resets intent for the next session', async () => {
      const transport = createTransport();
      const onSubmit = vi.fn<IFileUploadDialogSubmitHandler<string>>().mockResolvedValue(undefined);
      const onDiscard = vi.fn<IFileUploadDialogDiscardHandler<string>>();
      await openDialog(transport.uploadFile, onSubmit, { onDiscard });
      act(() => selectFiles([createFile('removed.png')]));
      await flushWork();
      act(() => getButton('Show upload area').click());
      await act(async () => {
        requireFixture(transport.responses[0]).resolve('removed');
        await requireFixture(transport.responses[0]).promise;
      });
      await flushWork();
      const remove = document.querySelector<HTMLButtonElement>('[aria-label="Remove removed.png"]');
      expect(remove).not.toBeNull();
      act(() => remove?.click());
      await flushWork();
      await vi.waitFor(() => expect(onDiscard).toHaveBeenCalledOnce());
      expect(
        document.querySelector<HTMLElement>('[data-slot="file-upload-drop-zone"]')?.hidden,
      ).toBe(false);
      expect(document.body.textContent).toContain('Choose Submit when all files are uploaded.');
      act(() => selectFiles([createFile('retained.png')]));
      await flushWork();
      await act(async () => {
        requireFixture(transport.responses[1]).resolve('retained');
        await requireFixture(transport.responses[1]).promise;
      });
      await flushWork();
      expect(onSubmit).not.toHaveBeenCalled();
      act(() => getButton('Close').click());
      await flushWork();
      await vi.waitFor(() => expect(onDiscard).toHaveBeenCalledTimes(2));
      act(() => getButton('Open uploader').click());
      await flushWork();
      expect(document.body.textContent).not.toContain('Choose Submit when all files are uploaded.');
      act(() => selectFiles([createFile('new-session.png')]));
      await flushWork();
      await act(async () => {
        requireFixture(transport.responses[2]).resolve('fresh');
        await requireFixture(transport.responses[2]).promise;
      });
      await flushWork();
      expect(onSubmit).toHaveBeenCalledOnce();
      expect(
        requireFixture(onSubmit.mock.calls[0])[0].map((item: { result: string }) => item.result),
      ).toStrictEqual(['fresh']);
    });

    test('reopening preserves admission, cancellation, and failure recovery before submission', async () => {
      const transport = createTransport();
      const onSubmit = vi.fn<IFileUploadDialogSubmitHandler<string>>().mockResolvedValue(undefined);
      await openDialog(transport.uploadFile, onSubmit);
      act(() => selectFiles([createFile('recover.png')]));
      await flushWork();
      act(() => getButton('Show upload area').click());
      act(() => selectFiles([new File(['text'], 'invalid.txt', { type: 'text/plain' })]));
      await flushWork();
      expect(transport.uploadFile).toHaveBeenCalledOnce();
      expect(document.querySelector('[data-status="rejected"]')).not.toBeNull();
      act(() =>
        document.querySelector<HTMLButtonElement>('[aria-label="Remove invalid.txt"]')?.click(),
      );
      act(() =>
        document.querySelector<HTMLButtonElement>('[aria-label="Cancel recover.png"]')?.click(),
      );
      await flushWork();
      expect(getButton('Submit').disabled).toBe(true);
      expect(document.querySelector('[data-status="canceled"]')).not.toBeNull();
      act(() =>
        document.querySelector<HTMLButtonElement>('[aria-label="Retry recover.png"]')?.click(),
      );
      await flushWork();
      await act(async () => {
        requireFixture(transport.responses[1]).reject(
          new DOMException('Upload unavailable', 'NetworkError'),
        );
        await Promise.resolve();
      });
      await flushWork();
      expect(document.querySelector('[data-status="failed"]')).not.toBeNull();
      expect(getButton('Submit').disabled).toBe(true);
      act(() =>
        document.querySelector<HTMLButtonElement>('[aria-label="Retry recover.png"]')?.click(),
      );
      await flushWork();
      await act(async () => {
        requireFixture(transport.responses[2]).resolve('recovered');
        await requireFixture(transport.responses[2]).promise;
      });
      await flushWork();
      expect(getButton('Submit').disabled).toBe(false);
      expect(onSubmit).not.toHaveBeenCalled();
      act(() => getButton('Submit').click());
      await flushWork();
      expect(onSubmit).toHaveBeenCalledOnce();
    });
  });
}
