import { toMS } from 'jg-utilities';

import type { IAudioInputStatus } from './types.js';

/** Bytes in one mebibyte, used by the recording limit.
 * @see AudioInput
 */
export const AUDIO_INPUT_BYTES_PER_MEGABYTE = 1024 * 1024;

/** Default recording cap in bytes.
 * @see AudioInput
 */
export const AUDIO_INPUT_DEFAULT_MAX_BYTES = 20 * AUDIO_INPUT_BYTES_PER_MEGABYTE;

/** Requested interval in milliseconds between MediaRecorder chunks.
 * @see AudioInput
 */
export const AUDIO_INPUT_RECORDING_CHUNK_TIMESLICE_MS = toMS('1 second');

// default cancel action label for audio dialogs.
export const AUDIO_INPUT_DEFAULT_CANCEL_LABEL = 'Cancel';

// default close button label for the built-in audio dialog.
export const AUDIO_INPUT_DEFAULT_CLOSE_BUTTON_ARIA_LABEL = 'Close audio recorder';

// default visible title identifies the built-in recording workflow.
export const AUDIO_INPUT_DEFAULT_DIALOG_TITLE = 'Audio';

// default cancel reset delay lets dialog exit animation finish without visual state snapping.
export const AUDIO_INPUT_DEFAULT_CANCEL_RESET_DELAY_MS = 220;

// default microphone trigger label for screen readers and tooltips.
export const AUDIO_INPUT_DEFAULT_TRIGGER_ARIA_LABEL = 'Open audio recorder';

// default restart button label for the built-in audio dialog.
export const AUDIO_INPUT_DEFAULT_RESTART_BUTTON_ARIA_LABEL = 'Restart recording';

// default primary action label for transcribing and immediately sending text.
export const AUDIO_INPUT_DEFAULT_TRANSCRIBE_AND_SEND_LABEL = 'Send';

// default secondary action label for transcribing into an editable text area.
export const AUDIO_INPUT_DEFAULT_TRANSCRIBE_LABEL = 'Transcribe';

// default action label for transcribing audio captured before the byte limit stopped recording.
export const AUDIO_INPUT_DEFAULT_TRANSCRIBE_LIMIT_RECORDING_LABEL = 'Transcribe recording';

// default retry label for the failed transcription action.
export const AUDIO_INPUT_DEFAULT_RETRY_LABEL = 'Retry';

// default send action label for edited transcription text.
export const AUDIO_INPUT_DEFAULT_SEND_TRANSCRIPTION_LABEL = 'Send';

// default accessible label for the editable transcription text area.
export const AUDIO_INPUT_DEFAULT_TRANSCRIPTION_TEXTAREA_LABEL = 'Transcription';

// default placeholder follows the shared form placeholder convention.
export const AUDIO_INPUT_DEFAULT_TRANSCRIPTION_PLACEHOLDER =
  'e.g. Review and edit the transcribed audio before sending';

// animation frame sampling keeps waveform updates smooth without excessive render pressure.
export const AUDIO_INPUT_WAVEFORM_SAMPLE_INTERVAL_MS = 80;

// preferred browser recording formats, ordered by quality-to-size fit and broad support.
export const AUDIO_INPUT_MIME_TYPE_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/mp4',
] as const;

// file extensions are resolved from the final MediaRecorder MIME type.
export const AUDIO_INPUT_FILE_EXTENSION_BY_MIME_TYPE = {
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
  'audio/wav': 'wav',
} as const;

// visible lifecycle labels mirror the compact ChatGPT dictate surface.
export const AUDIO_INPUT_STATUS_LABELS = {
  idle: 'Dictate',
  'requesting-permission': 'Starting...',
  recording: 'Listening',
  complete: 'Recording ready',
  error: 'Recording stopped',
} satisfies Record<IAudioInputStatus, string>;

// idle waveform levels match the quiet dictate surface before microphone input is available.
export const AUDIO_INPUT_IDLE_WAVEFORM_LEVELS = [0.2, 0.28, 0.2, 0.36, 0.24, 0.3, 0.18] as const;

// waveform levels never collapse to zero so the recording affordance remains visible.
export const AUDIO_INPUT_MIN_WAVEFORM_LEVEL = 0.14;

// waveform amplitude is boosted because browser microphone input is usually quiet.
export const AUDIO_INPUT_WAVEFORM_GAIN = 3.5;

// waveform bars keep the recording state visible inside the compact dictate surface.
export const AUDIO_INPUT_WAVEFORM_BARS = [
  {
    id: 'bar-1',
  },
  {
    id: 'bar-2',
  },
  {
    id: 'bar-3',
  },
  {
    id: 'bar-4',
  },
  {
    id: 'bar-5',
  },
  {
    id: 'bar-6',
  },
  {
    id: 'bar-7',
  },
] as const;
