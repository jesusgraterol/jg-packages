import { type ComponentPropsWithoutRef, type Ref } from 'react';
import type { z } from 'zod';

import type { IButtonProps } from '../button/index.js';

import type { AudioInputTranscriptionFormSchema } from './validations.js';

// internal form contracts distinguish raw editor state from normalized resolver output.
export type IAudioInputTranscriptionFormInput = z.input<typeof AudioInputTranscriptionFormSchema>;
export type IAudioInputTranscriptionFormValues = z.output<typeof AudioInputTranscriptionFormSchema>;

/** Recorder lifecycle states exposed through callbacks and the rendered recording surface.
 * @see AudioInput
 */
export type IAudioInputStatus =
  'idle' | 'requesting-permission' | 'recording' | 'complete' | 'error';

/** Transcription and result-delivery states, including editable and recoverable outcomes.
 * @see AudioInput
 */
export type IAudioInputTranscriptionStatus =
  'idle' | 'transcribing' | 'ready' | 'sending' | 'sent' | 'error';

/** Captured Blob, duration, portable file-name metadata, MIME type, and byte size.
 * @see AudioInput
 */
export type IAudioInputRecording = {
  blob: Blob;
  durationMs: number;
  fileName: string;
  mimeType: string;
  size: number;
};

/** Observed recording bytes and normalized progress against the configured byte limit.
 * @see AudioInput
 */
export type IAudioInputLimitProgress = {
  maxBytes: number;
  percentage: number;
  progress: number;
  recordedBytes: number;
};

/** Imperative start, stop, restart, reset, and cancellation controls for the recording workflow.
 * @see AudioInput
 */
export type IAudioInputControls = {
  cancelRecording: () => void;
  restartRecording: () => void;
  resetRecording: () => void;
  startRecording: () => void;
  stopRecording: () => void;
};

/** Receives the explicit recorder cancel action.
 * @see AudioInput
 */
export type IAudioInputCancelHandler = () => void;
/** Receives requested changes to the built-in dialog open state.
 * @see AudioInput
 */
export type IAudioInputDialogOpenChangeHandler = (isDialogOpen: boolean) => void;
/** Receives the elapsed recording duration in milliseconds.
 * @see AudioInput
 */
export type IAudioInputElapsedMsChangeHandler = (elapsedMs: number) => void;
/** Receives observed recording size and normalized limit progress.
 * @see AudioInput
 */
export type IAudioInputLimitProgressChangeHandler = (progress: IAudioInputLimitProgress) => void;
/** Receives the total bytes observed from MediaRecorder chunks.
 * @see AudioInput
 */
export type IAudioInputRecordedBytesChangeHandler = (recordedBytes: number) => void;
/** Receives changes requested for the controlled recording state.
 * @see AudioInput
 */
export type IAudioInputRecordingActiveChangeHandler = (isRecording: boolean) => void;
/** Receives cancellation of an active recording or pending microphone request.
 * @see AudioInput
 */
export type IAudioInputRecordingCancelHandler = () => void;
/** Receives a retained recording after its microphone resources have been released.
 * @see AudioInput
 */
export type IAudioInputRecordingCompleteHandler = (recording: IAudioInputRecording) => void;
/** Receives an admitted audio chunk and the accumulated observed bytes.
 * @see AudioInput
 */
export type IAudioInputRecordingDataAvailableHandler = (chunk: Blob, recordedBytes: number) => void;
/** Receives recording diagnostics. Coded causes retain their code; visible feedback is resolved separately.
 * @see AudioInput
 */
export type IAudioInputRecordingErrorHandler = (error: Error) => void;
/** Receives a recording-start request before microphone permission is requested.
 * @see AudioInput
 */
export type IAudioInputRecordingStartHandler = () => void;
/** Receives a clean recorder stop before its completed recording is emitted.
 * @see AudioInput
 */
export type IAudioInputRecordingStopHandler = () => void;
/** Receives each committed recorder status transition without render-time callback effects.
 * @see AudioInput
 */
export type IAudioInputStatusChangeHandler = (status: IAudioInputStatus) => void;

/** Transcribes a retained recording. The caller owns requests and deadlines; obsolete sessions ignore late results.
 * @see AudioInput
 */
export type IAudioInputTranscribeHandler = (recording: IAudioInputRecording) => Promise<string>;
/** Receives accepted transcription text together with its retained recording.
 * @see AudioInput
 */
export type IAudioInputTranscriptionCompleteHandler = (
  transcription: string,
  recording: IAudioInputRecording,
) => void;
/** Receives requested visibility changes for the review editor.
 * @see AudioInput
 */
