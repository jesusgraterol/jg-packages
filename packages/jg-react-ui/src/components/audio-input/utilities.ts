import { toMS } from 'jg-utilities';

import {
  AUDIO_INPUT_DEFAULT_MAX_BYTES,
  AUDIO_INPUT_FILE_EXTENSION_BY_MIME_TYPE,
  AUDIO_INPUT_MIME_TYPE_CANDIDATES,
  AUDIO_INPUT_MIN_WAVEFORM_LEVEL,
  AUDIO_INPUT_WAVEFORM_GAIN,
} from './constants.js';

// byte units used by compact recording size labels.
const AUDIO_INPUT_BYTE_UNITS = ['B', 'KB', 'MB', 'GB'] as const;

/**
 * Returns a usable recording size limit.
 * @param maxBytes The caller-provided byte limit.
 * @returns A positive finite byte limit, or the default limit when invalid.
 */
export const normalizeAudioInputMaxBytes = (maxBytes: number | undefined): number => {
  if (maxBytes === undefined || !Number.isFinite(maxBytes) || maxBytes <= 0) {
    return AUDIO_INPUT_DEFAULT_MAX_BYTES;
  }

  return maxBytes;
};

/**
 * Formats a byte count for compact status labels.
 * @param bytes The byte count to format.
 * @returns A readable size label using binary units.
 */
export const formatAudioInputBytes = (bytes: number): string => {
  let normalizedBytes = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
  let unitIndex = 0;

  while (normalizedBytes >= 1024 && unitIndex < AUDIO_INPUT_BYTE_UNITS.length - 1) {
    normalizedBytes /= 1024;
    unitIndex += 1;
  }

  if (unitIndex === 0) {
    return `${Math.round(normalizedBytes)} ${AUDIO_INPUT_BYTE_UNITS[unitIndex]}`;
  }

  const precision = normalizedBytes >= 10 ? 0 : 1;

  return `${normalizedBytes.toFixed(precision)} ${AUDIO_INPUT_BYTE_UNITS[unitIndex]}`;
};

/**
 * Formats an elapsed recording duration.
 * @param durationMs The duration in milliseconds.
 * @returns A timer label in m:ss or h:mm:ss format.
 */
export const formatAudioInputDuration = (durationMs: number): string => {
  const totalSeconds = Math.floor(Math.max(0, durationMs) / toMS('1 second'));
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  const paddedSeconds = String(seconds).padStart(2, '0');

  if (hours === 0) {
    return `${minutes}:${paddedSeconds}`;
  }

  return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`;
};

/**
 * Resolves the best MediaRecorder MIME type for the current browser.
 * @param preferredMimeType The caller-preferred MIME type to try first.
 * @returns The selected MIME type, or undefined when the browser should choose.
 */
export const resolveAudioInputMimeType = (
  preferredMimeType: string | undefined,
): string | undefined => {
  const mediaRecorderConstructor = globalThis.MediaRecorder;
  const candidateMimeTypes =
    preferredMimeType === undefined
      ? AUDIO_INPUT_MIME_TYPE_CANDIDATES
      : [
          preferredMimeType,
          ...AUDIO_INPUT_MIME_TYPE_CANDIDATES.filter(
            (candidateMimeType) => candidateMimeType !== preferredMimeType,
          ),
        ];

  if (
    typeof mediaRecorderConstructor === 'undefined' ||
    typeof mediaRecorderConstructor.isTypeSupported !== 'function'
  ) {
    return preferredMimeType;
  }

  return candidateMimeTypes.find((candidateMimeType) =>
    mediaRecorderConstructor.isTypeSupported(candidateMimeType),
  );
};

/**
 * Resolves the safest file extension for an audio MIME type.
 * @param mimeType The recorded audio MIME type.
 * @returns The matching file extension, or webm when unknown.
 */
export const resolveAudioInputFileExtension = (mimeType: string): string => {
  const normalizedMimeType = mimeType.split(';')[0]?.trim().toLowerCase();

  if (
    normalizedMimeType !== undefined &&
    normalizedMimeType in AUDIO_INPUT_FILE_EXTENSION_BY_MIME_TYPE
  ) {
    return AUDIO_INPUT_FILE_EXTENSION_BY_MIME_TYPE[
      normalizedMimeType as keyof typeof AUDIO_INPUT_FILE_EXTENSION_BY_MIME_TYPE
    ];
  }

  return 'webm';
};

/**
 * Creates a stable download file name for a completed recording.
 * @param mimeType The recorded audio MIME type.
 * @param recordedAt The recording completion date.
 * @returns A file name with a timestamp and matching extension.
 */
export const createAudioInputFileName = (mimeType: string, recordedAt: Date): string => {
  const timestamp = recordedAt.toISOString().replace(/[:.]/g, '-');

  return `audio-recording-${timestamp}.${resolveAudioInputFileExtension(mimeType)}`;
};

/**
 * Creates the user-facing size-limit error message.
 * @returns A concise message explaining why recording stopped.
 */
export const createAudioInputLimitExceededMessage = (): string =>
  'Recording stopped because it reached the audio limit.';

/**
 * Converts microphone time-domain data into normalized waveform bar levels.
 * @param samples The analyser time-domain samples.
 * @param barCount The number of waveform bars to produce.
 * @returns Normalized levels between the minimum visible height and full height.
 */
export const resolveAudioInputWaveformLevels = (
  samples: Uint8Array,
  barCount: number,
): number[] => {
  const normalizedBarCount = Math.max(1, Math.floor(barCount));
  const segmentSize = Math.max(1, Math.floor(samples.length / normalizedBarCount));

  return Array.from({ length: normalizedBarCount }, (_unusedValue, barIndex) => {
    const segmentStart = barIndex * segmentSize;
    const segmentEnd = Math.min(samples.length, segmentStart + segmentSize);
    let segmentPeak = 0;

    for (let sampleIndex = segmentStart; sampleIndex < segmentEnd; sampleIndex += 1) {
      const sample = samples[sampleIndex] ?? 128;

      segmentPeak = Math.max(segmentPeak, Math.abs(sample - 128) / 128);
    }

    return Math.min(
      1,
      Math.max(AUDIO_INPUT_MIN_WAVEFORM_LEVEL, segmentPeak * AUDIO_INPUT_WAVEFORM_GAIN),
    );
  });
};
