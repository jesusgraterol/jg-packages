import { page } from 'vitest/browser';
import { expectToThrowCode } from 'jg-exception/testing';
import { StrictMode, act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createErrorFeedback, Exception } from 'jg-exception';

import { ErrorFeedbackProvider } from '../error-feedback-provider/index.js';

import {
  AUDIO_INPUT_RECORDING_CHUNK_TIMESLICE_MS,
  AudioInput,
  type IAudioInputControls,
  type IAudioInputRecording,
} from './index.js';

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

// mocked media track records whether the component releases microphone resources.
const stopTrackMock = vi.fn<() => void>();

// mocked getUserMedia keeps microphone permission deterministic in the browser.
const getUserMediaMock = vi.fn<() => Promise<MediaStream>>();

// deferred promises let tests inspect loading UI before async work resolves.
type IDeferred<TResult> = {
  promise: Promise<TResult>;
  reject: (reason?: unknown) => void;
  resolve: (result: TResult) => void;
};

/**
 * Minimal MediaRecorder replacement for exercising AudioInput in the browser.
 */
class MockMediaRecorder {
  public static readonly instances: MockMediaRecorder[] = [];
  public static readonly isTypeSupported = vi.fn(
    (mimeType: string) => mimeType === 'audio/webm;codecs=opus',
  );

  public readonly mimeType: string;
  public ondataavailable: ((event: BlobEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public onstop: (() => void) | null = null;
  public readonly start = vi.fn((timeslice?: number): void => {
    this.timeslice = timeslice;
    this.state = 'recording';
  });
  public readonly stop = vi.fn((): void => {
    if (this.state === 'inactive') {
      return;
    }

    this.state = 'inactive';
    this.onstop?.();
  });
  public state: RecordingState = 'inactive';
  public timeslice: number | undefined;

  /**
   * Creates a mock recorder instance and stores constructor options for assertions.
   * @param _stream The media stream passed by AudioInput.
   * @param options The MediaRecorder options passed by AudioInput.
   */
  public constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    this.mimeType = options?.mimeType ?? 'audio/webm';
    MockMediaRecorder.instances.push(this);
  }

  /**
   * Emits a mocked dataavailable event.
   * @param blob The audio chunk to deliver to AudioInput.
   */
  public emitChunk(blob: Blob): void {
    this.ondataavailable?.({ data: blob } as BlobEvent);
  }
}

/**
 * MediaRecorder replacement that throws during setup after microphone access succeeds.
 */
class ThrowingMediaRecorder {
  public static readonly isTypeSupported = vi.fn(() => true);

  /**
   * Simulates a browser recorder setup failure.
   * @throws Always throws to exercise AudioInput setup error handling.
   */
  public constructor() {
    throw new Error('Recorder setup failed');
  }
}

/**
 * Minimal AudioContext replacement for exercising waveform sampling in the browser.
 */
class MockAudioContext {
  public readonly close = vi.fn(() => Promise.resolve());
  public readonly createAnalyser = vi.fn(() => ({
    fftSize: 256,
    frequencyBinCount: 4,
    getByteTimeDomainData: (samples: Uint8Array): void => {
      samples.set([128, 255, 128, 0]);
    },
    smoothingTimeConstant: 0.72,
  }));
  public readonly createMediaStreamSource = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  public readonly resume = vi.fn(() => Promise.resolve());
}

/**
 * Creates a manually resolvable promise for testing pending async UI.
 * @returns The promise and its resolve/reject controls.
 */
const createDeferred = <TResult,>(): IDeferred<TResult> => {
  let rejectDeferred: ((reason?: unknown) => void) | null = null;
  let resolveDeferred: ((result: TResult) => void) | null = null;

  const promise = new Promise<TResult>((resolve, reject) => {
    resolveDeferred = resolve;
    rejectDeferred = reject;
  });

  if (resolveDeferred === null || rejectDeferred === null) {
    throw new Error('Deferred promise controls were not initialized.');
  }

  return {
    promise,
    reject: rejectDeferred,
    resolve: resolveDeferred,
  };
};

/**
 * Returns the rendered inline error message.
 * @param container The test container to search.
 * @returns The rendered alert element.
 */
const getAudioInputAlert = (container: HTMLElement): HTMLElement => {
  const alert = container.querySelector<HTMLElement>('[role="alert"]');

  if (alert === null) {
    throw new Error('Audio input alert was not found.');
  }

  return alert;
};

/**
 * Returns a rendered button by its visible text content.
 * @param container The test container to search.
 * @param text The visible button text to match.
 * @returns The matching button element, or null when absent.
 */
const queryAudioInputButtonByText = (
  container: HTMLElement,
  text: string,
): HTMLButtonElement | null =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    (buttonElement) => buttonElement.textContent?.trim() === text,
  ) ?? null;

/**
 * Returns a rendered button by its visible text content.
 * @param container The test container to search.
 * @param text The visible button text to match.
 * @returns The matching button element.
 */
const getAudioInputButtonByText = (container: HTMLElement, text: string): HTMLButtonElement => {
  const button = queryAudioInputButtonByText(container, text);

  if (button === null) {
    throw new Error(`Audio input button "${text}" was not found.`);
  }

  return button;
};

/**
 * Flushes the async microphone permission flow after a recording request.
 * @returns A promise that resolves after recording starts.
 */
const flushAudioInputRecordingStart = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

/**
 * Returns the first MediaRecorder created by the component.
 * @returns The created mock recorder.
 */
const getMockRecorder = (): MockMediaRecorder => {
  const recorder = MockMediaRecorder.instances[0];

  if (recorder === undefined) {
    throw new Error('Mock recorder was not created.');
  }

  return recorder;
};

