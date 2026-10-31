// @vitest-environment node
import { afterEach, describe, expect, test, vi } from 'vitest';

import { AUDIO_INPUT_DEFAULT_MAX_BYTES } from './constants.js';
import {
  createAudioInputFileName,
  createAudioInputLimitExceededMessage,
  formatAudioInputBytes,
  formatAudioInputDuration,
  normalizeAudioInputMaxBytes,
  resolveAudioInputFileExtension,
  resolveAudioInputMimeType,
  resolveAudioInputWaveformLevels,
} from './utilities.js';

describe('audio-input utilities', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test.each([
    [undefined, AUDIO_INPUT_DEFAULT_MAX_BYTES],
    [0, AUDIO_INPUT_DEFAULT_MAX_BYTES],
    [-1, AUDIO_INPUT_DEFAULT_MAX_BYTES],
    [1024, 1024],
  ])('normalizeAudioInputMaxBytes(%s) -> %d', (maxBytes, expectedMaxBytes) => {
    expect(normalizeAudioInputMaxBytes(maxBytes)).toBe(expectedMaxBytes);
  });

  test.each([
    [0, '0 B'],
    [Number.NaN, '0 B'],
    [4, '4 B'],
    [1024, '1.0 KB'],
    [25 * 1024 * 1024, '25 MB'],
    [1536 * 1024, '1.5 MB'],
  ])('formatAudioInputBytes(%d) -> %s', { tags: ['full'] }, (bytes, expectedLabel) => {
    expect(formatAudioInputBytes(bytes)).toBe(expectedLabel);
  });

  test.each([
    [0, '0:00'],
    [999, '0:00'],
    [61_000, '1:01'],
    [3_661_000, '1:01:01'],
  ])('formatAudioInputDuration(%d) -> %s', { tags: ['full'] }, (durationMs, expectedLabel) => {
    expect(formatAudioInputDuration(durationMs)).toBe(expectedLabel);
  });

  test('resolves the preferred supported MediaRecorder MIME type first', () => {
    vi.stubGlobal('MediaRecorder', {
      isTypeSupported: vi.fn((mimeType: string) => mimeType === 'audio/ogg'),
    });

    expect(resolveAudioInputMimeType('audio/ogg')).toBe('audio/ogg');
  });

  test('falls back to the first supported default MediaRecorder MIME type', () => {
    vi.stubGlobal('MediaRecorder', {
      isTypeSupported: vi.fn((mimeType: string) => mimeType === 'audio/webm'),
    });

    expect(resolveAudioInputMimeType('audio/wav')).toBe('audio/webm');
  });

  test.each([undefined, {}])(
    'preserves a preferred MIME type without a feature-detection API (%o)',
    (constructor) => {
      vi.stubGlobal('MediaRecorder', constructor);
      expect(resolveAudioInputMimeType('audio/ogg')).toBe('audio/ogg');
    },
  );

  test.each([
    ['audio/webm;codecs=opus', 'webm'],
    ['audio/ogg', 'ogg'],
    ['audio/mp4', 'm4a'],
    ['application/octet-stream', 'webm'],
  ])('resolveAudioInputFileExtension(%s) -> %s', (mimeType, expectedExtension) => {
    expect(resolveAudioInputFileExtension(mimeType)).toBe(expectedExtension);
  });

  test('creates a timestamped file name with the resolved extension', { tags: ['full'] }, () => {
    expect(
      createAudioInputFileName('audio/webm;codecs=opus', new Date('2026-06-17T12:00:00Z')),
    ).toBe('audio-recording-2026-06-17T12-00-00-000Z.webm');
  });

  test('creates the size-limit error message from the configured cap', { tags: ['full'] }, () => {
    expect(createAudioInputLimitExceededMessage()).toBe(
      'Recording stopped because it reached the audio limit.',
    );
  });

  test('resolves visible waveform levels from time-domain samples', { tags: ['full'] }, () => {
    const levels = resolveAudioInputWaveformLevels(new Uint8Array([128, 255, 128, 0]), 2);

    expect(levels).toStrictEqual([1, 1]);
  });

  test('keeps silent waveform levels visible', { tags: ['full'] }, () => {
    expect(resolveAudioInputWaveformLevels(new Uint8Array([128, 128, 128, 128]), 2)).toStrictEqual([
      0.14, 0.14,
    ]);
  });
});
