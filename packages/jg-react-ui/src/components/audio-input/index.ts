// types
export type {
  IAudioInputCancelHandler,
  IAudioInputControls,
  IAudioInputDialogOpenChangeHandler,
  IAudioInputElapsedMsChangeHandler,
  IAudioInputLimitProgress,
  IAudioInputLimitProgressChangeHandler,
  IAudioInputProps,
  IAudioInputRecordedBytesChangeHandler,
  IAudioInputRecording,
  IAudioInputRecordingActiveChangeHandler,
  IAudioInputRecordingCancelHandler,
  IAudioInputRecordingCompleteHandler,
  IAudioInputRecordingDataAvailableHandler,
  IAudioInputRecordingErrorHandler,
  IAudioInputRecordingStartHandler,
  IAudioInputRecordingStopHandler,
  IAudioInputStatusChangeHandler,
  IAudioInputStatus,
  IAudioInputTranscribeHandler,
  IAudioInputTranscriptionCompleteHandler,
  IAudioInputTranscriptionEditorVisibleChangeHandler,
  IAudioInputTranscriptionErrorHandler,
  IAudioInputTranscriptionResultHandler,
  IAudioInputTranscriptionStatus,
  IAudioInputTranscriptionStatusChangeHandler,
  IAudioInputTranscriptionTextChangeHandler,
} from './types.js';

// constants
export {
  AUDIO_INPUT_BYTES_PER_MEGABYTE,
  AUDIO_INPUT_DEFAULT_MAX_BYTES,
  AUDIO_INPUT_RECORDING_CHUNK_TIMESLICE_MS,
} from './constants.js';

// components
export { AudioInput } from './audio-input.component.js';