describe('AudioInput', () => {
  let container: HTMLDivElement;
  let requestAnimationFrameCallbacks: FrameRequestCallback[];
  let root: Root;
  let isRootMounted = false;

  /**
   * Flushes the currently queued animation frame callbacks with a shared timestamp.
   * @param timestamp The frame timestamp to pass to each queued callback.
   */
  const flushAnimationFrameCallbacks = (timestamp: number): void => {
    const callbacks = [...requestAnimationFrameCallbacks];

    requestAnimationFrameCallbacks = [];
    callbacks.forEach((callback) => {
      callback(timestamp);
    });
  };

  beforeEach(async () => {
    await page.viewport(1280, 800);
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    requestAnimationFrameCallbacks = [];
    MockMediaRecorder.instances.length = 0;
    MockMediaRecorder.isTypeSupported.mockClear();
    stopTrackMock.mockClear();
    getUserMediaMock.mockResolvedValue({
      getTracks: () => [{ stop: stopTrackMock } as unknown as MediaStreamTrack],
    } as unknown as MediaStream);
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    vi.stubGlobal('AudioContext', MockAudioContext);
    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: MockMediaRecorder,
      writable: true,
    });
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: MockAudioContext,
      writable: true,
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: getUserMediaMock,
      },
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    isRootMounted = true;
  });

  afterEach(() => {
    act(() => {
      if (isRootMounted) root.unmount();
      isRootMounted = false;
    });
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test('records chunks and emits a completed audio file', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      requestAnimationFrameCallbacks.push(callback);

      return requestAnimationFrameCallbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);

    const handleRecordingComplete = vi.fn<(recording: IAudioInputRecording) => void>();
    const handleLimitProgressChange = vi.fn();
    const handleRecordedBytesChange = vi.fn();
    const handleRecordingDataAvailable = vi.fn();
    const handleRecordingStop = vi.fn();
    const handleStatusChange = vi.fn();

    await act(async () => {
      root.render(
        <AudioInput
          autoStart
          defaultIsDialogOpen
          maxBytes={10}
          onLimitProgressChange={handleLimitProgressChange}
          onRecordedBytesChange={handleRecordedBytesChange}
          onRecordingComplete={handleRecordingComplete}
          onRecordingDataAvailable={handleRecordingDataAvailable}
          onRecordingStop={handleRecordingStop}
          onStatusChange={handleStatusChange}
        />,
      );

      await Promise.resolve();
    });

    await flushAudioInputRecordingStart();

    const recorder = getMockRecorder();
    const recorderIcon = document.body.querySelector('[data-slot="audio-input-recorder-icon"]');

    expect(getUserMediaMock).toHaveBeenCalledWith({ audio: true });
    expect(recorder.start).toHaveBeenCalledWith(AUDIO_INPUT_RECORDING_CHUNK_TIMESLICE_MS);
    expect(document.body.textContent).toContain('Listening');
    const recorderSurface = document.body.querySelector('[data-slot="audio-input-recorder"]');

    expect(recorderIcon?.className).toContain('size-11');
    expect(recorderIcon?.className).toContain('bg-destructive');
    expect(document.body.querySelector('[data-slot="audio-input-live-indicator"]')).not.toBeNull();
    expect(recorderSurface?.className).not.toContain('border');
    expect(recorderSurface?.className).not.toContain('rounded');
    expect(recorderSurface?.className).not.toContain('shadow');
    expect(document.body.querySelector('[role="progressbar"]')).toBeNull();
    expect(document.body.querySelector('button[aria-label="Start dictation"]')).toBeNull();
    expect(document.body.querySelector('button[aria-label="Stop dictation"]')).toBeNull();
    expect(
      document.body.querySelector<HTMLButtonElement>('button[aria-label="Restart recording"]')
        ?.disabled,
    ).toBe(false);
    expect(
      document.body.querySelector<HTMLButtonElement>('button[aria-label="Close audio recorder"]')
        ?.disabled,
    ).toBe(false);

    act(() => {
      flushAnimationFrameCallbacks(AUDIO_INPUT_RECORDING_CHUNK_TIMESLICE_MS);
    });

    expect(
      document.body
        .querySelector('[data-slot="audio-input-waveform"]')
        ?.getAttribute('data-active'),
    ).toBe('true');
    const activeWaveformBar = document.body.querySelector('[data-level="100"]');

    expect(activeWaveformBar).not.toBeNull();
    expect(activeWaveformBar?.className).toContain('bg-destructive');

    await act(async () => {
      recorder.emitChunk(new Blob(['hello'], { type: 'audio/webm' }));

      await Promise.resolve();
    });

    expect(handleRecordingDataAvailable).toHaveBeenCalledWith(expect.any(Blob), 5);
    expect(handleRecordedBytesChange).toHaveBeenCalledWith(5);
    expect(handleLimitProgressChange).toHaveBeenCalledWith({
      maxBytes: 10,
      percentage: 50,
      progress: 0.5,
      recordedBytes: 5,
    });

    await act(async () => {
      recorder.stop();

      await Promise.resolve();
    });

    expect(handleRecordingStop).toHaveBeenCalledTimes(1);
    expect(handleRecordingComplete).toHaveBeenCalledTimes(1);
    expect(handleRecordingComplete.mock.calls[0]?.[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(handleRecordingComplete.mock.calls[0]?.[0].fileName).toMatch(
      /^audio-recording-.+\.webm$/,
    );
    expect(handleRecordingComplete.mock.calls[0]?.[0]).toMatchObject({
      mimeType: 'audio/webm;codecs=opus',
      size: 5,
    });
    expect(stopTrackMock).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain('Recording ready');
    expect(handleStatusChange).toHaveBeenCalledWith('requesting-permission');
    expect(handleStatusChange).toHaveBeenCalledWith('recording');
    expect(handleStatusChange).toHaveBeenCalledWith('complete');
  });

  test('opens the recorder dialog from the microphone trigger', async () => {
    await act(async () => {
      root.render(<AudioInput />);

      await Promise.resolve();
    });

    expect(document.body.querySelector('[data-slot="audio-input-recorder"]')).toBeNull();
    const triggerButton = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Open audio recorder"]',
    );

    expect(triggerButton).not.toBeNull();

    await act(async () => {
      triggerButton?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getUserMediaMock).toHaveBeenCalledWith({ audio: true });
    const dialogContent = document.body.querySelector<HTMLElement>('[data-slot="dialog-content"]');
    const dialogHeader = document.body.querySelector<HTMLElement>('[data-slot="dialog-header"]');
    const dialogHeaderActions = document.body.querySelector<HTMLElement>(
      '[data-slot="dialog-header-actions"]',
    );
    const dialogBody = document.body.querySelector<HTMLElement>('[data-slot="dialog-body"]');
    const recorder = document.body.querySelector<HTMLElement>('[data-slot="audio-input-recorder"]');
    const restartButton = document.body.querySelector<HTMLButtonElement>(
      '[aria-label="Restart recording"]',
    );
    const closeButton = document.body.querySelector<HTMLButtonElement>(
      '[aria-label="Close audio recorder"]',
    );

    expect(dialogContent?.dataset['size']).toBe('small');
    expect(dialogContent?.className).toContain('bg-background');
    expect(dialogHeader?.className).toContain('text-left');
    expect(dialogHeader?.className).toContain('items-center');
    expect(dialogHeaderActions?.className).toContain('justify-end');
    expect(dialogHeaderActions?.contains(restartButton ?? null)).toBe(true);
    expect(dialogHeaderActions?.contains(closeButton ?? null)).toBe(true);
    expect(dialogBody?.className).toContain('px-4');
    expect(dialogBody?.className).toContain('pt-2');
    expect(dialogBody?.className).toContain('pb-4');
    expect(dialogBody?.className).toContain('sm:px-5');
    expect(dialogBody?.className).toContain('sm:pt-3');
    expect(dialogBody?.className).toContain('sm:pb-5');
    expect(dialogBody?.className).not.toContain('bg-secondary/35');
    expect(dialogBody?.className).not.toContain('dark:bg-border/20');
    expect(document.body.querySelector('[data-slot="dialog-description"]')).toBeNull();
    expect(document.body.querySelector('[role="dialog"]')?.hasAttribute('aria-describedby')).toBe(
      false,
    );
    expect(dialogBody?.firstElementChild?.getAttribute('data-slot')).toBe(
      'audio-input-recorder-root',
    );
    expect(recorder?.className).not.toContain('pr-20');
    expect(restartButton?.className).toContain('size-11');
    expect(restartButton?.className).toContain('sm:pointer-fine:size-8');
    expect(closeButton?.className).toContain('size-11');
    expect(closeButton?.className).toContain('sm:pointer-fine:size-8');
    expect(closeButton?.className).not.toContain('absolute');
    expect(document.body.querySelector('[data-slot="dialog-title"]')?.textContent).toBe('Audio');
    expect(document.body.textContent).toContain('Listening');
  });

  test('renders an explicitly supplied dialog description', { tags: ['full'] }, () => {
    act(() => {
      root.render(
        <AudioInput
          autoStart={false}
          defaultIsDialogOpen
          dialogDescription="Capture a voice note."
        />,
      );
    });

    expect(document.body.querySelector('[data-slot="dialog-description"]')?.textContent).toBe(
      'Capture a voice note.',
    );
    const descriptionId = document.body
      .querySelector('[role="dialog"]')
      ?.getAttribute('aria-describedby');
    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId!)?.textContent).toBe('Capture a voice note.');
  });

  test('stops and shows an error when the byte limit is exceeded', async () => {
    const handleRecordingComplete = vi.fn();
    const handleRecordingError = vi.fn();

    await act(async () => {
      root.render(
        <AudioInput
          autoStart
          defaultIsDialogOpen
          maxBytes={4}
          onRecordingComplete={handleRecordingComplete}
          onRecordingError={handleRecordingError}
        />,
      );

      await Promise.resolve();
    });

    await flushAudioInputRecordingStart();

    const recorder = getMockRecorder();

    await act(async () => {
      recorder.emitChunk(new Blob(['hello'], { type: 'audio/webm' }));

      await Promise.resolve();
    });

    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(handleRecordingComplete).not.toHaveBeenCalled();
    expect(handleRecordingError).toHaveBeenCalledTimes(1);
    expect(getAudioInputAlert(document.body).textContent).toContain(
      'Recording stopped because it reached the audio limit.',
    );
    expect(getAudioInputAlert(document.body).textContent).not.toContain(
      'Code: AUDIO_INPUT_MAX_BYTES_EXCEEDED',
    );
    expect(document.body.textContent).toContain('Recording stopped');
    expect(stopTrackMock).toHaveBeenCalledTimes(1);
  });

  test('transcribes captured audio after the byte limit is reached', async () => {
    const handleRecordingComplete = vi.fn();
    const handleRecordingError = vi.fn();
    const handleTranscribe = vi.fn<(recording: IAudioInputRecording) => Promise<string>>(() =>
      Promise.resolve('Transcribed from the capped recording'),
    );

    await act(async () => {
      root.render(
        <AudioInput
          autoStart
          defaultIsDialogOpen
          maxBytes={10}
          transcribe={handleTranscribe}
          onRecordingComplete={handleRecordingComplete}
          onRecordingError={handleRecordingError}
        />,
      );

      await Promise.resolve();
    });

    await flushAudioInputRecordingStart();

    const recorder = getMockRecorder();

    await act(async () => {
      recorder.emitChunk(new Blob(['hello'], { type: 'audio/webm' }));
      recorder.emitChunk(new Blob(['world!'], { type: 'audio/webm' }));

      await Promise.resolve();
    });

    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(handleRecordingComplete).not.toHaveBeenCalled();
    expect(handleRecordingError).toHaveBeenCalledTimes(1);
    const alert = getAudioInputAlert(document.body);

    expect(alert.textContent).toContain('Recording stopped because it reached the audio limit.');
    const transcribeRecordingButton = getAudioInputButtonByText(
      document.body,
      'Transcribe recording',
    );

    expect(
      alert.compareDocumentPosition(transcribeRecordingButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);

    await act(async () => {
      transcribeRecordingButton.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(handleTranscribe).toHaveBeenCalledTimes(1);
    expect(handleTranscribe.mock.calls[0]?.[0]).toMatchObject({
      mimeType: 'audio/webm;codecs=opus',
      size: 5,
    });
    expect(document.body.querySelector('[role="alert"]')).toBeNull();
    expect(document.body.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe(
      'Transcribed from the capped recording',
    );
  });

  test('retries transcription for captured audio after the byte limit is reached', async () => {
    const handleRecordingError = vi.fn();
    const handleTranscriptionError = vi.fn();
    const handleTranscribe = vi
      .fn<(recording: IAudioInputRecording) => Promise<string>>()
      .mockRejectedValueOnce(new Exception('Upload failed.', { code: 'AUDIO_UPLOAD_FAILED' }))
      .mockResolvedValueOnce('Recovered capped transcription');

    await act(async () => {
      root.render(
        <AudioInput
          autoStart
          defaultIsDialogOpen
          maxBytes={10}
          transcribe={handleTranscribe}
          onRecordingError={handleRecordingError}
          onTranscriptionError={handleTranscriptionError}
        />,
      );

      await Promise.resolve();
    });

    await flushAudioInputRecordingStart();

    const recorder = getMockRecorder();

    await act(async () => {
      recorder.emitChunk(new Blob(['hello'], { type: 'audio/webm' }));
      recorder.emitChunk(new Blob(['world!'], { type: 'audio/webm' }));

      await Promise.resolve();
    });

    await act(async () => {
      getAudioInputButtonByText(document.body, 'Transcribe recording').click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(handleRecordingError).toHaveBeenCalledTimes(1);
    expect(handleTranscriptionError).toHaveBeenCalledTimes(1);
    expect(getAudioInputAlert(document.body).textContent).toContain('Audio transcription failed.');
    const retryButton = getAudioInputButtonByText(document.body, 'Retry');

    await act(async () => {
      retryButton.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(handleTranscribe).toHaveBeenCalledTimes(2);
    expect(document.body.querySelector('[role="alert"]')).toBeNull();
    expect(document.body.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe(
      'Recovered capped transcription',
    );
  });

  test('shows a browser support error when MediaRecorder is unavailable', async () => {
    const handleRecordingError = vi.fn();

    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: undefined,
      writable: true,
    });
    vi.stubGlobal('MediaRecorder', undefined);

    await act(async () => {
      root.render(
        <AudioInput
          autoStart
          defaultIsDialogOpen
          onRecordingError={handleRecordingError}
        />,
      );

      await Promise.resolve();
    });

    await flushAudioInputRecordingStart();

    expect(getUserMediaMock).not.toHaveBeenCalled();
    expect(handleRecordingError).toHaveBeenCalledTimes(1);
    expect(getAudioInputAlert(document.body).textContent).toContain(
      'Audio recording is not supported in this browser.',
    );
    expect(getAudioInputAlert(document.body).textContent).not.toContain(
      'Code: AUDIO_INPUT_UNSUPPORTED',
    );
  });

  test('shows a microphone permission error when access fails', async () => {
    const handleRecordingError = vi.fn();

    getUserMediaMock.mockRejectedValueOnce(new Error('Permission denied'));

    await act(async () => {
      root.render(
        <AudioInput
          autoStart
          defaultIsDialogOpen
          transcribe={() => Promise.resolve('Unused transcription')}
          onRecordingError={handleRecordingError}
        />,
      );

      await Promise.resolve();
    });

    await flushAudioInputRecordingStart();

    expect(handleRecordingError).toHaveBeenCalledTimes(1);
    const alert = getAudioInputAlert(document.body);
    const actionRow = document.body.querySelector(
      '[data-slot="audio-input-transcription-actions"]',
    );

    expect(alert.textContent).toContain('Microphone access failed.');
    expect(alert.textContent).not.toContain('Code: AUDIO_INPUT_MICROPHONE_ACCESS_FAILED');
    expect(alert.className).toContain('text-center');
    expect(actionRow).not.toBeNull();
    expect(
      actionRow === null
        ? 0
        : alert.compareDocumentPosition(actionRow) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
  });

  test('does not report microphone errors after pending permission is canceled', async () => {
    const deferredMediaStream = createDeferred<MediaStream>();
    const handleRecordingCancel = vi.fn();
    const handleRecordingError = vi.fn();

    getUserMediaMock.mockReturnValueOnce(deferredMediaStream.promise);

    await act(async () => {
      root.render(
        <AudioInput
          autoStart
          defaultIsDialogOpen
          transcribe={() => Promise.resolve('Unused transcription')}
          onRecordingCancel={handleRecordingCancel}
          onRecordingError={handleRecordingError}
        />,
      );
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain('Starting...');

    await act(async () => {
      getAudioInputButtonByText(document.body, 'Cancel').click();
      await Promise.resolve();
    });

    await act(async () => {
      deferredMediaStream.reject(new Error('Permission denied'));
      await deferredMediaStream.promise.catch(() => undefined);
      await Promise.resolve();
    });

    expect(handleRecordingCancel).toHaveBeenCalledTimes(1);
    expect(handleRecordingError).not.toHaveBeenCalled();
  });

  test('releases microphone tracks when MediaRecorder setup fails', async () => {
    const handleRecordingError = vi.fn();

    ThrowingMediaRecorder.isTypeSupported.mockClear();
    vi.stubGlobal('MediaRecorder', ThrowingMediaRecorder);
    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: ThrowingMediaRecorder,
      writable: true,
    });

    await act(async () => {
      root.render(
        <AudioInput
          autoStart
          defaultIsDialogOpen
          onRecordingError={handleRecordingError}
        />,
      );

      await Promise.resolve();
    });

    await flushAudioInputRecordingStart();

    expect(stopTrackMock).toHaveBeenCalledTimes(1);
    expect(handleRecordingError).toHaveBeenCalledTimes(1);
    expect(getAudioInputAlert(document.body).textContent).toContain('Audio recording failed.');
    expect(getAudioInputAlert(document.body).textContent).not.toContain(
      'Code: AUDIO_INPUT_RECORDING_FAILED',
    );
  });

  test('transcribes and sends a completed recording from the primary action', async () => {
    const handleTranscribe = vi.fn<(recording: IAudioInputRecording) => Promise<string>>(() =>
      Promise.resolve('Send this transcription'),
    );
    const handleTranscriptionResult = vi.fn();

    await act(async () => {
      root.render(
        <AudioInput
          autoStart
          defaultIsDialogOpen
          transcribe={handleTranscribe}
          onTranscriptionResult={handleTranscriptionResult}
        />,
      );

      await Promise.resolve();
    });

    await flushAudioInputRecordingStart();
    const recorder = getMockRecorder();
    const form = document.body.querySelector<HTMLFormElement>('form');

    expect(form?.noValidate).toBe(true);

    await act(async () => {
      recorder.emitChunk(new Blob(['hello'], { type: 'audio/webm' }));

      await Promise.resolve();
    });

    await act(async () => {
      const sendButton = getAudioInputButtonByText(document.body, 'Send');

      expect(sendButton.type).toBe('submit');
      sendButton.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(handleTranscribe).toHaveBeenCalledTimes(1);
    expect(handleTranscribe.mock.calls[0]?.[0].fileName).toMatch(/^audio-recording-.+\.webm$/);
    expect(handleTranscribe.mock.calls[0]?.[0].size).toBe(5);
    expect(handleTranscriptionResult).toHaveBeenCalledWith(
      'Send this transcription',
      expect.objectContaining({
        size: 5,
      }),
    );
    expect(document.body.querySelector('textarea')).toBeNull();
  });

  test('transcribes into an editable text area before sending', async () => {
    const handleTranscribe = vi.fn<(recording: IAudioInputRecording) => Promise<string>>(() =>
      Promise.resolve('Original transcription'),
    );
    const handleTranscriptionResult = vi.fn();
    const handleTranscriptionTextChange = vi.fn();

    await act(async () => {
      root.render(
        <AudioInput
          autoStart
          defaultIsDialogOpen
          transcribe={handleTranscribe}
          onTranscriptionResult={handleTranscriptionResult}
          onTranscriptionTextChange={handleTranscriptionTextChange}
        />,
      );

      await Promise.resolve();
    });

    await flushAudioInputRecordingStart();
    const recorder = getMockRecorder();

    await act(async () => {
      recorder.emitChunk(new Blob(['hello'], { type: 'audio/webm' }));

      await Promise.resolve();
    });

    await act(async () => {
      getAudioInputButtonByText(document.body, 'Transcribe').click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(recorder.stop).toHaveBeenCalledTimes(1);
    const textarea = document.body.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Transcription"]',
    );

    expect(textarea).not.toBeNull();
    expect(textarea?.dataset['slot']).toBe('audio-input-transcription-editor');
    expect(textarea?.value).toBe('Original transcription');
    expect(queryAudioInputButtonByText(document.body, 'Transcribe')).toBeNull();

    await act(async () => {
      if (textarea !== null) {
        const valueDescriptor = Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          'value',
        );

        valueDescriptor?.set?.call(textarea, '  Edited transcription  ');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }

      await Promise.resolve();
    });

    await act(async () => {
      const sendButton = getAudioInputButtonByText(document.body, 'Send');

      expect(sendButton.type).toBe('submit');
      sendButton.click();
      await Promise.resolve();
    });

    expect(handleTranscriptionTextChange).toHaveBeenCalledWith('  Edited transcription  ');
    expect(handleTranscriptionResult).toHaveBeenCalledWith(
      'Edited transcription',
      expect.objectContaining({
        size: 5,
      }),
    );
  });

  test('keeps an empty authored transcription local with an accessible form error', async () => {
    const handleTranscribe = vi.fn<(recording: IAudioInputRecording) => Promise<string>>(() =>
      Promise.resolve('   '),
    );
    const handleTranscriptionResult = vi.fn();

    await act(async () => {
      root.render(
        <AudioInput
          autoStart
          defaultIsDialogOpen
          transcribe={handleTranscribe}
          onTranscriptionResult={handleTranscriptionResult}
        />,
      );

      await Promise.resolve();
    });

    await flushAudioInputRecordingStart();
    const recorder = getMockRecorder();

    await act(async () => {
      recorder.emitChunk(new Blob(['hello'], { type: 'audio/webm' }));
      getAudioInputButtonByText(document.body, 'Transcribe').click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const textarea = document.body.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Transcription"]',
    );
    const form = textarea?.closest('form');

    if (textarea === null || form === null || form === undefined) {
      throw new Error('Expected the editable transcription form to render.');
    }

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    const alert = getAudioInputAlert(document.body);

    expect(handleTranscriptionResult).not.toHaveBeenCalled();
    expect(alert.textContent).toBe('Enter a transcription before sending.');
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    expect(textarea.getAttribute('aria-describedby')).toBe(alert.id);
  });

  test('synchronizes controlled transcription values without taking ownership from the parent', async () => {
    const handleTranscriptionTextChange = vi.fn();

    await act(async () => {
      root.render(
        <AudioInput
          autoStart={false}
          defaultIsDialogOpen
          defaultIsTranscriptionEditorVisible
          transcription="Parent transcription"
          onTranscriptionTextChange={handleTranscriptionTextChange}
        />,
      );

      await Promise.resolve();
    });

    const textarea = document.body.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Transcription"]',
    );

    if (textarea === null) {
      throw new Error('Expected the controlled transcription editor to render.');
    }

    await act(async () => {
      const valueDescriptor = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
      );

      valueDescriptor?.set?.call(textarea, 'Requested parent update');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));

      await Promise.resolve();
    });

    expect(handleTranscriptionTextChange).toHaveBeenCalledWith('Requested parent update');
    expect(textarea.value).toBe('Parent transcription');

    await act(async () => {
      root.render(
        <AudioInput
          autoStart={false}
          defaultIsDialogOpen
          defaultIsTranscriptionEditorVisible
          transcription="Updated parent transcription"
          onTranscriptionTextChange={handleTranscriptionTextChange}
        />,
      );
      await Promise.resolve();
    });

    expect(
      document.body.querySelector<HTMLTextAreaElement>('textarea[aria-label="Transcription"]')
        ?.value,
    ).toBe('Updated parent transcription');
  });

  test('keeps the transcription editor mounted during the post-send close window', async () => {
    vi.useFakeTimers();

    const handleTranscribe = vi.fn<(recording: IAudioInputRecording) => Promise<string>>(() =>
      Promise.resolve('Original transcription'),
    );
    const handleTranscriptionResult = vi.fn();

    await act(async () => {
      root.render(
        <AudioInput
          autoStart
          cancelResetDelayMs={220}
          isDialogOpen
          transcribe={handleTranscribe}
          onTranscriptionResult={handleTranscriptionResult}
        />,
      );

      await Promise.resolve();
    });

    await flushAudioInputRecordingStart();
    const recorder = getMockRecorder();

    await act(async () => {
      recorder.emitChunk(new Blob(['hello'], { type: 'audio/webm' }));

      await Promise.resolve();
    });

    await act(async () => {
      getAudioInputButtonByText(document.body, 'Transcribe').click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.body.querySelector('textarea')).not.toBeNull();

    await act(async () => {
      const sendButton = getAudioInputButtonByText(document.body, 'Send');

      sendButton.click();
      await Promise.resolve();
      await Promise.resolve();

      expect(sendButton.disabled).toBe(true);
    });

    expect(handleTranscriptionResult).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('textarea')).not.toBeNull();
    expect(
      document.body.querySelector('[data-slot="audio-input-transcription-loading"]'),
    ).toBeNull();
    expect(
      document.body.querySelector<HTMLButtonElement>('button[aria-label="Restart recording"]')
        ?.disabled,
    ).toBe(false);
    expect(
      document.body.querySelector<HTMLButtonElement>('button[aria-label="Close audio recorder"]')
        ?.disabled,
    ).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(219);
    });

    expect(document.body.querySelector('textarea')).not.toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(document.body.querySelector('textarea')).toBeNull();
    expect(
      document.body.querySelector('[data-slot="audio-input-transcription-loading"]'),
    ).toBeNull();
  });

  test('disables every dialog button and shows submitting while transcription is pending', async () => {
    const deferredTranscription = createDeferred<string>();
    const handleTranscribe = vi.fn(() => deferredTranscription.promise);

    await act(async () => {
      root.render(
        <AudioInput
          autoStart
          defaultIsDialogOpen
          transcribe={handleTranscribe}
        />,
      );

      await Promise.resolve();
    });

    await flushAudioInputRecordingStart();
    const recorder = getMockRecorder();

    await act(async () => {
      recorder.emitChunk(new Blob(['hello'], { type: 'audio/webm' }));

      await Promise.resolve();
    });

    await act(async () => {
      getAudioInputButtonByText(document.body, 'Transcribe').click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const dialogContent = document.body.querySelector<HTMLElement>('[data-slot="dialog-content"]');
    const loadingStatus = document.body.querySelector<HTMLElement>(
      '[data-slot="audio-input-transcription-loading"]',
    );

    if (dialogContent === null) {
      throw new Error('Audio input dialog content was not found.');
    }

    const dialogButtons = Array.from(dialogContent.querySelectorAll<HTMLButtonElement>('button'));

    expect(handleTranscribe).toHaveBeenCalledTimes(1);
    expect(loadingStatus?.textContent).toBe('Submitting...');
    expect(dialogButtons).toHaveLength(5);
    expect(dialogButtons.every((button) => button.disabled)).toBe(true);

    await act(async () => {
      deferredTranscription.resolve('Pending transcription complete');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      document.body.querySelector('[data-slot="audio-input-transcription-loading"]'),
    ).toBeNull();
    expect(document.body.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe(
      'Pending transcription complete',
    );
  });

  test('keeps Exception diagnostics private and lets the user retry', async () => {
    const retryFailure = createDeferred<string>();
    const handleTranscribe = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Exception('Upload failed.', { code: 'AUDIO_UPLOAD_FAILED' }))
      .mockImplementationOnce(() => retryFailure.promise)
      .mockResolvedValueOnce('Recovered transcription');
    const handleTranscriptionError = vi.fn();

    await act(async () => {
      root.render(
        <AudioInput
          autoStart
          defaultIsDialogOpen
          transcribe={handleTranscribe}
          onTranscriptionError={handleTranscriptionError}
        />,
      );

      await Promise.resolve();
    });

    await flushAudioInputRecordingStart();
    const recorder = getMockRecorder();

    await act(async () => {
      recorder.emitChunk(new Blob(['hello'], { type: 'audio/webm' }));

      await Promise.resolve();
    });

    await act(async () => {
      getAudioInputButtonByText(document.body, 'Transcribe').click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(handleTranscriptionError).toHaveBeenCalledTimes(1);
    expectToThrowCode(() => {
      throw handleTranscriptionError.mock.calls[0]?.[0];
    }, 'AUDIO_UPLOAD_FAILED');
    const alert = getAudioInputAlert(document.body);

    expect(alert.textContent).toContain('Audio transcription failed.');
    expect(alert.textContent).not.toContain('Upload failed.');
    expect(alert.textContent).not.toContain('Code: AUDIO_UPLOAD_FAILED');
    const initialRetryButton = getAudioInputButtonByText(document.body, 'Retry');
    const initialTranscribeButton = getAudioInputButtonByText(document.body, 'Transcribe');
    const initialSendButton = getAudioInputButtonByText(document.body, 'Send');

    expect(
      initialRetryButton.closest('[data-slot="audio-input-transcription-actions"]'),
    ).toBeNull();
    expect(
      alert.compareDocumentPosition(initialRetryButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    expect(initialRetryButton.disabled).toBe(false);
    expect(initialTranscribeButton.disabled).toBe(true);
    expect(initialSendButton.disabled).toBe(true);

    await act(async () => {
      initialRetryButton.click();
      await Promise.resolve();
    });

    expect(handleTranscribe).toHaveBeenCalledTimes(2);
    expect(getAudioInputButtonByText(document.body, 'Retry').disabled).toBe(true);
    expect(getAudioInputButtonByText(document.body, 'Transcribe').disabled).toBe(true);
    expect(getAudioInputButtonByText(document.body, 'Send').disabled).toBe(true);

    await act(async () => {
      retryFailure.reject(new Exception('Upload failed again.', { code: 'AUDIO_UPLOAD_FAILED' }));
      await retryFailure.promise.catch(() => undefined);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(handleTranscribe).toHaveBeenCalledTimes(2);
    expect(handleTranscriptionError).toHaveBeenCalledTimes(2);
    const retryAlert = getAudioInputAlert(document.body);

    expect(retryAlert.textContent).toContain('Audio transcription failed.');
    expect(retryAlert.textContent).not.toContain('Upload failed again.');
    expect(retryAlert.textContent).not.toContain('Code: AUDIO_UPLOAD_FAILED');
    const secondRetryButton = getAudioInputButtonByText(document.body, 'Retry');
    const blockedTranscribeButton = getAudioInputButtonByText(document.body, 'Transcribe');
    const blockedSendButton = getAudioInputButtonByText(document.body, 'Send');

    expect(secondRetryButton.disabled).toBe(false);
    expect(blockedTranscribeButton.disabled).toBe(true);
    expect(blockedSendButton.disabled).toBe(true);

    await act(async () => {
      secondRetryButton.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(handleTranscribe).toHaveBeenCalledTimes(3);
    expect(document.body.querySelector('[role="alert"]')).toBeNull();
    expect(document.body.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe(
      'Recovered transcription',
    );
  });

  test('shows an error when sending the transcription result fails', async () => {
    const handleTranscribe = vi.fn<(recording: IAudioInputRecording) => Promise<string>>(() =>
      Promise.resolve('Send this transcription'),
    );
    const handleTranscriptionError = vi.fn();
    const handleTranscriptionResult = vi.fn((): Promise<void> => {
      return Promise.reject(new Error('Message send failed'));
    });

    await act(async () => {
      root.render(
        <AudioInput
          autoStart
          defaultIsDialogOpen
          transcribe={handleTranscribe}
          onTranscriptionError={handleTranscriptionError}
          onTranscriptionResult={handleTranscriptionResult}
        />,
      );

      await Promise.resolve();
    });

    await flushAudioInputRecordingStart();
    const recorder = getMockRecorder();

    await act(async () => {
      recorder.emitChunk(new Blob(['hello'], { type: 'audio/webm' }));

      await Promise.resolve();
    });

    await act(async () => {
      getAudioInputButtonByText(document.body, 'Send').click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(handleTranscriptionResult).toHaveBeenCalledTimes(1);
    expect(handleTranscriptionError).toHaveBeenCalledTimes(1);
    expect(getAudioInputAlert(document.body).textContent).toContain(
      'Transcription could not be sent.',
    );
    expect(getAudioInputAlert(document.body).textContent).not.toContain(
      'Code: AUDIO_INPUT_TRANSCRIPTION_RESULT_FAILED',
    );
  });

  test('cancels an active recording from the dialog action row', async () => {
    const handleCancel = vi.fn();
    const handleRecordingCancel = vi.fn();
    const handleRecordingComplete = vi.fn();
    const handleTranscribe = vi.fn((): Promise<string> =>
      Promise.resolve('Canceled transcription'),
    );

    await act(async () => {
      root.render(
        <AudioInput
          autoStart
          defaultIsDialogOpen
          transcribe={handleTranscribe}
          onCancel={handleCancel}
          onRecordingCancel={handleRecordingCancel}
          onRecordingComplete={handleRecordingComplete}
        />,
      );

      await Promise.resolve();
    });

    await flushAudioInputRecordingStart();
    const recorder = getMockRecorder();
    const cancelButton = getAudioInputButtonByText(document.body, 'Cancel');
    const transcribeButton = getAudioInputButtonByText(document.body, 'Transcribe');
    const sendButton = getAudioInputButtonByText(document.body, 'Send');

    expect(cancelButton.dataset['variant']).toBe('destructive');
    expect(cancelButton.querySelector('svg')).toBeNull();
    expect(transcribeButton.querySelector('svg')).toBeNull();
    expect(sendButton.querySelector('svg')).not.toBeNull();

    await act(async () => {
      cancelButton.click();
      await Promise.resolve();
    });

    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(stopTrackMock).toHaveBeenCalledTimes(1);
    expect(handleCancel).toHaveBeenCalledTimes(1);
    expect(handleRecordingCancel).toHaveBeenCalledTimes(1);
    expect(handleRecordingComplete).not.toHaveBeenCalled();
    expect(handleTranscribe).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(document.body.querySelector('[data-slot="dialog-content"]')).toBeNull(),
    );
    expect(document.body.querySelector('button[aria-label="Open audio recorder"]')).not.toBeNull();
  });

  test('restarts the active recording from the dialog utility action', async () => {
    vi.useFakeTimers();

    const handleRecordingCancel = vi.fn();
    const handleRecordingComplete = vi.fn();

    await act(async () => {
      root.render(
        <AudioInput
          autoStart
          defaultIsDialogOpen
          onRecordingCancel={handleRecordingCancel}
          onRecordingComplete={handleRecordingComplete}
        />,
      );

      await Promise.resolve();
    });

    await flushAudioInputRecordingStart();
    const firstRecorder = getMockRecorder();
    const restartButton = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Restart recording"]',
    );

    await act(async () => {
      firstRecorder.emitChunk(new Blob(['hello'], { type: 'audio/webm' }));

      await Promise.resolve();
    });

    expect(restartButton).not.toBeNull();

    await act(async () => {
      restartButton?.click();
      await Promise.resolve();
    });

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(firstRecorder.stop).toHaveBeenCalledTimes(1);
    expect(stopTrackMock).toHaveBeenCalledTimes(1);
    expect(handleRecordingCancel).toHaveBeenCalledTimes(1);
    expect(handleRecordingComplete).not.toHaveBeenCalled();
    expect(MockMediaRecorder.instances).toHaveLength(2);
    expect(MockMediaRecorder.instances[1]?.start).toHaveBeenCalledWith(
      AUDIO_INPUT_RECORDING_CHUNK_TIMESLICE_MS,
    );
    expect(document.body.textContent).toContain('Listening');
  });

  test(
    'can delay visible reset after cancel for dialog exit animations',
    { tags: ['full'] },
    async () => {
      vi.useFakeTimers();

      const handleCancel = vi.fn();
      const handleTranscribe = vi.fn((): Promise<string> =>
        Promise.resolve('Canceled transcription'),
      );

      await act(async () => {
        root.render(
          <AudioInput
            autoStart
            cancelResetDelayMs={220}
            isDialogOpen
            transcribe={handleTranscribe}
            onCancel={handleCancel}
          />,
        );

        await Promise.resolve();
      });

      await flushAudioInputRecordingStart();
      const recorder = getMockRecorder();

      await act(async () => {
        getAudioInputButtonByText(document.body, 'Cancel').click();
        await Promise.resolve();
      });

      expect(recorder.stop).toHaveBeenCalledTimes(1);
      expect(stopTrackMock).toHaveBeenCalledTimes(1);
      expect(handleCancel).toHaveBeenCalledTimes(1);
      expect(handleTranscribe).not.toHaveBeenCalled();
      expect(document.body.textContent).toContain('Listening');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(220);
      });

      expect(document.body.textContent).toContain('Dictate');
    },
  );

  test('allows a parent to control the recording request', async () => {
    const handleRecordingActiveChange = vi.fn();
    const handleRecordingComplete = vi.fn();

    await act(async () => {
      root.render(
        <AudioInput
          defaultIsDialogOpen
          isRecording={false}
          onRecordingActiveChange={handleRecordingActiveChange}
          onRecordingComplete={handleRecordingComplete}
        />,
      );

      await Promise.resolve();
    });

    expect(MockMediaRecorder.instances).toHaveLength(0);

    await act(async () => {
      root.render(
        <AudioInput
          defaultIsDialogOpen
          isRecording
          onRecordingActiveChange={handleRecordingActiveChange}
          onRecordingComplete={handleRecordingComplete}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const recorder = MockMediaRecorder.instances[0];

    expect(recorder?.start).toHaveBeenCalledWith(AUDIO_INPUT_RECORDING_CHUNK_TIMESLICE_MS);

    await act(async () => {
      recorder?.emitChunk(new Blob(['hello'], { type: 'audio/webm' }));

      await Promise.resolve();
    });

    await act(async () => {
      root.render(
        <AudioInput
          defaultIsDialogOpen
          isRecording={false}
          onRecordingActiveChange={handleRecordingActiveChange}
          onRecordingComplete={handleRecordingComplete}
        />,
      );
      await Promise.resolve();
    });

    expect(recorder?.stop).toHaveBeenCalledTimes(1);
    expect(handleRecordingComplete).toHaveBeenCalledTimes(1);
    expect(handleRecordingActiveChange).toHaveBeenCalledWith(false);
  });

  test('exposes controls for external dialog coordination', async () => {
    const controlsRef = createRef<IAudioInputControls>();
    const handleRecordingCancel = vi.fn();
    const handleRecordingComplete = vi.fn();

    await act(async () => {
      root.render(
        <AudioInput
          controlsRef={controlsRef}
          onRecordingCancel={handleRecordingCancel}
          onRecordingComplete={handleRecordingComplete}
        />,
      );

      await Promise.resolve();
    });

    expect(controlsRef.current?.restartRecording).toEqual(expect.any(Function));

    await act(async () => {
      controlsRef.current?.startRecording();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(MockMediaRecorder.instances[0]?.start).toHaveBeenCalledWith(
      AUDIO_INPUT_RECORDING_CHUNK_TIMESLICE_MS,
    );

    await act(async () => {
      controlsRef.current?.cancelRecording();
      await Promise.resolve();
    });

    expect(stopTrackMock).toHaveBeenCalledTimes(1);
    expect(handleRecordingCancel).toHaveBeenCalledTimes(1);
    expect(handleRecordingComplete).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(document.body.querySelector('[data-slot="dialog-content"]')).toBeNull(),
    );
    expect(document.body.querySelector('button[aria-label="Open audio recorder"]')).not.toBeNull();
  });

  test('ignores permission results from a recording replaced by restart', async () => {
    const firstPermission = createDeferred<MediaStream>();
    const secondPermission = createDeferred<MediaStream>();
    const stopFirst = vi.fn<() => void>();
    const stopSecond = vi.fn<() => void>();
    const firstStream = { getTracks: () => [{ stop: stopFirst }] } as unknown as MediaStream;
    const secondStream = { getTracks: () => [{ stop: stopSecond }] } as unknown as MediaStream;
    getUserMediaMock
      .mockReset()
      .mockImplementationOnce(() => firstPermission.promise)
      .mockImplementationOnce(() => secondPermission.promise);
    const controlsRef = createRef<IAudioInputControls>();
    await act(async () => {
      root.render(
        <AudioInput
          defaultIsDialogOpen
          controlsRef={controlsRef}
        />,
      );
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(getUserMediaMock).toHaveBeenCalledTimes(1));
    await act(async () => {
      controlsRef.current?.restartRecording();
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(getUserMediaMock).toHaveBeenCalledTimes(2));
    await act(async () => {
      secondPermission.resolve(secondStream);
      await secondPermission.promise;
    });
    expect(MockMediaRecorder.instances).toHaveLength(1);
    await act(async () => {
      firstPermission.resolve(firstStream);
      await firstPermission.promise;
    });
    expect(stopFirst).toHaveBeenCalledOnce();
    expect(MockMediaRecorder.instances).toHaveLength(1);
    expect(stopSecond).not.toHaveBeenCalled();
    await act(async () => {
      controlsRef.current?.cancelRecording();
      await Promise.resolve();
    });
    expect(stopSecond).toHaveBeenCalledOnce();
  });

  test.each(['fulfilled', 'rejected'] as const)(
    'ignores %s transcription after unmount',
    async (outcome) => {
      const pending = createDeferred<string>();
      const transcribe = vi.fn(() => pending.promise);
      const onTranscriptionResult =
        vi.fn<(text: string, recording: IAudioInputRecording) => void>();
      const onTranscriptionComplete =
        vi.fn<(text: string, recording: IAudioInputRecording) => void>();
      const onTranscriptionError = vi.fn<(error: Error) => void>();
      await act(async () => {
        root.render(
          <AudioInput
            defaultIsDialogOpen
            transcribe={transcribe}
            onTranscriptionResult={onTranscriptionResult}
            onTranscriptionComplete={onTranscriptionComplete}
            onTranscriptionError={onTranscriptionError}
          />,
        );
        await Promise.resolve();
      });
      await flushAudioInputRecordingStart();
      await act(async () => {
        getMockRecorder().emitChunk(new Blob(['voice'], { type: 'audio/webm' }));
        getAudioInputButtonByText(document.body, 'Send').click();
        await Promise.resolve();
      });
      await vi.waitFor(() => expect(transcribe).toHaveBeenCalledOnce());
      act(() => {
        root.unmount();
        isRootMounted = false;
      });
      await act(async () => {
        if (outcome === 'fulfilled') {
          pending.resolve('Late text');
          await pending.promise;
        } else {
          pending.reject(new Error('Private provider diagnostics'));
          await expect(pending.promise).rejects.toThrow('Private provider diagnostics');
        }
      });
      expect(onTranscriptionResult).not.toHaveBeenCalled();
      expect(onTranscriptionComplete).not.toHaveBeenCalled();
      expect(onTranscriptionError).not.toHaveBeenCalled();
      expect(stopTrackMock).toHaveBeenCalledOnce();
    },
  );

  test('closes a partially initialized waveform context while recording remains usable', async () => {
    const close = vi.fn(() => Promise.resolve());
    class BrokenAudioContext {
      public close = close;
      public createAnalyser = () => {
        throw new Error('Analyser setup failed');
      };
    }
    vi.stubGlobal('AudioContext', BrokenAudioContext);
    const controlsRef = createRef<IAudioInputControls>();
    await act(async () => {
      root.render(
        <AudioInput
          defaultIsDialogOpen
          controlsRef={controlsRef}
        />,
      );
      await Promise.resolve();
    });
    await flushAudioInputRecordingStart();
    expect(getMockRecorder().state).toBe('recording');
    expect(close).toHaveBeenCalledOnce();
    await act(async () => {
      controlsRef.current?.cancelRecording();
      await Promise.resolve();
    });
    expect(stopTrackMock).toHaveBeenCalledOnce();
  });

  test('does not request dialog closure when result delivery finishes after unmount', async () => {
    const pending = createDeferred<void>();
    const onDialogOpenChange = vi.fn<(open: boolean) => void>();
    const onTranscriptionResult = vi.fn(() => pending.promise);
    await act(async () => {
      root.render(
        <AudioInput
          defaultIsDialogOpen
          transcribe={() => Promise.resolve('Voice note')}
          onTranscriptionResult={onTranscriptionResult}
          onDialogOpenChange={onDialogOpenChange}
        />,
      );
      await Promise.resolve();
    });
    await flushAudioInputRecordingStart();
    await act(async () => {
      getMockRecorder().emitChunk(new Blob(['voice'], { type: 'audio/webm' }));
      getAudioInputButtonByText(document.body, 'Send').click();
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(onTranscriptionResult).toHaveBeenCalledOnce());
    onDialogOpenChange.mockClear();
    act(() => {
      root.unmount();
      isRootMounted = false;
    });
    await act(async () => {
      pending.resolve(undefined);
      await pending.promise;
    });
    expect(onDialogOpenChange).not.toHaveBeenCalled();
  });

  test.each(['startRecording', 'restartRecording'] as const)(
    'releases a deferred %s command on unmount',
    async (command) => {
      const controlsRef = createRef<IAudioInputControls>();
      await act(async () => {
        root.render(
          <AudioInput
            autoStart={false}
            controlsRef={controlsRef}
          />,
        );
        await Promise.resolve();
      });
      vi.useFakeTimers();
      act(() => controlsRef.current?.[command]());
      act(() => {
        root.unmount();
        isRootMounted = false;
      });
      await vi.runOnlyPendingTimersAsync();
      expect(getUserMediaMock).not.toHaveBeenCalled();
    },
  );

  test('notifies each recording status once under Strict Mode', async () => {
    const onStatusChange = vi.fn<(status: string) => void>();
    const controlsRef = createRef<IAudioInputControls>();
    await act(async () => {
      root.render(
        <StrictMode>
          <AudioInput
            defaultIsDialogOpen
            controlsRef={controlsRef}
            onStatusChange={onStatusChange}
          />
        </StrictMode>,
      );
      await Promise.resolve();
    });
    await vi.waitFor(() =>
      expect(onStatusChange.mock.calls.some(([status]) => status === 'recording')).toBe(true),
    );
    expect(
      onStatusChange.mock.calls.filter(([status]) => status === 'requesting-permission'),
    ).toHaveLength(1);
    expect(onStatusChange.mock.calls.filter(([status]) => status === 'recording')).toHaveLength(1);
    await act(async () => {
      controlsRef.current?.cancelRecording();
      await Promise.resolve();
    });
  });

  test.each([
    [
      'unsupported',
      (operation: () => never) =>
        expectToThrowCode(
          operation,
          'AUDIO_INPUT_UNSUPPORTED',
          'Audio recording is not supported in this browser.',
        ),
    ],
    [
      'permission',
      (operation: () => never) =>
        expectToThrowCode(
          operation,
          'AUDIO_INPUT_MICROPHONE_ACCESS_FAILED',
          'Microphone access failed.',
        ),
    ],
    [
      'runtime',
      (operation: () => never) =>
        expectToThrowCode(operation, 'AUDIO_INPUT_RECORDING_FAILED', 'Audio recording failed.'),
    ],
    [
      'limit',
      (operation: () => never) =>
        expectToThrowCode(
          operation,
          'AUDIO_INPUT_MAX_BYTES_EXCEEDED',
          'Recording stopped because it reached the audio limit.',
        ),
    ],
  ] as const)(
    'reports the owned %s recording contract and releases resources',
    async (failure, assertFailure) => {
      const onRecordingError = vi.fn<(error: Error) => void>();
      if (failure === 'unsupported') vi.stubGlobal('MediaRecorder', undefined);
      if (failure === 'permission')
        getUserMediaMock.mockRejectedValueOnce(new Error('Private permission details'));
      await act(async () => {
        root.render(
          <AudioInput
            defaultIsDialogOpen
            maxBytes={4}
            onRecordingError={onRecordingError}
          />,
        );
        await Promise.resolve();
      });
      await flushAudioInputRecordingStart();
      if (failure === 'runtime') act(() => getMockRecorder().onerror?.(new Event('error')));
      if (failure === 'limit') act(() => getMockRecorder().emitChunk(new Blob(['12345'])));
      expect(onRecordingError).toHaveBeenCalledOnce();
      const recordingError = onRecordingError.mock.calls[0]?.[0];
      if (recordingError === undefined) throw new Error('No recording failure was delivered.');
      assertFailure(() => {
        throw recordingError;
      });
      expect(getAudioInputAlert(document.body).textContent).not.toContain(
        'Private permission details',
      );
      if (failure === 'runtime' || failure === 'limit') {
        expect(stopTrackMock).toHaveBeenCalledOnce();
        expect(getMockRecorder().ondataavailable).toBeNull();
        expect(getMockRecorder().onerror).toBeNull();
        expect(getMockRecorder().onstop).toBeNull();
      }
    },
  );

  test.each([
    [
      'invalid',
      (operation: () => never) =>
        expectToThrowCode(
          operation,
          'AUDIO_INPUT_TRANSCRIPTION_INVALID_RESULT',
          'Audio transcription returned an invalid result.',
        ),
    ],
    [
      'provider',
      (operation: () => never) =>
        expectToThrowCode(
          operation,
          'AUDIO_INPUT_TRANSCRIPTION_FAILED',
          'Audio transcription failed.',
        ),
    ],
    [
      'delivery',
      (operation: () => never) =>
        expectToThrowCode(
          operation,
          'AUDIO_INPUT_TRANSCRIPTION_RESULT_FAILED',
          'Transcription could not be sent.',
        ),
    ],
  ] as const)('reports the owned %s transcription contract', async (failure, assertFailure) => {
    const onTranscriptionError = vi.fn<(error: Error) => void>();
    // the external provider can violate its declared return type at runtime.
    const transcribe =
      failure === 'invalid'
        ? () => Promise.resolve(JSON.parse('null') as string)
        : failure === 'provider'
          ? () => Promise.reject(new Error('Private provider diagnostics'))
          : () => Promise.resolve('Reviewed voice note');
    await act(async () => {
      root.render(
        <AudioInput
          defaultIsDialogOpen
          transcribe={transcribe}
          onTranscriptionResult={() => Promise.reject(new Error('Private delivery diagnostics'))}
          onTranscriptionError={onTranscriptionError}
        />,
      );
      await Promise.resolve();
    });
    await flushAudioInputRecordingStart();
    await act(async () => {
      getMockRecorder().emitChunk(new Blob(['voice']));
      getAudioInputButtonByText(document.body, 'Send').click();
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(onTranscriptionError).toHaveBeenCalledOnce());
    const transcriptionError = onTranscriptionError.mock.calls[0]?.[0];
    if (transcriptionError === undefined)
      throw new Error('No transcription failure was delivered.');
    assertFailure(() => {
      throw transcriptionError;
    });
    expect(getAudioInputAlert(document.body).textContent).not.toMatch(
      /Private (provider|delivery) diagnostics/,
    );
    expect(getAudioInputButtonByText(document.body, 'Retry').disabled).toBe(false);
  });

  test('completes transcription with no optional result callback', async () => {
    const onTranscriptionComplete = vi.fn<(text: string) => void>();
    const onDialogOpenChange = vi.fn<(open: boolean) => void>();
    await act(async () => {
      root.render(
        <AudioInput
          defaultIsDialogOpen
          transcribe={() => Promise.resolve('Voice note')}
          onTranscriptionComplete={onTranscriptionComplete}
          onDialogOpenChange={onDialogOpenChange}
        />,
      );
      await Promise.resolve();
    });
    await flushAudioInputRecordingStart();
    await act(async () => {
      getMockRecorder().emitChunk(new Blob(['voice']));
      getAudioInputButtonByText(document.body, 'Send').click();
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(onDialogOpenChange).toHaveBeenCalledWith(false));
    expect(onTranscriptionComplete).toHaveBeenCalledWith(
      'Voice note',
      expect.objectContaining({ size: 5 }),
    );
  });

  test.each(['absent', 'prefixed', 'resume-rejected', 'close-rejected'] as const)(
    'records when waveform support is %s',
    async (support) => {
      const close = vi.fn(() =>
        support === 'close-rejected'
          ? Promise.reject(new Error('Already closed'))
          : Promise.resolve(),
      );
      class OptionalAudioContext extends MockAudioContext {
        public override readonly close = close;
        public override readonly resume = vi.fn(() =>
          support === 'resume-rejected'
            ? Promise.reject(new Error('Suspended'))
            : Promise.resolve(),
        );
      }
      vi.stubGlobal(
        'AudioContext',
        support === 'absent' || support === 'prefixed' ? undefined : OptionalAudioContext,
      );
      vi.stubGlobal(
        'webkitAudioContext',
        support === 'prefixed' ? OptionalAudioContext : undefined,
      );
      const controlsRef = createRef<IAudioInputControls>();
      const onRecordingComplete = vi.fn<(recording: IAudioInputRecording) => void>();
      await act(async () => {
        root.render(
          <AudioInput
            defaultIsDialogOpen
            controlsRef={controlsRef}
            onRecordingComplete={onRecordingComplete}
          />,
        );
        await Promise.resolve();
      });
      await flushAudioInputRecordingStart();
      act(() => getMockRecorder().emitChunk(new Blob(['voice'])));
      await act(async () => {
        controlsRef.current?.stopRecording();
        await Promise.resolve();
      });
      expect(onRecordingComplete).toHaveBeenCalledOnce();
      expect(stopTrackMock).toHaveBeenCalledOnce();
      expect(close).toHaveBeenCalledTimes(support === 'absent' ? 0 : 1);
    },
  );

  test('ignores empty chunks and resets an empty recording without a completion callback', async () => {
    const controlsRef = createRef<IAudioInputControls>();
    const onRecordingComplete = vi.fn<(recording: IAudioInputRecording) => void>();
    const onRecordingDataAvailable = vi.fn();
    await act(async () => {
      root.render(
        <AudioInput
          defaultIsDialogOpen
          controlsRef={controlsRef}
          onRecordingComplete={onRecordingComplete}
          onRecordingDataAvailable={onRecordingDataAvailable}
        />,
      );
      await Promise.resolve();
    });
    await flushAudioInputRecordingStart();
    act(() => getMockRecorder().emitChunk(new Blob([])));
    await act(async () => {
      controlsRef.current?.stopRecording();
      await Promise.resolve();
    });
    expect(onRecordingDataAvailable).not.toHaveBeenCalled();
    expect(onRecordingComplete).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Dictate');
    expect(stopTrackMock).toHaveBeenCalledOnce();
  });

  test('reset discards both active audio and completed output before a new external start', async () => {
    const controlsRef = createRef<IAudioInputControls>();
    const onRecordingCancel = vi.fn();
    await act(async () => {
      root.render(
        <AudioInput
          defaultIsDialogOpen
          controlsRef={controlsRef}
          onRecordingCancel={onRecordingCancel}
        />,
      );
      await Promise.resolve();
    });
    await flushAudioInputRecordingStart();
    act(() => controlsRef.current?.resetRecording());
    expect(stopTrackMock).toHaveBeenCalledOnce();
    expect(onRecordingCancel).toHaveBeenCalledOnce();
    await act(async () => {
      controlsRef.current?.startRecording();
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(MockMediaRecorder.instances).toHaveLength(2));
    const recorder = MockMediaRecorder.instances[1];
    act(() => recorder?.emitChunk(new Blob(['voice'])));
    await act(async () => {
      controlsRef.current?.stopRecording();
      await Promise.resolve();
    });
    act(() => controlsRef.current?.resetRecording());
    expect(document.body.textContent).toContain('Dictate');
    expect(stopTrackMock).toHaveBeenCalledTimes(2);
  });

  test.each(['startRecording', 'restartRecording'] as const)(
    'opens and runs a deferred %s when autoStart is disabled',
    async (command) => {
      const controlsRef = createRef<IAudioInputControls>();
      await act(async () => {
        root.render(
          <AudioInput
            autoStart={false}
            controlsRef={controlsRef}
          />,
        );
        await Promise.resolve();
      });
      act(() => controlsRef.current?.[command]());
      await vi.waitFor(() => expect(getUserMediaMock).toHaveBeenCalledOnce());
      await vi.waitFor(() => expect(MockMediaRecorder.instances).toHaveLength(1));
      expect(getMockRecorder().state).toBe('recording');
      act(() => controlsRef.current?.cancelRecording());
      expect(stopTrackMock).toHaveBeenCalledOnce();
    },
  );

  test('disabled external starts never request microphone access', async () => {
    const controlsRef = createRef<IAudioInputControls>();
    await act(async () => {
      root.render(
        <AudioInput
          defaultIsDialogOpen
          disabled
          controlsRef={controlsRef}
        />,
      );
      await Promise.resolve();
    });
    act(() => controlsRef.current?.startRecording());
    await flushAudioInputRecordingStart();
    expect(getUserMediaMock).not.toHaveBeenCalled();
    expect(
      document.body.querySelector<HTMLButtonElement>('button[aria-label="Open audio recorder"]')
        ?.disabled,
    ).toBe(true);
  });

  test('elapsed time advances only while microphone tracks are owned', async () => {
    const controlsRef = createRef<IAudioInputControls>();
    const onElapsedMsChange = vi.fn<(elapsed: number) => void>();
    await act(async () => {
      root.render(
        <AudioInput
          defaultIsDialogOpen
          controlsRef={controlsRef}
          onElapsedMsChange={onElapsedMsChange}
        />,
      );
      await Promise.resolve();
    });
    await flushAudioInputRecordingStart();
    vi.useFakeTimers();
    act(() => controlsRef.current?.resetRecording());
    await act(async () => {
      controlsRef.current?.startRecording();
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(onElapsedMsChange).toHaveBeenCalledWith(1000);
    act(() => controlsRef.current?.resetRecording());
    onElapsedMsChange.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(onElapsedMsChange).not.toHaveBeenCalled();
  });

  test('a controlled transcription editor can return to the recording action without retaining validation errors', async () => {
    const controlsRef = createRef<IAudioInputControls>();
    const transcribe = vi.fn(() => Promise.resolve('Second attempt'));
    const render = (isTranscriptionEditorVisible: boolean) =>
      root.render(
        <AudioInput
          defaultIsDialogOpen
          autoStart={false}
          controlsRef={controlsRef}
          transcribe={transcribe}
          isTranscriptionEditorVisible={isTranscriptionEditorVisible}
        />,
      );
    await act(async () => {
      render(true);
      await Promise.resolve();
    });
    const form = document.body.querySelector('form');
    if (form === null) throw new Error('The transcription form was not rendered.');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(document.body.querySelector('[role="alert"]')).not.toBeNull());
    await act(async () => {
      render(false);
      await Promise.resolve();
    });
    expect(document.body.querySelector('[role="alert"]')).toBeNull();
    expect(document.body.querySelector('textarea')).toBeNull();
    // native form submission must remain harmless before audio exists.
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    expect(transcribe).not.toHaveBeenCalled();
  });

  test('submitting reviewed text before a recording exists never sends it', async () => {
    const onTranscriptionResult = vi.fn();
    await act(async () => {
      root.render(
        <AudioInput
          defaultIsDialogOpen
          autoStart={false}
          defaultIsTranscriptionEditorVisible
          defaultTranscription="Draft"
          onTranscriptionResult={onTranscriptionResult}
        />,
      );
      await Promise.resolve();
    });
    const form = document.body.querySelector('form');
    if (form === null) throw new Error('The transcription form was not rendered.');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    expect(onTranscriptionResult).not.toHaveBeenCalled();
  });

  test('duplicate native form submissions share one pending result delivery', async () => {
    const controlsRef = createRef<IAudioInputControls>();
    const pending = createDeferred<void>();
    const onTranscriptionResult = vi.fn(() => pending.promise);
    await act(async () => {
      root.render(
        <AudioInput
          defaultIsDialogOpen
          defaultIsTranscriptionEditorVisible
          defaultTranscription="Draft"
          controlsRef={controlsRef}
          transcribe={() => Promise.resolve('Draft')}
          onTranscriptionResult={onTranscriptionResult}
        />,
      );
      await Promise.resolve();
    });
    await flushAudioInputRecordingStart();
    act(() => getMockRecorder().emitChunk(new Blob(['voice'])));
    await act(async () => {
      controlsRef.current?.stopRecording();
      await Promise.resolve();
    });
    // recording startup resets the editor, so first create the reviewed text.
    await act(async () => {
      getAudioInputButtonByText(document.body, 'Transcribe').click();
      await Promise.resolve();
    });
    const form = document.body.querySelector('form');
    if (form === null) throw new Error('The transcription form was not rendered.');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(onTranscriptionResult).toHaveBeenCalledOnce());
    await act(async () => {
      pending.resolve(undefined);
      await pending.promise;
    });
  });

  test.each(['fulfilled', 'rejected'] as const)(
    'reset invalidates a pending %s result delivery',
    async (outcome) => {
      const controlsRef = createRef<IAudioInputControls>();
      const pending = createDeferred<void>();
      const onDialogOpenChange = vi.fn();
      const onTranscriptionError = vi.fn();
      await act(async () => {
        root.render(
          <AudioInput
            defaultIsDialogOpen
            controlsRef={controlsRef}
            transcribe={() => Promise.resolve('Voice')}
            onTranscriptionResult={() => pending.promise}
            onDialogOpenChange={onDialogOpenChange}
            onTranscriptionError={onTranscriptionError}
          />,
        );
        await Promise.resolve();
      });
      await flushAudioInputRecordingStart();
      act(() => getMockRecorder().emitChunk(new Blob(['voice'])));
      await act(async () => {
        getAudioInputButtonByText(document.body, 'Send').click();
        await Promise.resolve();
      });
      await vi.waitFor(() => expect(document.body.textContent).toContain('Submitting...'));
      act(() => controlsRef.current?.resetRecording());
      onDialogOpenChange.mockClear();
      await act(async () => {
        if (outcome === 'fulfilled') {
          pending.resolve(undefined);
          await pending.promise;
        } else {
          pending.reject(new Error('Obsolete delivery'));
          await expect(pending.promise).rejects.toThrow('Obsolete delivery');
        }
      });
      expect(onTranscriptionError).not.toHaveBeenCalled();
      expect(onDialogOpenChange).not.toHaveBeenCalled();
    },
  );

  test('the desktop close control cancels recording once and releases the retained view', async () => {
    const onRecordingCancel = vi.fn();
    await act(async () => {
      root.render(
        <AudioInput
          defaultIsDialogOpen
          onRecordingCancel={onRecordingCancel}
        />,
      );
      await Promise.resolve();
    });
    await flushAudioInputRecordingStart();
    const close = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Close audio recorder"]',
    );
    if (close === null) throw new Error('The close action was not rendered.');
    act(() => close.click());
    await vi.waitFor(() => expect(document.body.querySelector('[role="dialog"]')).toBeNull());
    expect(onRecordingCancel).toHaveBeenCalledOnce();
    expect(stopTrackMock).toHaveBeenCalledOnce();
  });

  test('a completion callback can reset the session before automatic delivery begins', async () => {
    const controlsRef = createRef<IAudioInputControls>();
    const onTranscriptionResult = vi.fn();
    await act(async () => {
      root.render(
        <AudioInput
          defaultIsDialogOpen
          controlsRef={controlsRef}
          transcribe={() => Promise.resolve('Voice')}
          onTranscriptionComplete={() => controlsRef.current?.resetRecording()}
          onTranscriptionResult={onTranscriptionResult}
        />,
      );
      await Promise.resolve();
    });
    await flushAudioInputRecordingStart();
    act(() => getMockRecorder().emitChunk(new Blob(['voice'])));
    await act(async () => {
      getAudioInputButtonByText(document.body, 'Send').click();
      await Promise.resolve();
    });
    expect(onTranscriptionResult).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Dictate');
  });

  test('duplicate native submissions while a completed recording is transcribing share one request', async () => {
    const controlsRef = createRef<IAudioInputControls>();
    const pending = createDeferred<string>();
    const transcribe = vi.fn(() => pending.promise);
    await act(async () => {
      root.render(
        <AudioInput
          defaultIsDialogOpen
          controlsRef={controlsRef}
          transcribe={transcribe}
        />,
      );
      await Promise.resolve();
    });
    await flushAudioInputRecordingStart();
    act(() => getMockRecorder().emitChunk(new Blob(['voice'])));
    await act(async () => {
      controlsRef.current?.stopRecording();
      await Promise.resolve();
    });
    const form = document.body.querySelector('form');
    if (form === null) throw new Error('The transcription form was not rendered.');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    expect(transcribe).toHaveBeenCalledOnce();
    await act(async () => {
      pending.resolve('Reviewed voice');
      await pending.promise;
    });
  });

  test('repeated cancellation clears the earlier reset and notifies the caller once', async () => {
    const controlsRef = createRef<IAudioInputControls>();
    const onRecordingCancel = vi.fn();
    await act(async () => {
      root.render(
        <AudioInput
          defaultIsDialogOpen
          controlsRef={controlsRef}
          onRecordingCancel={onRecordingCancel}
        />,
      );
      await Promise.resolve();
    });
    await flushAudioInputRecordingStart();
    act(() => {
      controlsRef.current?.cancelRecording();
      controlsRef.current?.cancelRecording();
    });
    expect(onRecordingCancel).toHaveBeenCalledOnce();
    expect(stopTrackMock).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(document.body.querySelector('[role="dialog"]')).toBeNull());
  });

  test('native submit during pending permission cannot start transcription', async () => {
    const permission = createDeferred<MediaStream>();
    getUserMediaMock.mockReturnValueOnce(permission.promise);
    const transcribe = vi.fn(() => Promise.resolve('Voice'));
    const controlsRef = createRef<IAudioInputControls>();
    await act(async () => {
      root.render(
        <AudioInput
          defaultIsDialogOpen
          controlsRef={controlsRef}
          transcribe={transcribe}
        />,
      );
      await Promise.resolve();
    });
    const form = document.body.querySelector('form');
    if (form === null) throw new Error('The transcription form was not rendered.');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    expect(transcribe).not.toHaveBeenCalled();
    act(() => controlsRef.current?.cancelRecording());
    const stop = vi.fn();
    await act(async () => {
      permission.resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream);
      await permission.promise;
    });
    expect(stop).toHaveBeenCalledOnce();
  });

  test('replacing a queued restart runs only the newest command and unmount clears it', async () => {
    const controlsRef = createRef<IAudioInputControls>();
    await act(async () => {
      root.render(
        <AudioInput
          defaultIsDialogOpen
          controlsRef={controlsRef}
        />,
      );
      await Promise.resolve();
    });
    await flushAudioInputRecordingStart();
    vi.useFakeTimers();
    act(() => {
      controlsRef.current?.restartRecording();
      controlsRef.current?.restartRecording();
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(getUserMediaMock).toHaveBeenCalledTimes(2);
    act(() => controlsRef.current?.restartRecording());
    act(() => {
      root.unmount();
      isRootMounted = false;
    });
    await vi.runOnlyPendingTimersAsync();
    expect(getUserMediaMock).toHaveBeenCalledTimes(2);
    expect(stopTrackMock).toHaveBeenCalledTimes(2);
  });

  test('uses the browser-selected recording MIME fallback when no candidate is supported', async () => {
    class DefaultMediaRecorder extends MockMediaRecorder {
      public override readonly mimeType = '';
    }
    vi.spyOn(MockMediaRecorder, 'isTypeSupported').mockReturnValue(false);
    vi.stubGlobal('MediaRecorder', DefaultMediaRecorder);
    const controlsRef = createRef<IAudioInputControls>();
    const onRecordingComplete = vi.fn<(recording: IAudioInputRecording) => void>();
    await act(async () => {
      root.render(
        <AudioInput
          defaultIsDialogOpen
          controlsRef={controlsRef}
          onRecordingComplete={onRecordingComplete}
        />,
      );
      await Promise.resolve();
    });
    await flushAudioInputRecordingStart();
    act(() => getMockRecorder().emitChunk(new Blob(['voice'])));
    await act(async () => {
      controlsRef.current?.stopRecording();
      await Promise.resolve();
    });
    expect(onRecordingComplete.mock.calls[0]?.[0]).toMatchObject({
      mimeType: 'audio/webm',
      size: 5,
    });
    expect(onRecordingComplete.mock.calls[0]?.[0].fileName).toMatch(/\.webm$/);
  });

  test.each(['Private native diagnostics', 'Private native diagnostics (PROVIDER_AUDIO)'])(
    'preserves native provider codes and scoped copy for %s',
    async (diagnostics) => {
      const providerError = Object.assign(new Error(diagnostics), {
        code: 'PROVIDER_AUDIO',
      });
      const resolveErrorFeedback = createErrorFeedback({
        fallbackMessage: 'Try again.',
        messagesByCode: { PROVIDER_AUDIO: 'The transcription service is unavailable.' },
      });
      const onTranscriptionError = vi.fn<(error: Error) => void>();
      await act(async () => {
        root.render(
          <ErrorFeedbackProvider resolveErrorFeedback={resolveErrorFeedback}>
            <AudioInput
              defaultIsDialogOpen
              transcribe={() => Promise.reject(providerError)}
              onTranscriptionError={onTranscriptionError}
            />
          </ErrorFeedbackProvider>,
        );
        await Promise.resolve();
      });
      await flushAudioInputRecordingStart();
      act(() => getMockRecorder().emitChunk(new Blob(['voice'])));
      await act(async () => {
        getAudioInputButtonByText(document.body, 'Transcribe').click();
        await Promise.resolve();
      });
      const error = onTranscriptionError.mock.calls[0]?.[0];
      if (error === undefined) throw new Error('No provider diagnostic was delivered.');
      expectToThrowCode(
        () => {
          throw error;
        },
        'PROVIDER_AUDIO',
        'Private native diagnostics',
      );
      expect(error.cause).toBe(providerError);
      const alert = getAudioInputAlert(document.body);
      expect(alert.textContent).toContain('The transcription service is unavailable.');
      expect(alert.textContent).toContain('Code: PROVIDER_AUDIO');
      expect(alert.textContent).not.toContain('Private native diagnostics');
    },
  );

  test('hidden recording feedback still reports errors to its owner', async () => {
    const onRecordingError = vi.fn();
    await act(async () => {
      root.render(
        <AudioInput
          defaultIsDialogOpen
          maxBytes={4}
          isErrorVisible={false}
          onRecordingError={onRecordingError}
        />,
      );
      await Promise.resolve();
    });
    await flushAudioInputRecordingStart();
    act(() => getMockRecorder().emitChunk(new Blob(['12345'])));
    expect(onRecordingError).toHaveBeenCalledOnce();
    expect(document.body.querySelector('[role="alert"]')).toBeNull();
    expect(document.body.textContent).toContain('Recording stopped');
  });

  test('controlled editor visibility requests remain caller-owned after transcription', async () => {
    const onTranscriptionEditorVisibleChange = vi.fn<(visible: boolean) => void>();
    await act(async () => {
      root.render(
        <AudioInput
          defaultIsDialogOpen
          isTranscriptionEditorVisible={false}
          onTranscriptionEditorVisibleChange={onTranscriptionEditorVisibleChange}
          transcribe={() => Promise.resolve('Review this text')}
        />,
      );
      await Promise.resolve();
    });
    await flushAudioInputRecordingStart();
    act(() => getMockRecorder().emitChunk(new Blob(['voice'])));
    await act(async () => {
      getAudioInputButtonByText(document.body, 'Transcribe').click();
      await Promise.resolve();
    });
    expect(onTranscriptionEditorVisibleChange).toHaveBeenCalledWith(true);
    expect(document.body.querySelector('textarea')).toBeNull();
  });

  test('external restart from a closed dialog uses its default auto-start once', async () => {
    const controlsRef = createRef<IAudioInputControls>();
    await act(async () => {
      root.render(<AudioInput controlsRef={controlsRef} />);
      await Promise.resolve();
    });
    act(() => controlsRef.current?.restartRecording());
    await vi.waitFor(() => expect(MockMediaRecorder.instances).toHaveLength(1));
    expect(getUserMediaMock).toHaveBeenCalledOnce();
    act(() => controlsRef.current?.cancelRecording());
    expect(stopTrackMock).toHaveBeenCalledOnce();
  });

  test.each(['permission', 'transcription'] as const)(
    'canceled %s work stays silent and can be restarted',
    async (operation) => {
      const canceled = new DOMException('Private canceled operation', 'AbortError');
      if (operation === 'permission') getUserMediaMock.mockRejectedValueOnce(canceled);
      const transcribe = vi.fn(() => Promise.reject(canceled));
      const controlsRef = createRef<IAudioInputControls>();
      await act(async () => {
        root.render(
          <AudioInput
            defaultIsDialogOpen
            controlsRef={controlsRef}
            transcribe={transcribe}
          />,
        );
        await Promise.resolve();
      });
      await flushAudioInputRecordingStart();
      if (operation === 'transcription') {
        act(() => getMockRecorder().emitChunk(new Blob(['voice'])));
        await act(async () => {
          getAudioInputButtonByText(document.body, 'Transcribe').click();
          await Promise.resolve();
        });
      }
      expect(document.body.querySelector('[role="alert"]')).toBeNull();
      expect(document.body.textContent).not.toContain('Private canceled operation');
      act(() => controlsRef.current?.restartRecording());
      await vi.waitFor(() =>
        expect(MockMediaRecorder.instances).toHaveLength(operation === 'permission' ? 1 : 2),
      );
    },
  );
});

{
  // React act environment flag suppresses false-positive act warnings in Vitest.
  const reactActEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };

  // mocked media track records whether the component releases microphone resources.
  const stopTrackMock = vi.fn<() => void>();

  // mocked getUserMedia keeps microphone permission deterministic in the browser.
  const getUserMediaMock = vi.fn<() => Promise<MediaStream>>();

  // deferred promises expose in-flight result delivery for duplicate-activation assertions.
  type IDeferred<TResult> = {
    promise: Promise<TResult>;
    resolve: (result: TResult) => void;
  };

  /**
   * Minimal MediaRecorder replacement for exercising the real recorder and form flow in the browser.
   */
  class MockMediaRecorder {
    public static readonly instances: MockMediaRecorder[] = [];
    public static readonly isTypeSupported = vi.fn(
      (mimeType: string) => mimeType === 'audio/webm;codecs=opus',
    );

    public readonly mimeType: string;
    public ondataavailable: ((event: BlobEvent) => void) | null = null;
    public onerror: ((event: Event) => void) | null = null;
    public onstop: (() => void) | null = null;
    public readonly start = vi.fn((): void => {
      this.state = 'recording';
    });
    public readonly stop = vi.fn((): void => {
      if (this.state === 'inactive') {
        return;
      }

      this.state = 'inactive';
      this.onstop?.();
    });
    public state: RecordingState = 'inactive';

    /**
     * Creates a mock recorder and retains its configured MIME type.
     * @param _stream The media stream passed by AudioInput.
     * @param options The MediaRecorder options passed by AudioInput.
     */
    public constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
      this.mimeType = options?.mimeType ?? 'audio/webm';
      MockMediaRecorder.instances.push(this);
    }

    /**
     * Emits a mocked dataavailable event.
     * @param blob The audio chunk to deliver to AudioInput.
     */
    public emitChunk(blob: Blob): void {
      this.ondataavailable?.({ data: blob } as BlobEvent);
    }
  }

  /**
   * Creates a manually resolvable promise for inspecting pending result delivery.
   * @returns The promise and its resolve control.
   */
  const createDeferred = <TResult,>(): IDeferred<TResult> => {
    let resolveDeferred: ((result: TResult) => void) | null = null;
    const promise = new Promise<TResult>((resolve) => {
      resolveDeferred = resolve;
    });

    if (resolveDeferred === null) {
      throw new Error('Deferred promise control was not initialized.');
    }

    return {
      promise,
      resolve: resolveDeferred,
    };
  };

  /**
   * Returns a rendered button by its visible text.
   * @param text The visible button text to match.
   * @returns The matching button element.
   */
  const getButtonByText = (text: string): HTMLButtonElement => {
    const button = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
      (buttonElement) => buttonElement.textContent?.trim() === text,
    );

    if (button === undefined) {
      throw new Error(`Audio input button "${text}" was not found.`);
    }

    return button;
  };

  /**
   * Returns the active mocked recorder.
   * @returns The first MediaRecorder created by AudioInput.
   */
  const getMockRecorder = (): MockMediaRecorder => {
    const recorder = MockMediaRecorder.instances[0];

    if (recorder === undefined) {
      throw new Error('Mock recorder was not created.');
    }

    return recorder;
  };

  /**
   * Flushes queued promise work after a recorder or form interaction.
   * @returns A promise that resolves after React processes queued updates.
   */
  const flushAsyncWork = async (): Promise<void> => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  /**
   * Updates a rendered transcription editor through its native input event.
   * @param textarea The transcription editor to update.
   * @param transcription The next authored transcription.
   */
  const updateTranscription = (textarea: HTMLTextAreaElement, transcription: string): void => {
    const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');

    valueDescriptor?.set?.call(textarea, transcription);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  };

  describe('AudioInput result retry integration', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(async () => {
      await page.viewport(1280, 800);
      reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
      MockMediaRecorder.instances.length = 0;
      stopTrackMock.mockClear();
      getUserMediaMock.mockResolvedValue({
        getTracks: () => [{ stop: stopTrackMock } as unknown as MediaStreamTrack],
      } as unknown as MediaStream);
      vi.stubGlobal('MediaRecorder', MockMediaRecorder);
      Object.defineProperty(window, 'MediaRecorder', {
        configurable: true,
        value: MockMediaRecorder,
        writable: true,
      });
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: getUserMediaMock,
        },
      });
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(() => {
      act(() => {
        root.unmount();
      });
      container.remove();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
      vi.clearAllMocks();
    });

    test('retries one-click result delivery without transcribing again', async () => {
      const pendingRetry = createDeferred<void>();
      const handleTranscribe = vi.fn<(recording: IAudioInputRecording) => Promise<string>>(() =>
        Promise.resolve('Retained one-click transcription'),
      );
      const handleTranscriptionResult = vi
        .fn<(transcription: string, recording: IAudioInputRecording) => Promise<void>>()
        .mockRejectedValueOnce(new Error('Message send failed'))
        .mockImplementationOnce(() => pendingRetry.promise);

      await act(async () => {
        root.render(
          <AudioInput
            autoStart
            defaultIsDialogOpen
            transcribe={handleTranscribe}
            onTranscriptionResult={handleTranscriptionResult}
          />,
        );

        await Promise.resolve();
      });
      await flushAsyncWork();

      const recorder = getMockRecorder();

      await act(async () => {
        recorder.emitChunk(new Blob(['hello'], { type: 'audio/webm' }));
        getButtonByText('Send').click();

        await Promise.resolve();
      });
      await flushAsyncWork();

      expect(handleTranscribe).toHaveBeenCalledTimes(1);
      expect(handleTranscriptionResult).toHaveBeenCalledTimes(1);
      expect(document.body.querySelector('textarea')).toBeNull();
      expect(document.body.querySelector('[role="alert"]')?.textContent).toContain(
        'Transcription could not be sent.',
      );

      const retryButton = getButtonByText('Retry');

      await act(async () => {
        retryButton.click();
        retryButton.click();
        await Promise.resolve();
      });

      expect(handleTranscribe).toHaveBeenCalledTimes(1);
      expect(handleTranscriptionResult).toHaveBeenCalledTimes(2);
      expect(handleTranscriptionResult).toHaveBeenLastCalledWith(
        'Retained one-click transcription',
        expect.objectContaining({ size: 5 }),
      );

      await act(async () => {
        pendingRetry.resolve();
        await pendingRetry.promise;
        await Promise.resolve();
      });

      expect(handleTranscriptionResult).toHaveBeenCalledTimes(2);
      expect(stopTrackMock).toHaveBeenCalledTimes(1);
    });

    test('validates and retries the latest review-first edit without retranscription', async () => {
      const pendingRetry = createDeferred<void>();
      const handleTranscribe = vi.fn<(recording: IAudioInputRecording) => Promise<string>>(() =>
        Promise.resolve('Original transcription'),
      );
      const handleTranscriptionResult = vi
        .fn<(transcription: string, recording: IAudioInputRecording) => Promise<void>>()
        .mockRejectedValueOnce(new Error('Message send failed'))
        .mockImplementationOnce(() => pendingRetry.promise);

      await act(async () => {
        root.render(
          <AudioInput
            autoStart
            defaultIsDialogOpen
            transcribe={handleTranscribe}
            onTranscriptionResult={handleTranscriptionResult}
          />,
        );

        await Promise.resolve();
      });
      await flushAsyncWork();

      const recorder = getMockRecorder();

      await act(async () => {
        recorder.emitChunk(new Blob(['hello'], { type: 'audio/webm' }));
        getButtonByText('Transcribe').click();

        await Promise.resolve();
      });
      await flushAsyncWork();

      const textarea = document.body.querySelector<HTMLTextAreaElement>(
        'textarea[aria-label="Transcription"]',
      );

      if (textarea === null) {
        throw new Error('Expected the transcription editor to render.');
      }

      await act(async () => {
        updateTranscription(textarea, 'First reviewed transcription');
        getButtonByText('Send').click();

        await Promise.resolve();
      });
      await flushAsyncWork();

      expect(handleTranscriptionResult).toHaveBeenCalledTimes(1);
      expect(handleTranscriptionResult).toHaveBeenLastCalledWith(
        'First reviewed transcription',
        expect.objectContaining({ size: 5 }),
      );

      await act(async () => {
        updateTranscription(textarea, '   ');
        getButtonByText('Retry').click();
        await Promise.resolve();
      });

      expect(handleTranscriptionResult).toHaveBeenCalledTimes(1);
      expect(
        document.getElementById(textarea.getAttribute('aria-describedby') ?? '')?.textContent,
      ).toBe('Enter a transcription before sending.');

      await act(async () => {
        updateTranscription(textarea, '  Edited after delivery failed  ');
        await Promise.resolve();
      });

      const retryButton = getButtonByText('Retry');

      await act(async () => {
        retryButton.click();
        retryButton.click();
        await Promise.resolve();
      });

      expect(handleTranscribe).toHaveBeenCalledTimes(1);
      expect(handleTranscriptionResult).toHaveBeenCalledTimes(2);
      expect(handleTranscriptionResult).toHaveBeenLastCalledWith(
        'Edited after delivery failed',
        expect.objectContaining({ size: 5 }),
      );

      await act(async () => {
        pendingRetry.resolve();
        await pendingRetry.promise;
        await Promise.resolve();
      });

      expect(handleTranscriptionResult).toHaveBeenCalledTimes(2);
    });

    test('preserves transcription retries for provider failures', async () => {
      const handleTranscribe = vi
        .fn<(recording: IAudioInputRecording) => Promise<string>>()
        .mockRejectedValueOnce(new Error('Transcription provider failed'))
        .mockResolvedValueOnce('Recovered transcription');
      const handleTranscriptionResult = vi.fn();

      await act(async () => {
        root.render(
          <AudioInput
            autoStart
            defaultIsDialogOpen
            transcribe={handleTranscribe}
            onTranscriptionResult={handleTranscriptionResult}
          />,
        );

        await Promise.resolve();
      });
      await flushAsyncWork();

      const recorder = getMockRecorder();

      await act(async () => {
        recorder.emitChunk(new Blob(['hello'], { type: 'audio/webm' }));
        getButtonByText('Transcribe').click();

        await Promise.resolve();
      });
      await flushAsyncWork();

      expect(handleTranscribe).toHaveBeenCalledTimes(1);
      expect(handleTranscriptionResult).not.toHaveBeenCalled();
      expect(document.body.querySelector('[role="alert"]')?.textContent).toContain(
        'Audio transcription failed.',
      );

      await act(async () => {
        getButtonByText('Retry').click();

        await Promise.resolve();
      });
      await flushAsyncWork();

      expect(handleTranscribe).toHaveBeenCalledTimes(2);
      expect(handleTranscriptionResult).not.toHaveBeenCalled();
      expect(document.body.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe(
        'Recovered transcription',
      );
    });
  });
}