export type IAudioInputTranscriptionEditorVisibleChangeHandler = (
  isTranscriptionEditorVisible: boolean,
) => void;
/** Receives transcription or result-delivery diagnostics separately from display-safe feedback.
 * @see AudioInput
 */
export type IAudioInputTranscriptionErrorHandler = (error: Error) => void;

/** Accepts authored text and its recording. Result retries reuse retained text without repeating transcription.
 * @see AudioInput
 */
export type IAudioInputTranscriptionResultHandler = (
  transcription: string,
  recording: IAudioInputRecording,
) => void | Promise<void>;
/** Receives transcription and delivery lifecycle changes.
 * @see AudioInput
 */
export type IAudioInputTranscriptionStatusChangeHandler = (
  status: IAudioInputTranscriptionStatus,
) => void;
/** Receives requested changes to the controlled transcription text.
 * @see AudioInput
 */
export type IAudioInputTranscriptionTextChangeHandler = (transcription: string) => void;

// root props place the microphone trigger beside surrounding controls.
type IAudioInputRootProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'>;

// trigger props expose safe button customization while preserving dialog behavior.
type IAudioInputTriggerButtonProps = Omit<
  IButtonProps,
  | 'aria-label'
  | 'asChild'
  | 'children'
  | 'className'
  | 'disabled'
  | 'onClick'
  | 'size'
  | 'title'
  | 'type'
  | 'variant'
>;

/** Microphone trigger, dialog, controlled recording and transcription state, provider callbacks, copy, and presentation.
 * @see AudioInput
 */
export type IAudioInputProps = IAudioInputRootProps & {
  autoStart?: boolean;
  cancelLabel?: string;
  cancelResetDelayMs?: number;
  closeButtonAriaLabel?: string;
  controlsRef?: Ref<IAudioInputControls>;
  defaultIsDialogOpen?: boolean;
  defaultIsRecording?: boolean;
  defaultIsTranscriptionEditorVisible?: boolean;
  defaultTranscription?: string;
  dialogDescription?: string;
  dialogTitle?: string;
  disabled?: boolean;
  isDialogOpen?: boolean;
  isErrorVisible?: boolean;
  isRecording?: boolean;
  isTranscriptionEditorVisible?: boolean;
  maxBytes?: number;
  onDialogOpenChange?: IAudioInputDialogOpenChangeHandler;
  onElapsedMsChange?: IAudioInputElapsedMsChangeHandler;
  onCancel?: IAudioInputCancelHandler;
  onLimitProgressChange?: IAudioInputLimitProgressChangeHandler;
  onRecordedBytesChange?: IAudioInputRecordedBytesChangeHandler;
  onRecordingActiveChange?: IAudioInputRecordingActiveChangeHandler;
  onRecordingCancel?: IAudioInputRecordingCancelHandler;
  onRecordingComplete?: IAudioInputRecordingCompleteHandler;
  onRecordingDataAvailable?: IAudioInputRecordingDataAvailableHandler;
  onRecordingError?: IAudioInputRecordingErrorHandler;
  onRecordingStart?: IAudioInputRecordingStartHandler;
  onRecordingStop?: IAudioInputRecordingStopHandler;
  onStatusChange?: IAudioInputStatusChangeHandler;
  onTranscriptionComplete?: IAudioInputTranscriptionCompleteHandler;
  onTranscriptionEditorVisibleChange?: IAudioInputTranscriptionEditorVisibleChangeHandler;
  onTranscriptionError?: IAudioInputTranscriptionErrorHandler;
  onTranscriptionResult?: IAudioInputTranscriptionResultHandler;
  onTranscriptionStatusChange?: IAudioInputTranscriptionStatusChangeHandler;
  onTranscriptionTextChange?: IAudioInputTranscriptionTextChangeHandler;
  preferredMimeType?: string;
  recorderClassName?: string;
  recorderRootClassName?: string;
  restartButtonAriaLabel?: string;
  restartButtonClassName?: string;
  retryLabel?: string;
  sendTranscriptionLabel?: string;
  statusLabels?: Partial<Record<IAudioInputStatus, string>>;
  transcribe?: IAudioInputTranscribeHandler;
  transcribeAndSendLabel?: string;
  transcribeLabel?: string;
  transcribeLimitRecordingLabel?: string;
  transcription?: string;
  transcriptionActionsClassName?: string;
  transcriptionPlaceholder?: string;
  transcriptionTextareaClassName?: string;
  transcriptionTextareaLabel?: string;
  triggerAriaLabel?: string;
  triggerButtonProps?: IAudioInputTriggerButtonProps;
  triggerClassName?: string;
  triggerSize?: IButtonProps['size'];
  triggerTitle?: string;
  triggerVariant?: IButtonProps['variant'];
};
