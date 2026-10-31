import {
  type ReactElement,
  useId,
  useState,
  useRef,
  useMemo,
  useCallback,
  useImperativeHandle,
  useEffect,
  useLayoutEffect,
} from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  extractMessage,
  getErrorCode,
  hasErrorCode,
  Exception,
  type IErrorFeedback,
} from 'jg-exception';
import { LoaderCircle, Mic, RefreshCcw, SendHorizontal } from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { cn } from 'cnfast';

import { ERRORS } from '../../errors/index.js';
import { useErrorFeedbackResolver } from '../error-feedback-provider/index.js';

import { Button } from '../button/index.js';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../dialog/index.js';
import { DEFAULT_FORM_PROPS, FieldError, Textarea } from '../form/index.js';
import {
  AUDIO_INPUT_DEFAULT_CANCEL_LABEL,
  AUDIO_INPUT_DEFAULT_CANCEL_RESET_DELAY_MS,
  AUDIO_INPUT_DEFAULT_CLOSE_BUTTON_ARIA_LABEL,
  AUDIO_INPUT_DEFAULT_DIALOG_TITLE,
  AUDIO_INPUT_DEFAULT_RESTART_BUTTON_ARIA_LABEL,
  AUDIO_INPUT_DEFAULT_RETRY_LABEL,
  AUDIO_INPUT_DEFAULT_SEND_TRANSCRIPTION_LABEL,
  AUDIO_INPUT_DEFAULT_TRIGGER_ARIA_LABEL,
  AUDIO_INPUT_DEFAULT_TRANSCRIBE_AND_SEND_LABEL,
  AUDIO_INPUT_DEFAULT_TRANSCRIBE_LABEL,
  AUDIO_INPUT_DEFAULT_TRANSCRIBE_LIMIT_RECORDING_LABEL,
  AUDIO_INPUT_DEFAULT_TRANSCRIPTION_PLACEHOLDER,
  AUDIO_INPUT_DEFAULT_TRANSCRIPTION_TEXTAREA_LABEL,
  AUDIO_INPUT_IDLE_WAVEFORM_LEVELS,
  AUDIO_INPUT_RECORDING_CHUNK_TIMESLICE_MS,
  AUDIO_INPUT_STATUS_LABELS,
  AUDIO_INPUT_WAVEFORM_BARS,
  AUDIO_INPUT_WAVEFORM_SAMPLE_INTERVAL_MS,
} from './constants.js';
import type {
  IAudioInputControls,
  IAudioInputLimitProgress,
  IAudioInputProps,
  IAudioInputTranscriptionResultHandler,
  IAudioInputRecording,
  IAudioInputStatus,
  IAudioInputTranscriptionFormInput,
  IAudioInputTranscriptionFormValues,
  IAudioInputTranscriptionStatus,
} from './types.js';
import {
  createAudioInputFileName,
  createAudioInputLimitExceededMessage,
  formatAudioInputDuration,
  normalizeAudioInputMaxBytes,
  resolveAudioInputMimeType,
  resolveAudioInputWaveformLevels,
} from './utilities.js';
import { AudioInputTranscriptionFormSchema } from './validations.js';

// browser-specific AudioContext constructor fallback used by Safari.
type IAudioContextConstructor = new () => AudioContext;

// Safari exposes the audio context constructor under the prefixed name.
type IAudioInputWindow = typeof window & {
  webkitAudioContext?: IAudioContextConstructor;
};

// transcription actions track which button currently owns the async state.
type IAudioInputTranscriptionAction = 'transcribe' | 'transcribe-and-send' | 'send';

// transcription request actions can stop a live recording before async work starts.
type IAudioInputTranscriptionRequestAction = Exclude<IAudioInputTranscriptionAction, 'send'>;

// callback diagnostics and visible feedback share this shape but are derived separately.
type IAudioInputErrorDetails = {
  code: string;
  message: string;
};

/**
 * Creates resolver input for the currently visible transcription action.
 * @param transcription The current authored transcription.
 * @param isEditorVisible Whether the submit action sends authored text.
 * @returns Raw transcription form values for the active action.
 */
const createAudioInputTranscriptionFormInput = (
  transcription: string,
  isEditorVisible: boolean,
): IAudioInputTranscriptionFormInput => ({
  action: isEditorVisible ? 'send' : 'transcribe-and-send',
  transcription,
});

/**
 * Checks whether the current browser can record microphone audio.
 * @returns True when MediaRecorder and getUserMedia are available.
 */
const isAudioInputSupported = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.MediaRecorder !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  typeof navigator.mediaDevices?.getUserMedia === 'function';

/**
 * Resolves the browser AudioContext constructor when waveform sampling is available.
 * @returns The AudioContext constructor, or null when unsupported.
 */
const getAudioContextConstructor = (): IAudioContextConstructor | null => {
  return window.AudioContext ?? (window as IAudioInputWindow).webkitAudioContext ?? null;
};

/**
 * Creates normalized limit progress for parent callbacks and limit copy.
 * @param recordedBytes The bytes captured so far.
 * @param maxBytes The active byte limit.
 * @returns The normalized progress payload.
 */
const createLimitProgress = (recordedBytes: number, maxBytes: number): IAudioInputLimitProgress => {
  const progress = Math.min(1, Math.max(0, recordedBytes / maxBytes));
  const percentage = Math.round(progress * 100);

  return {
    maxBytes,
    percentage,
    progress,
    recordedBytes,
  };
};

/**
 * Creates display-ready error details while preserving Exception-style cause codes.
 * @param fallbackMessage The message to use when the cause has no own display message.
 * @param fallbackCode The error code to use when the cause has no own code.
 * @param cause Optional low-level error detail that may carry a stronger message and code.
 * @returns The normalized error details for the alert and callback error.
 */
const createAudioInputErrorDetails = (
  fallbackMessage: string,
  fallbackCode: string,
  cause?: unknown,
): IAudioInputErrorDetails => {
  const causeCode = getErrorCode(cause);

  if (causeCode !== null) {
    const causeMessage = extractMessage(cause);

    return {
      code: causeCode,
      message: stripErrorCodeSuffix(causeMessage, String(causeCode)),
    };
  }

  return {
    code: fallbackCode,
    message: cause === undefined ? fallbackMessage : `${fallbackMessage}: ${extractMessage(cause)}`,
  };
};

/**
 * Removes an already-rendered trailing error code so the UI can show code separately.
 * @param message The extracted or native error message.
 * @param code The display code extracted from the same error.
 * @returns The message without a duplicate trailing code suffix.
 */
const stripErrorCodeSuffix = (message: string, code: string): string => {
  const codeSuffix = ` (${code})`;

  return message.endsWith(codeSuffix) ? message.slice(0, -codeSuffix.length).trim() : message;
};

/**
 * Creates a recording payload from MediaRecorder chunks.
 * @param chunks The captured audio chunks to include in the file.
 * @param mimeType The MIME type reported by MediaRecorder.
 * @param durationMs The elapsed recording duration.
 * @returns The completed recording payload.
 */
const createAudioInputRecording = (
  chunks: readonly Blob[],
  mimeType: string,
  durationMs: number,
): IAudioInputRecording => {
  const blob = new Blob(Array.from(chunks), { type: mimeType });

  return {
    blob,
    durationMs,
    fileName: createAudioInputFileName(mimeType, new Date()),
    mimeType,
    size: blob.size,
  };
};

/**
 * Stops every track in a media stream.
 * @param mediaStream The media stream to release.
 */
const stopMediaStreamTracks = (mediaStream: MediaStream): void => {
  mediaStream.getTracks().forEach((track) => {
    track.stop();
  });
};

/**
 * Renders the compact waveform used while recording.
 * @param props The active state and normalized bar levels.
 * @returns A React element that renders decorative waveform bars.
 */
const AudioInputWaveform = ({
  isActive,
  levels,
}: {
  isActive: boolean;
  levels: readonly number[];
}): ReactElement => (
  <span
    aria-hidden="true"
    data-active={isActive ? 'true' : 'false'}
    data-slot="audio-input-waveform"
    className="flex h-7 shrink-0 items-center gap-0.5"
  >
    {AUDIO_INPUT_WAVEFORM_BARS.map((bar, barIndex) => {
      const level = levels[barIndex] ?? AUDIO_INPUT_IDLE_WAVEFORM_LEVELS[barIndex] ?? 0.2;

      return (
        <span
          key={bar.id}
          data-level={Math.round(level * 100)}
          className={cn(
            'bg-foreground/70 h-7 w-1 origin-center rounded-full transition-transform duration-75 motion-reduce:transition-none motion-reduce:transform-none!',
            isActive ? 'bg-destructive opacity-100' : 'opacity-35',
          )}
          style={{
            transform: `scaleY(${level})`,
          }}
        />
      );
    })}
  </span>
);

// internal forwarding keeps explicit undefined props out of the public contract.
type IAudioInputRecorderProps = {
  [TKey in keyof IAudioInputProps]: IAudioInputProps[TKey] | undefined;
} & { onTranscriptionResult: IAudioInputTranscriptionResultHandler };

/**
 * Renders the dialog body recorder with byte-limit enforcement.
 * @param props The audio input configuration, lifecycle callbacks, and wrapper props.
 * @returns A React element that renders the audio recording workflow.
 */
const AudioInputRecorder = ({
  autoStart = false,
  cancelLabel = AUDIO_INPUT_DEFAULT_CANCEL_LABEL,
  cancelResetDelayMs = AUDIO_INPUT_DEFAULT_CANCEL_RESET_DELAY_MS,
  className,
  controlsRef,
  defaultIsRecording = false,
  defaultIsTranscriptionEditorVisible = false,
  defaultTranscription = '',
  disabled = false,
  isErrorVisible = true,
  isRecording: controlledIsRecording,
  isTranscriptionEditorVisible: controlledIsTranscriptionEditorVisible,
  maxBytes,
  onCancel,
  onElapsedMsChange,
  onLimitProgressChange,
  onRecordedBytesChange,
  onRecordingActiveChange,
  onRecordingCancel,
  onRecordingComplete,
  onRecordingDataAvailable,
  onRecordingError,
  onRecordingStart,
  onRecordingStop,
  onStatusChange,
  onTranscriptionComplete,
  onTranscriptionEditorVisibleChange,
  onTranscriptionError,
  onTranscriptionResult,
  onTranscriptionStatusChange,
  onTranscriptionTextChange,
  preferredMimeType,
  recorderClassName,
  retryLabel = AUDIO_INPUT_DEFAULT_RETRY_LABEL,
  sendTranscriptionLabel = AUDIO_INPUT_DEFAULT_SEND_TRANSCRIPTION_LABEL,
  statusLabels,
  transcribe,
  transcribeAndSendLabel = AUDIO_INPUT_DEFAULT_TRANSCRIBE_AND_SEND_LABEL,
  transcribeLabel = AUDIO_INPUT_DEFAULT_TRANSCRIBE_LABEL,
  transcribeLimitRecordingLabel = AUDIO_INPUT_DEFAULT_TRANSCRIBE_LIMIT_RECORDING_LABEL,
  transcription: controlledTranscription,
  transcriptionActionsClassName,
  transcriptionPlaceholder = AUDIO_INPUT_DEFAULT_TRANSCRIPTION_PLACEHOLDER,
  transcriptionTextareaClassName,
  transcriptionTextareaLabel = AUDIO_INPUT_DEFAULT_TRANSCRIPTION_TEXTAREA_LABEL,
  ...rootProps
}: IAudioInputRecorderProps): ReactElement => {
  const resolveErrorFeedback = useErrorFeedbackResolver();
  const resolvedMaxBytes = normalizeAudioInputMaxBytes(maxBytes);
  const isRecordingControlled = controlledIsRecording !== undefined;
  const isTranscriptionControlled = controlledTranscription !== undefined;
  const isTranscriptionEditorVisibleControlled =
    controlledIsTranscriptionEditorVisible !== undefined;
  const generatedId = useId().replaceAll(':', '');
  const transcriptionErrorId = `audio-input-transcription-error-${generatedId}`;
  const [uncontrolledIsRecording, setUncontrolledIsRecording] = useState(
    () => defaultIsRecording || autoStart,
  );
  const [uncontrolledIsTranscriptionEditorVisible, setUncontrolledIsTranscriptionEditorVisible] =
    useState(() => defaultIsTranscriptionEditorVisible);
  const [status, setStatus] = useState<IAudioInputStatus>('idle');
  const statusRef = useRef<IAudioInputStatus>('idle');
  const [transcriptionStatus, setTranscriptionStatus] =
    useState<IAudioInputTranscriptionStatus>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [recordedBytes, setRecordedBytes] = useState(0);
  const [completedRecording, setCompletedRecording] = useState<IAudioInputRecording | null>(null);
  const [errorDetails, setErrorDetails] = useState<
    (IAudioInputErrorDetails & { feedback: IErrorFeedback }) | null
  >(null);
  const [activeTranscriptionAction, setActiveTranscriptionAction] =
    useState<IAudioInputTranscriptionAction | null>(null);
  const [pendingTranscriptionAction, setPendingTranscriptionAction] =
    useState<IAudioInputTranscriptionRequestAction | null>(null);
  const [retryTranscriptionAction, setRetryTranscriptionAction] =
    useState<IAudioInputTranscriptionAction | null>(null);
  const [waveformLevels, setWaveformLevels] = useState<readonly number[]>(
    AUDIO_INPUT_IDLE_WAVEFORM_LEVELS,
  );
  const recordingSessionRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const previousRecordingRequestRef = useRef(false);
  const recordedBytesRef = useRef(0);
  const recordingStartedAtRef = useRef<number | null>(null);
  const activeMimeTypeRef = useRef('audio/webm');
  const elapsedTimerRef = useRef<number | null>(null);
  const cancelResetTimerRef = useRef<number | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const sendResetTimerRef = useRef<number | null>(null);
  const waveformFrameRef = useRef<number | null>(null);
  const waveformLastSampledAtRef = useRef(0);
  const isRecorderMountedRef = useRef(true);
  const isRecordingCancelingRef = useRef(false);
  const isRecordingAbortedRef = useRef(false);
  const isTranscriptionRequestInFlightRef = useRef(false);
  const isTranscriptionResultInFlightRef = useRef(false);
  const activeTranscriptionActionRef = useRef<IAudioInputTranscriptionAction | null>(null);
  const transcriptionStatusRef = useRef<IAudioInputTranscriptionStatus>('idle');

  const isRecordingRequested = controlledIsRecording ?? uncontrolledIsRecording;
  const isTranscriptionEditorVisible =
    controlledIsTranscriptionEditorVisible ?? uncontrolledIsTranscriptionEditorVisible;
  const form = useForm<
    IAudioInputTranscriptionFormInput,
    unknown,
    IAudioInputTranscriptionFormValues
  >({
    ...DEFAULT_FORM_PROPS,
    resolver: zodResolver(AudioInputTranscriptionFormSchema),
    defaultValues: createAudioInputTranscriptionFormInput(
      defaultTranscription,
      isTranscriptionEditorVisible,
    ),
  });
  const formTranscription = useWatch({
    control: form.control,
    name: 'transcription',
    defaultValue: '',
  });
  const transcription = controlledTranscription ?? formTranscription;
  const transcriptionValidationMessage = form.formState.errors.transcription?.message;
  const isRequestingPermission = status === 'requesting-permission';
  const isRecording = status === 'recording';
  const isTranscriptionActionVisible = typeof transcribe === 'function';
  const isTranscribing = transcriptionStatus === 'transcribing';
  const isSendingTranscription = transcriptionStatus === 'sending';
  const isAsyncTranscriptionBusy = isTranscribing || isSendingTranscription;
  const isTranscriptionActionPending = pendingTranscriptionAction !== null;
  const isTranscriptionBusy =
    isAsyncTranscriptionBusy || isTranscriptionActionPending || form.formState.isSubmitting;
  const isTranscriptionLoadingVisible =
    isTranscriptionBusy && (!isTranscriptionEditorVisible || activeTranscriptionAction !== 'send');
  const isRetryAvailable = retryTranscriptionAction !== null;
  const isOverLimit = recordedBytes > resolvedMaxBytes;
  const mergedStatusLabels = useMemo(
    () => ({
      ...AUDIO_INPUT_STATUS_LABELS,
      ...statusLabels,
    }),
    [statusLabels],
  );
  const statusLabel = mergedStatusLabels[status];
  const formattedElapsed = useMemo(() => formatAudioInputDuration(elapsedMs), [elapsedMs]);
  const sizeProgress = Math.min(1, recordedBytes / resolvedMaxBytes);
  const sizeProgressPercentage = Math.round(sizeProgress * 100);
  const sizeMeterLabel = isOverLimit ? 'Limit reached' : `Limit ${sizeProgressPercentage}%`;
  const hasTranscribableAudio = isRecording || completedRecording !== null;
  const canSendTranscription = completedRecording !== null && transcription.trim().length > 0;
  const canTranscribe =
    typeof transcribe === 'function' &&
    hasTranscribableAudio &&
    !isRequestingPermission &&
    status !== 'error';
  const canTranscribeAndSend = canTranscribe;
  const isLimitExceededError = hasErrorCode(errorDetails, ERRORS.AUDIO_INPUT_MAX_BYTES_EXCEEDED);
  const canTranscribeLimitedRecording =
    isLimitExceededError && typeof transcribe === 'function' && completedRecording !== null;

  /**
   * Clears a pending delayed cancel reset when the workflow changes or unmounts.
   */
  const clearCancelResetTimer = useCallback((): void => {
    if (cancelResetTimerRef.current === null) {
      return;
    }

    window.clearTimeout(cancelResetTimerRef.current);
    cancelResetTimerRef.current = null;
  }, []);

  /**
   * Clears a pending restart request when the recorder unmounts or resets again.
   */
  const clearRestartTimer = useCallback((): void => {
    if (restartTimerRef.current === null) {
      return;
    }

    window.clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
  }, []);

  /**
   * Clears a pending post-send reset when the dialog unmounts or a new session starts.
   */
  const clearSendResetTimer = useCallback((): void => {
    if (sendResetTimerRef.current === null) {
      return;
    }

    window.clearTimeout(sendResetTimerRef.current);
    sendResetTimerRef.current = null;
  }, []);

  /**
   * Updates the externally controllable recording request.
   * @param nextIsRecording Whether recording should be active.
   */
  const setRecordingRequested = useCallback(
    (nextIsRecording: boolean): void => {
      if (!isRecordingControlled) {
        setUncontrolledIsRecording(nextIsRecording);
      }

      onRecordingActiveChange?.(nextIsRecording);
    },
    [isRecordingControlled, onRecordingActiveChange],
  );

  /**
   * Updates visible recorder status and notifies parent listeners.
   * @param nextStatus The next recorder lifecycle status.
   */
  const setAudioInputStatus = useCallback(
    (nextStatus: IAudioInputStatus): void => {
      if (statusRef.current === nextStatus) return;
      statusRef.current = nextStatus;
      setStatus(nextStatus);
      onStatusChange?.(nextStatus);
    },
    [onStatusChange],
  );

  /**
   * Updates elapsed recording time and notifies parent listeners.
   * @param nextElapsedMs The elapsed duration in milliseconds.
   */
  const setAudioInputElapsedMs = useCallback(
    (nextElapsedMs: number): void => {
      setElapsedMs(nextElapsedMs);
      onElapsedMsChange?.(nextElapsedMs);
    },
    [onElapsedMsChange],
  );

  /**
   * Updates recorded bytes and notifies parent listeners with normalized limit progress.
   * @param nextRecordedBytes The byte count captured so far.
   */
  const setAudioInputRecordedBytes = useCallback(
    (nextRecordedBytes: number): void => {
      const progress = createLimitProgress(nextRecordedBytes, resolvedMaxBytes);

      setRecordedBytes(nextRecordedBytes);
      onRecordedBytesChange?.(nextRecordedBytes);
      onLimitProgressChange?.(progress);
    },
    [onLimitProgressChange, onRecordedBytesChange, resolvedMaxBytes],
  );

  /**
   * Updates transcription status and notifies parent listeners.
   * @param nextStatus The next transcription lifecycle status.
   */
  const setAudioInputTranscriptionStatus = useCallback(
    (nextStatus: IAudioInputTranscriptionStatus): void => {
      if (transcriptionStatusRef.current === nextStatus) {
        return;
      }

      transcriptionStatusRef.current = nextStatus;
      setTranscriptionStatus(nextStatus);
      onTranscriptionStatusChange?.(nextStatus);
    },
    [onTranscriptionStatusChange],
  );

  /**
   * Updates transcription text in controlled or uncontrolled mode.
   * @param nextTranscription The next transcription text.
   */
  const setAudioInputTranscription = useCallback(
    (nextTranscription: string): void => {
      if (!isTranscriptionControlled) {
        form.setValue('transcription', nextTranscription, {
          shouldDirty: true,
          shouldValidate: form.getFieldState('transcription').invalid,
        });
      }

      onTranscriptionTextChange?.(nextTranscription);
    },
    [form, isTranscriptionControlled, onTranscriptionTextChange],
  );

  /**
   * Shows or hides the editable transcription area.
   * @param nextIsVisible Whether the text area should be visible.
   */
  const setAudioInputTranscriptionEditorVisible = useCallback(
    (nextIsVisible: boolean): void => {
      if (!isTranscriptionEditorVisibleControlled) {
        setUncontrolledIsTranscriptionEditorVisible(nextIsVisible);
      }

      onTranscriptionEditorVisibleChange?.(nextIsVisible);
    },
    [isTranscriptionEditorVisibleControlled, onTranscriptionEditorVisibleChange],
  );

  /**
   * Updates the active async action in state and in a ref for same-tick error handling.
   * @param nextAction The action currently driving transcription work.
   */
  const setAudioInputActiveTranscriptionAction = useCallback(
    (nextAction: IAudioInputTranscriptionAction | null): void => {
      activeTranscriptionActionRef.current = nextAction;
      setActiveTranscriptionAction(nextAction);
    },
    [],
  );

  /**
   * Clears transcription output when a new audio session starts or resets.
   */
  const resetTranscriptionSession = useCallback((): void => {
    recordingSessionRef.current += 1;
    isTranscriptionRequestInFlightRef.current = false;
    isTranscriptionResultInFlightRef.current = false;
    clearSendResetTimer();
    setCompletedRecording(null);
    setAudioInputActiveTranscriptionAction(null);
    setPendingTranscriptionAction(null);
    setRetryTranscriptionAction(null);
    form.reset(createAudioInputTranscriptionFormInput('', isTranscriptionEditorVisible));
    onTranscriptionTextChange?.('');
    setAudioInputTranscriptionEditorVisible(false);
    setAudioInputTranscriptionStatus('idle');
  }, [
    clearSendResetTimer,
    form,
    isTranscriptionEditorVisible,
    onTranscriptionTextChange,
    setAudioInputActiveTranscriptionAction,
    setAudioInputTranscriptionEditorVisible,
    setAudioInputTranscriptionStatus,
  ]);

  /**
   * Stops waveform sampling and releases Web Audio resources.
   * @param shouldResetLevels Whether the visible waveform should return to idle levels.
   */
  const stopWaveform = useCallback((shouldResetLevels = true): void => {
    if (waveformFrameRef.current !== null) {
      window.cancelAnimationFrame(waveformFrameRef.current);
      waveformFrameRef.current = null;
    }

    if (audioSourceNodeRef.current !== null) {
      audioSourceNodeRef.current.disconnect();
      audioSourceNodeRef.current = null;
    }

    const audioContext = audioContextRef.current;

    if (audioContext !== null) {
      void audioContext.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    waveformLastSampledAtRef.current = 0;

    if (shouldResetLevels) {
      setWaveformLevels(AUDIO_INPUT_IDLE_WAVEFORM_LEVELS);
    }
  }, []);

  /**
   * Starts microphone waveform sampling for the active media stream.
   * @param mediaStream The microphone stream to visualize.
   */
  const startWaveform = useCallback(
    (mediaStream: MediaStream): void => {
      const AudioContextConstructor = getAudioContextConstructor();

      if (AudioContextConstructor === null) {
        return;
      }

      stopWaveform(false);

      try {
        const audioContext = new AudioContextConstructor();
        audioContextRef.current = audioContext;
        const analyserNode = audioContext.createAnalyser();
        const audioSourceNode = audioContext.createMediaStreamSource(mediaStream);

        analyserNode.fftSize = 256;
        analyserNode.smoothingTimeConstant = 0.72;
        const waveformSamples = new Uint8Array(analyserNode.frequencyBinCount);

        audioSourceNodeRef.current = audioSourceNode;
        audioSourceNode.connect(analyserNode);

        /**
         * Samples the analyser and updates waveform bars at a controlled interval.
         * @param timestamp The requestAnimationFrame timestamp.
         */
        const sampleWaveform = (timestamp: number): void => {
          if (
            timestamp - waveformLastSampledAtRef.current >=
            AUDIO_INPUT_WAVEFORM_SAMPLE_INTERVAL_MS
          ) {
            analyserNode.getByteTimeDomainData(waveformSamples);
            setWaveformLevels(
              resolveAudioInputWaveformLevels(waveformSamples, AUDIO_INPUT_WAVEFORM_BARS.length),
            );
            waveformLastSampledAtRef.current = timestamp;
          }

          waveformFrameRef.current = window.requestAnimationFrame(sampleWaveform);
        };

        void audioContext.resume().catch(() => undefined);
        waveformFrameRef.current = window.requestAnimationFrame(sampleWaveform);
      } catch {
        stopWaveform(true);
      }
    },
    [stopWaveform],
  );

  /**
   * Stops the elapsed-time interval when a session ends.
   */
  const stopElapsedTimer = useCallback((): void => {
    if (elapsedTimerRef.current !== null) {
      window.clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }, []);

  /**
   * Starts the elapsed-time interval for the active recording session.
   */
  const startElapsedTimer = useCallback((): void => {
    stopElapsedTimer();
    elapsedTimerRef.current = window.setInterval(() => {
      if (recordingStartedAtRef.current !== null) {
        setAudioInputElapsedMs(Date.now() - recordingStartedAtRef.current);
      }
    }, 250);
  }, [setAudioInputElapsedMs, stopElapsedTimer]);

  /**
   * Releases the recorder callbacks and microphone tracks.
   */
  const cleanupMediaResources = useCallback((): void => {
    const mediaRecorder = mediaRecorderRef.current;

    if (mediaRecorder !== null) {
      mediaRecorder.ondataavailable = null;
      mediaRecorder.onerror = null;
      mediaRecorder.onstop = null;

      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }

      mediaRecorderRef.current = null;
    }

    if (mediaStreamRef.current !== null) {
      stopMediaStreamTracks(mediaStreamRef.current);
      mediaStreamRef.current = null;
    }
  }, []);

  /**
   * Resets transient session refs and visible progress before a new recording starts.
   */
  const resetRecordingSession = useCallback((): void => {
    clearCancelResetTimer();
    clearRestartTimer();
    clearSendResetTimer();
    chunksRef.current = [];
    recordedBytesRef.current = 0;
    recordingStartedAtRef.current = null;
    isRecordingCancelingRef.current = false;
    isRecordingAbortedRef.current = false;
    resetTranscriptionSession();
    setWaveformLevels(AUDIO_INPUT_IDLE_WAVEFORM_LEVELS);
    setAudioInputElapsedMs(0);
    setAudioInputRecordedBytes(0);
    setErrorDetails(null);
  }, [
    clearCancelResetTimer,
    clearRestartTimer,
    clearSendResetTimer,
    resetTranscriptionSession,
    setAudioInputElapsedMs,
    setAudioInputRecordedBytes,
  ]);

  /**
   * Requests the active MediaRecorder to stop when it is still running.
   */
  const stopActiveRecorder = useCallback((): void => {
    const mediaRecorder = mediaRecorderRef.current;

    if (mediaRecorder !== null && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
  }, []);

  /**
   * Stores an application error in the component and notifies the consumer.
   * @param message The user-facing error message.
   * @param code The stable application error code.
   * @param cause Optional low-level error detail to include in the message.
   * @returns The normalized application exception.
   */
  const reportAudioInputError = useCallback(
    (message: string, code: string, cause?: unknown): Exception => {
      const nextErrorDetails = createAudioInputErrorDetails(message, code, cause);
      const audioInputError = new Exception(nextErrorDetails.message, {
        code: nextErrorDetails.code,
        cause,
      });
      const feedback = resolveErrorFeedback(
        cause instanceof Error && cause.name === 'AbortError' ? cause : audioInputError,
        { fallbackMessage: message },
      );

      setRecordingRequested(false);
      setAudioInputActiveTranscriptionAction(null);
      setPendingTranscriptionAction(null);
      setRetryTranscriptionAction(null);
      setAudioInputTranscriptionStatus('idle');
      setErrorDetails(feedback.isCancelled ? null : { ...nextErrorDetails, feedback });
      setAudioInputStatus(feedback.isCancelled ? 'idle' : 'error');
      onRecordingError?.(audioInputError);

      return audioInputError;
    },
    [
      onRecordingError,
      resolveErrorFeedback,
      setAudioInputActiveTranscriptionAction,
      setAudioInputStatus,
      setAudioInputTranscriptionStatus,
      setRecordingRequested,
    ],
  );

  /**
   * Stores a transcription error in the component and notifies the consumer.
   * @param message The user-facing error message.
   * @param code The stable application error code.
   * @param cause Optional low-level error detail to include in the message.
   * @returns The normalized application exception.
   */
  const reportTranscriptionError = useCallback(
    (message: string, code: string, cause?: unknown): Exception => {
      const nextErrorDetails = createAudioInputErrorDetails(message, code, cause);
      const nextRetryAction = activeTranscriptionActionRef.current;
      const transcriptionError = new Exception(nextErrorDetails.message, {
        code: nextErrorDetails.code,
        cause,
      });
      const feedback = resolveErrorFeedback(
        cause instanceof Error && cause.name === 'AbortError' ? cause : transcriptionError,
        { fallbackMessage: message },
      );

      setAudioInputActiveTranscriptionAction(null);
      setPendingTranscriptionAction(null);
      setRetryTranscriptionAction(feedback.isCancelled ? null : nextRetryAction);
      setErrorDetails(feedback.isCancelled ? null : { ...nextErrorDetails, feedback });
      setAudioInputTranscriptionStatus(feedback.isCancelled ? 'idle' : 'error');
      onTranscriptionError?.(transcriptionError);

      return transcriptionError;
    },
    [
      onTranscriptionError,
      resolveErrorFeedback,
      setAudioInputActiveTranscriptionAction,
      setAudioInputTranscriptionStatus,
    ],
  );

  /**
   * Resets visible cancel state after resources have already been released.
   */
  const resetCanceledRecordingView = useCallback((): void => {
    resetTranscriptionSession();
    isRecordingCancelingRef.current = false;
    setWaveformLevels(AUDIO_INPUT_IDLE_WAVEFORM_LEVELS);
    setAudioInputElapsedMs(0);
    setAudioInputRecordedBytes(0);
    setErrorDetails(null);
    setAudioInputStatus('idle');
  }, [
    resetTranscriptionSession,
    setAudioInputElapsedMs,
    setAudioInputRecordedBytes,
    setAudioInputStatus,
  ]);

  /**
   * Cancels an in-progress recording without emitting a completed audio file.
   * @param visibleResetDelayMs Delay before visible state resets after resources stop.
   */
  const cancelRecordingWithDelay = useCallback(
    (visibleResetDelayMs: number): void => {
      const shouldNotifyCancel =
        !isRecordingCancelingRef.current && (isRequestingPermission || isRecording);
      const normalizedResetDelayMs = Math.max(0, visibleResetDelayMs);

      clearCancelResetTimer();
      recordingSessionRef.current += 1;
      isRecordingCancelingRef.current = true;
      isRecordingAbortedRef.current = true;
      chunksRef.current = [];
      recordedBytesRef.current = 0;
      recordingStartedAtRef.current = null;
      setRecordingRequested(false);
      stopElapsedTimer();
      stopWaveform(normalizedResetDelayMs === 0);
      cleanupMediaResources();

      if (normalizedResetDelayMs === 0) {
        resetCanceledRecordingView();
      } else {
        cancelResetTimerRef.current = window.setTimeout(() => {
          cancelResetTimerRef.current = null;
          resetCanceledRecordingView();
        }, normalizedResetDelayMs);
      }

      if (shouldNotifyCancel) {
        onRecordingCancel?.();
      }
    },
    [
      cleanupMediaResources,
      clearCancelResetTimer,
      isRecording,
      isRequestingPermission,
      onRecordingCancel,
      resetCanceledRecordingView,
      setRecordingRequested,
      stopElapsedTimer,
      stopWaveform,
    ],
  );

  /**
   * Cancels an in-progress recording and immediately resets visible state.
   */
  const cancelRecording = useCallback((): void => {
    cancelRecordingWithDelay(AUDIO_INPUT_DEFAULT_CANCEL_RESET_DELAY_MS);
  }, [cancelRecordingWithDelay]);

  /**
   * Resets the recorder to idle state and discards any visible session output.
   */
  const resetRecording = useCallback((): void => {
    if (isRequestingPermission || isRecording) {
      cancelRecordingWithDelay(0);
      return;
    }

    clearCancelResetTimer();
    clearRestartTimer();
    clearSendResetTimer();
    isRecordingCancelingRef.current = false;
    isRecordingAbortedRef.current = false;
    chunksRef.current = [];
    recordedBytesRef.current = 0;
    recordingStartedAtRef.current = null;
    resetTranscriptionSession();
    setRecordingRequested(false);
    setWaveformLevels(AUDIO_INPUT_IDLE_WAVEFORM_LEVELS);
    setAudioInputElapsedMs(0);
    setAudioInputRecordedBytes(0);
    setErrorDetails(null);
    setAudioInputStatus('idle');
  }, [
    cancelRecordingWithDelay,
    clearCancelResetTimer,
    clearRestartTimer,
    clearSendResetTimer,
    isRecording,
    isRequestingPermission,
    resetTranscriptionSession,
    setAudioInputElapsedMs,
    setAudioInputRecordedBytes,
    setAudioInputStatus,
    setRecordingRequested,
  ]);

  /**
   * Handles recorder chunks and enforces the configured byte limit.
   * @param event The MediaRecorder data event.
   */
  const handleDataAvailable = useCallback(
    (event: BlobEvent): void => {
      if (event.data.size === 0 || isRecordingAbortedRef.current) {
        return;
      }

      const nextRecordedBytes = recordedBytesRef.current + event.data.size;

      if (nextRecordedBytes > resolvedMaxBytes) {
        const capturedBytes = recordedBytesRef.current;

        if (chunksRef.current.length > 0 && capturedBytes > 0) {
          const durationMs =
            recordingStartedAtRef.current === null ? 0 : Date.now() - recordingStartedAtRef.current;
          const limitRecording = createAudioInputRecording(
            chunksRef.current,
            activeMimeTypeRef.current,
            durationMs,
          );

          setCompletedRecording(limitRecording);
        }

        isRecordingAbortedRef.current = true;
        chunksRef.current = [];
        recordedBytesRef.current = nextRecordedBytes;
        setAudioInputRecordedBytes(nextRecordedBytes);
        reportAudioInputError(
          createAudioInputLimitExceededMessage(),
          ERRORS.AUDIO_INPUT_MAX_BYTES_EXCEEDED,
        );
        stopActiveRecorder();
        return;
      }

      chunksRef.current.push(event.data);
      recordedBytesRef.current = nextRecordedBytes;
      setAudioInputRecordedBytes(nextRecordedBytes);
      onRecordingDataAvailable?.(event.data, nextRecordedBytes);
    },
    [
      onRecordingDataAvailable,
      reportAudioInputError,
      resolvedMaxBytes,
      setAudioInputRecordedBytes,
      stopActiveRecorder,
    ],
  );

  /**
   * Handles a clean MediaRecorder stop and emits the completed recording.
   */
  const handleRecordingStop = useCallback((): void => {
    stopElapsedTimer();
    stopWaveform(true);

    const durationMs =
      recordingStartedAtRef.current === null ? 0 : Date.now() - recordingStartedAtRef.current;
    const chunks = chunksRef.current;
    const hasRecordingData = chunks.length > 0 && recordedBytesRef.current > 0;

    cleanupMediaResources();
    recordingStartedAtRef.current = null;

    if (isRecordingAbortedRef.current) {
      chunksRef.current = [];
      setAudioInputActiveTranscriptionAction(null);
      setPendingTranscriptionAction(null);
      setAudioInputTranscriptionStatus('idle');
      return;
    }

    setRecordingRequested(false);
    onRecordingStop?.();

    if (!hasRecordingData) {
      setAudioInputActiveTranscriptionAction(null);
      setPendingTranscriptionAction(null);
      setAudioInputTranscriptionStatus('idle');
      setAudioInputStatus('idle');
      setAudioInputElapsedMs(0);
      setAudioInputRecordedBytes(0);
      return;
    }

    const recording = createAudioInputRecording(chunks, activeMimeTypeRef.current, durationMs);

    setAudioInputStatus('complete');
    setAudioInputRecordedBytes(recording.size);
    setCompletedRecording(recording);
    onRecordingComplete?.(recording);
  }, [
    cleanupMediaResources,
    onRecordingComplete,
    onRecordingStop,
    setAudioInputElapsedMs,
    setAudioInputActiveTranscriptionAction,
    setAudioInputRecordedBytes,
    setAudioInputStatus,
    setAudioInputTranscriptionStatus,
    setRecordingRequested,
    stopElapsedTimer,
    stopWaveform,
  ]);

  /**
   * Handles a MediaRecorder runtime failure.
   * @param event The recorder error event.
   */
  const handleRecordingError = useCallback(
    (event: Event): void => {
      isRecordingAbortedRef.current = true;
      stopElapsedTimer();
      stopWaveform(true);
      cleanupMediaResources();
      reportAudioInputError('Audio recording failed.', ERRORS.AUDIO_INPUT_RECORDING_FAILED, event);
    },
    [cleanupMediaResources, reportAudioInputError, stopElapsedTimer, stopWaveform],
  );

  /**
   * Requests microphone permission and starts a new MediaRecorder session.
   * @returns A promise that resolves after the start attempt finishes.
   */
  const startRecording = useCallback(async (): Promise<void> => {
    if (disabled || isRequestingPermission || isRecording) {
      return;
    }

    if (!isAudioInputSupported()) {
      reportAudioInputError(
        'Audio recording is not supported in this browser.',
        ERRORS.AUDIO_INPUT_UNSUPPORTED,
      );
      return;
    }

    resetRecordingSession();
    const recordingSession = recordingSessionRef.current;
    setAudioInputStatus('requesting-permission');
    onRecordingStart?.();

    let mediaStream: MediaStream;

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      if (!isRecorderMountedRef.current || recordingSessionRef.current !== recordingSession) {
        return;
      }

      isRecordingAbortedRef.current = true;
      stopElapsedTimer();
      stopWaveform(true);
      cleanupMediaResources();
      reportAudioInputError(
        'Microphone access failed.',
        ERRORS.AUDIO_INPUT_MICROPHONE_ACCESS_FAILED,
        error,
      );
      return;
    }

    if (!isRecorderMountedRef.current || recordingSessionRef.current !== recordingSession) {
      stopMediaStreamTracks(mediaStream);
      return;
    }

    try {
      mediaStreamRef.current = mediaStream;
      const mimeType = resolveAudioInputMimeType(preferredMimeType);
      const mediaRecorder = new window.MediaRecorder(
        mediaStream,
        mimeType === undefined ? undefined : { mimeType },
      );

      mediaRecorderRef.current = mediaRecorder;
      activeMimeTypeRef.current = mediaRecorder.mimeType || mimeType || 'audio/webm';
      mediaRecorder.ondataavailable = handleDataAvailable;
      mediaRecorder.onerror = handleRecordingError;
      mediaRecorder.onstop = handleRecordingStop;
      recordingStartedAtRef.current = Date.now();
      mediaRecorder.start(AUDIO_INPUT_RECORDING_CHUNK_TIMESLICE_MS);
      startWaveform(mediaStream);
      setAudioInputStatus('recording');
      startElapsedTimer();
    } catch (error) {
      isRecordingAbortedRef.current = true;
      stopElapsedTimer();
      stopWaveform(true);
      cleanupMediaResources();
      reportAudioInputError('Audio recording failed.', ERRORS.AUDIO_INPUT_RECORDING_FAILED, error);
    }
  }, [
    cleanupMediaResources,
    disabled,
    handleDataAvailable,
    handleRecordingError,
    handleRecordingStop,
    isRecording,
    isRequestingPermission,
    onRecordingStart,
    preferredMimeType,
    reportAudioInputError,
    resetRecordingSession,
    setAudioInputStatus,
    startElapsedTimer,
    startWaveform,
    stopElapsedTimer,
    stopWaveform,
  ]);

  /**
   * Starts recording after an external control requests it.
   */
  const requestRecordingStart = useCallback((): void => {
    setRecordingRequested(true);
  }, [setRecordingRequested]);

  /**
   * Stops recording after an external control requests it.
   */
  const requestRecordingStop = useCallback((): void => {
    setRecordingRequested(false);
  }, [setRecordingRequested]);

  /**
   * Starts a fresh recording session after clearing the current recorder state.
   */
  const restartRecording = useCallback((): void => {
    clearRestartTimer();

    if (isRequestingPermission || isRecording) {
      cancelRecordingWithDelay(0);
    } else {
      resetRecording();
    }

    restartTimerRef.current = window.setTimeout(() => {
      restartTimerRef.current = null;
      requestRecordingStart();
    }, 0);
  }, [
    cancelRecordingWithDelay,
    clearRestartTimer,
    isRecording,
    isRequestingPermission,
    requestRecordingStart,
    resetRecording,
  ]);

  /**
   * Sends transcription text to the parent result handler.
   * @param nextTranscription The transcription text to send.
   * @param recording The recording that produced the transcription.
   * @returns A promise that resolves after the send attempt finishes.
   */
  const sendTranscriptionResult = useCallback(
    async (nextTranscription: string, recording: IAudioInputRecording): Promise<void> => {
      if (isTranscriptionResultInFlightRef.current) {
        return;
      }

      const recordingSession = recordingSessionRef.current;
      isTranscriptionResultInFlightRef.current = true;
      setErrorDetails(null);
      setRetryTranscriptionAction(null);
      setAudioInputActiveTranscriptionAction('send');
      setAudioInputTranscriptionStatus('sending');

      try {
        await onTranscriptionResult(nextTranscription, recording);
        if (!isRecorderMountedRef.current || recordingSessionRef.current !== recordingSession)
          return;
        clearSendResetTimer();
        sendResetTimerRef.current = window.setTimeout(
          () => {
            sendResetTimerRef.current = null;
            setAudioInputTranscriptionStatus('sent');
            setAudioInputTranscriptionEditorVisible(false);
            setAudioInputActiveTranscriptionAction(null);
          },
          Math.max(0, cancelResetDelayMs),
        );
      } catch (error) {
        if (!isRecorderMountedRef.current || recordingSessionRef.current !== recordingSession)
          return;
        reportTranscriptionError(
          'Transcription could not be sent.',
          ERRORS.AUDIO_INPUT_TRANSCRIPTION_RESULT_FAILED,
          error,
        );
      } finally {
        if (recordingSessionRef.current === recordingSession)
          isTranscriptionResultInFlightRef.current = false;
      }
    },
    [
      cancelResetDelayMs,
      clearSendResetTimer,
      onTranscriptionResult,
      reportTranscriptionError,
      setAudioInputActiveTranscriptionAction,
      setAudioInputTranscriptionEditorVisible,
      setAudioInputTranscriptionStatus,
    ],
  );

  /**
   * Runs the configured transcription function for a completed recording.
   * @param shouldSend Whether the transcription result should be sent immediately.
   * @param recording The recording to transcribe, defaulting to the latest completed recording.
   * @returns A promise that resolves after transcription work finishes.
   */
  const transcribeRecording = useCallback(
    async (
      shouldSend: boolean,
      recording: IAudioInputRecording | null = completedRecording,
    ): Promise<void> => {
      if (
        typeof transcribe !== 'function' ||
        recording === null ||
        isTranscriptionRequestInFlightRef.current
      ) {
        return;
      }

      const nextTranscriptionAction = shouldSend ? 'transcribe-and-send' : 'transcribe';
      const shouldPreserveRetryError = retryTranscriptionAction === nextTranscriptionAction;

      const recordingSession = recordingSessionRef.current;
      isTranscriptionRequestInFlightRef.current = true;

      if (!shouldPreserveRetryError) {
        setErrorDetails(null);
        setRetryTranscriptionAction(null);
      }

      setAudioInputActiveTranscriptionAction(nextTranscriptionAction);
      setAudioInputTranscriptionStatus('transcribing');

      try {
        const nextTranscription = await transcribe(recording);
        if (!isRecorderMountedRef.current || recordingSessionRef.current !== recordingSession)
          return;

        if (typeof nextTranscription !== 'string') {
          reportTranscriptionError(
            'Audio transcription returned an invalid result.',
            ERRORS.AUDIO_INPUT_TRANSCRIPTION_INVALID_RESULT,
          );
          return;
        }

        setErrorDetails(null);
        setRetryTranscriptionAction(null);
        setAudioInputTranscription(nextTranscription);
        onTranscriptionComplete?.(nextTranscription, recording);
        if (!isRecorderMountedRef.current || recordingSessionRef.current !== recordingSession)
          return;

        if (shouldSend) {
          await sendTranscriptionResult(nextTranscription, recording);
          return;
        }

        setAudioInputTranscriptionEditorVisible(true);
        setAudioInputTranscriptionStatus('ready');
        setAudioInputActiveTranscriptionAction(null);
      } catch (error) {
        if (!isRecorderMountedRef.current || recordingSessionRef.current !== recordingSession)
          return;
        reportTranscriptionError(
          'Audio transcription failed.',
          ERRORS.AUDIO_INPUT_TRANSCRIPTION_FAILED,
          error,
        );
      } finally {
        if (recordingSessionRef.current === recordingSession)
          isTranscriptionRequestInFlightRef.current = false;
      }
    },
    [
      completedRecording,
      onTranscriptionComplete,
      reportTranscriptionError,
      retryTranscriptionAction,
      sendTranscriptionResult,
      setAudioInputActiveTranscriptionAction,
      setAudioInputTranscription,
      setAudioInputTranscriptionEditorVisible,
      setAudioInputTranscriptionStatus,
      transcribe,
    ],
  );

  /**
   * Stops active recording if needed and then runs the requested transcription action.
   * @param action The transcription action requested by the user.
   */
  const requestTranscriptionAction = useCallback(
    (action: IAudioInputTranscriptionRequestAction): void => {
      if (
        disabled ||
        typeof transcribe !== 'function' ||
        isRequestingPermission ||
        isAsyncTranscriptionBusy ||
        status === 'error'
      ) {
        return;
      }

      if (!isRecording && completedRecording === null) {
        return;
      }

      const shouldPreserveRetryError = retryTranscriptionAction === action;

      if (!shouldPreserveRetryError) {
        setErrorDetails(null);
        setRetryTranscriptionAction(null);
      }

      setAudioInputActiveTranscriptionAction(action);
      setAudioInputTranscriptionStatus('transcribing');

      if (isRecording) {
        setPendingTranscriptionAction(action);
        setRecordingRequested(false);
        stopActiveRecorder();
        return;
      }

      void transcribeRecording(action === 'transcribe-and-send', completedRecording);
    },
    [
      completedRecording,
      disabled,
      isAsyncTranscriptionBusy,
      isRecording,
      isRequestingPermission,
      retryTranscriptionAction,
      setRecordingRequested,
      setAudioInputActiveTranscriptionAction,
      setAudioInputTranscriptionStatus,
      status,
      stopActiveRecorder,
      transcribe,
      transcribeRecording,
    ],
  );

  /**
   * Starts transcription and opens the editable transcription text area.
   */
  const handleTranscribeClick = useCallback((): void => {
    requestTranscriptionAction('transcribe');
  }, [requestTranscriptionAction]);

  /**
   * Transcribes audio captured before the byte limit stopped the recording.
   */
  const handleTranscribeLimitedRecordingClick = useCallback((): void => {
    if (
      !disabled &&
      !isTranscriptionBusy &&
      canTranscribeLimitedRecording &&
      completedRecording !== null
    ) {
      void transcribeRecording(false, completedRecording);
    }
  }, [
    canTranscribeLimitedRecording,
    completedRecording,
    disabled,
    isTranscriptionBusy,
    transcribeRecording,
  ]);

  /**
   * Runs the action selected by the resolver-validated transcription form.
   * @param values The validated action and normalized transcription values.
   * @returns A promise that resolves after an authored transcription is sent.
   */
  const handleTranscriptionSubmit = useCallback(
    async (values: IAudioInputTranscriptionFormValues): Promise<void> => {
      if (values.action === 'transcribe-and-send') {
        requestTranscriptionAction('transcribe-and-send');
        return;
      }

      if (completedRecording === null) {
        return;
      }

      await sendTranscriptionResult(values.transcription, completedRecording);
    },
    [
      completedRecording,
      onTranscriptionResult,
      requestTranscriptionAction,
      sendTranscriptionResult,
    ],
  );

  /**
   * Retries the failed transcription or send action represented by the current error.
   */
  const handleRetryClick = useCallback((): void => {
    if (
      !disabled &&
      retryTranscriptionAction !== null &&
      !isTranscriptionBusy &&
      completedRecording !== null
    ) {
      if (retryTranscriptionAction === 'send') {
        form.setValue('action', 'send');
        void form.handleSubmit(handleTranscriptionSubmit)();
      } else {
        void transcribeRecording(
          retryTranscriptionAction === 'transcribe-and-send',
          completedRecording,
        );
      }
    }
  }, [
    completedRecording,
    disabled,
    form,
    handleTranscriptionSubmit,
    isTranscriptionBusy,
    onTranscriptionResult,
    requestTranscriptionAction,
    retryTranscriptionAction,
    transcribeRecording,
  ]);

  /**
   * Cancels the current recording workflow and notifies consumers.
   */
  const handleCancelClick = useCallback((): void => {
    if (!isTranscriptionBusy) {
      cancelRecordingWithDelay(cancelResetDelayMs);
      onCancel?.();
    }
  }, [cancelRecordingWithDelay, cancelResetDelayMs, isTranscriptionBusy, onCancel]);

  useImperativeHandle(
    controlsRef,
    (): IAudioInputControls => ({
      cancelRecording,
      restartRecording,
      resetRecording,
      startRecording: requestRecordingStart,
      stopRecording: requestRecordingStop,
    }),
    [
      cancelRecording,
      requestRecordingStart,
      requestRecordingStop,
      resetRecording,
      restartRecording,
    ],
  );

  useEffect(() => {
    if (controlledTranscription === undefined) {
      return;
    }

    form.setValue('transcription', controlledTranscription, {
      shouldValidate: form.getFieldState('transcription').invalid,
    });
  }, [controlledTranscription, form]);

  useEffect(() => {
    const nextAction = isTranscriptionEditorVisible ? 'send' : 'transcribe-and-send';

    if (form.getValues('action') !== nextAction) {
      form.setValue('action', nextAction);
    }

    if (!isTranscriptionEditorVisible && form.getFieldState('transcription').invalid) {
      form.clearErrors('transcription');
    }
  }, [form, isTranscriptionEditorVisible]);

  useEffect(() => {
    if (autoStart) {
      setRecordingRequested(true);
    }
  }, [autoStart, setRecordingRequested]);

  useEffect(() => {
    if (
      pendingTranscriptionAction === null ||
      completedRecording === null ||
      isRecording ||
      isRequestingPermission
    ) {
      return;
    }

    const nextAction = pendingTranscriptionAction;

    setPendingTranscriptionAction(null);
    void transcribeRecording(nextAction === 'transcribe-and-send', completedRecording);
  }, [
    completedRecording,
    isRecording,
    isRequestingPermission,
    pendingTranscriptionAction,
    transcribeRecording,
  ]);

  useEffect(() => {
    const wasRecordingRequested = previousRecordingRequestRef.current;

    previousRecordingRequestRef.current = isRecordingRequested;

    if (isRecordingRequested && !wasRecordingRequested) {
      void startRecording();
      return;
    }

    if (!isRecordingRequested && wasRecordingRequested) {
      if (isRequestingPermission) {
        cancelRecording();
        return;
      }

      if (isRecording) {
        stopActiveRecorder();
      }
    }
  }, [
    cancelRecording,
    isRecording,
    isRecordingRequested,
    isRequestingPermission,
    startRecording,
    stopActiveRecorder,
  ]);

  useEffect(() => {
    isRecorderMountedRef.current = true;

    return () => {
      isRecorderMountedRef.current = false;
      recordingSessionRef.current += 1;
      previousRecordingRequestRef.current = false;
      clearCancelResetTimer();
      clearRestartTimer();
      clearSendResetTimer();
      stopElapsedTimer();
      stopWaveform(false);
      cleanupMediaResources();
    };
  }, [
    cleanupMediaResources,
    clearCancelResetTimer,
    clearRestartTimer,
    clearSendResetTimer,
    stopElapsedTimer,
    stopWaveform,
  ]);

  return (
    <div
      data-slot="audio-input-recorder-root"
      data-state={status}
      className={cn('grid min-w-0 gap-5', className)}
      {...rootProps}
    >
      <div
        data-slot="audio-input-recorder"
        className={cn(
          'group/audio-input bg-background dark:bg-secondary/30 relative flex min-h-14 w-full min-w-0 items-center gap-3 overflow-hidden px-2.5 py-2 transition-colors',
          recorderClassName,
        )}
      >
        <span
          aria-hidden="true"
          data-slot="audio-input-recorder-icon"
          className={cn(
            'grid size-11 shrink-0 place-items-center rounded-full transition-colors',
            isRecording
              ? 'bg-destructive text-primary-foreground'
              : isRequestingPermission
                ? 'bg-foreground text-background'
                : 'bg-foreground/10 text-foreground',
            errorDetails ? 'bg-destructive/10 text-destructive dark:bg-destructive/20' : null,
          )}
        >
          {isRequestingPermission ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-5 animate-spin motion-reduce:animate-none"
            />
          ) : (
            <Mic
              aria-hidden="true"
              className="size-5"
            />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <AudioInputWaveform
              isActive={isRecording}
              levels={waveformLevels}
            />
            {isRecording ? (
              <span
                aria-hidden="true"
                data-slot="audio-input-live-indicator"
                className="relative flex size-2.5 shrink-0 items-center justify-center"
              >
                <span className="bg-destructive absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:hidden" />
                <span className="bg-destructive relative inline-flex size-2 rounded-full" />
              </span>
            ) : null}
            <p
              aria-live="polite"
              className="min-w-0 truncate text-sm leading-none font-medium"
              role="status"
            >
              {statusLabel}
            </p>
          </div>
          <div className="text-secondary-foreground mt-1 flex min-w-0 items-center gap-2 text-xs">
            <span className="font-mono tabular-nums">{formattedElapsed}</span>
            <span aria-hidden="true">/</span>
            <span className={cn('truncate', isOverLimit ? 'text-destructive' : null)}>
              {sizeMeterLabel}
            </span>
          </div>
        </div>
      </div>

      <form
        aria-busy={isTranscriptionBusy}
        className="grid min-w-0 gap-5"
        data-busy={isTranscriptionBusy ? 'true' : 'false'}
        noValidate
        onSubmit={(event) => void form.handleSubmit(handleTranscriptionSubmit)(event)}
      >
        {isTranscriptionEditorVisible ? (
          <Controller
            control={form.control}
            name="transcription"
            render={({ field, fieldState }) => (
              <>
                <Textarea
                  {...field}
                  data-slot="audio-input-transcription-editor"
                  data-state={transcriptionStatus}
                  aria-describedby={fieldState.invalid ? transcriptionErrorId : undefined}
                  aria-invalid={fieldState.invalid}
                  aria-label={transcriptionTextareaLabel}
                  className={cn('min-h-28 resize-y', transcriptionTextareaClassName)}
                  disabled={disabled || isSendingTranscription}
                  placeholder={transcriptionPlaceholder}
                  value={transcription}
                  onChange={(event) => {
                    setAudioInputTranscription(event.currentTarget.value);
                  }}
                />
                {transcriptionValidationMessage ? (
                  <FieldError
                    id={transcriptionErrorId}
                    role="alert"
                  >
                    {transcriptionValidationMessage}
                  </FieldError>
                ) : null}
              </>
            )}
          />
        ) : null}

        {isErrorVisible && errorDetails ? (
          <div className="grid min-w-0 justify-items-center gap-3 text-center">
            <div
              className="grid min-w-0 justify-items-center gap-1 text-center"
              role="alert"
            >
              <p className="text-destructive text-sm">{errorDetails.feedback.message}</p>
              {errorDetails.feedback.code ? (
                <p className="text-secondary-foreground text-xs">
                  Code: <span className="font-mono">{errorDetails.feedback.code}</span>
                </p>
              ) : null}
            </div>
            {isRetryAvailable ? (
              <Button
                className="whitespace-normal wrap-anywhere pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                data-slot="audio-input-retry-action"
                disabled={disabled || isTranscriptionBusy}
                type="button"
                variant="outline"
                onClick={handleRetryClick}
              >
                {retryLabel}
              </Button>
            ) : canTranscribeLimitedRecording ? (
              <Button
                className="whitespace-normal wrap-anywhere pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                data-slot="audio-input-limit-transcribe-action"
                disabled={disabled || isTranscriptionBusy}
                type="button"
                variant="outline"
                onClick={handleTranscribeLimitedRecordingClick}
              >
                {transcribeLimitRecordingLabel}
              </Button>
            ) : null}
          </div>
        ) : null}

        {isTranscriptionLoadingVisible ? (
          <p
            aria-live="polite"
            className="text-secondary-foreground flex items-center justify-center gap-2 text-center text-sm"
            data-slot="audio-input-transcription-loading"
            role="status"
          >
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
            <span>Submitting...</span>
          </p>
        ) : null}

        {isTranscriptionActionVisible ? (
          <div
            data-slot="audio-input-transcription-actions"
            data-state={transcriptionStatus}
            className={cn(
              'grid min-w-0 gap-2 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center',
              transcriptionActionsClassName,
            )}
          >
            <Button
              className="order-3 min-w-0 sm:order-1 whitespace-normal wrap-anywhere pointer-coarse:min-h-11 pointer-coarse:min-w-11"
              disabled={disabled || isTranscriptionBusy}
              type="button"
              variant="destructive"
              onClick={handleCancelClick}
            >
              {cancelLabel}
            </Button>
            <span
              aria-hidden="true"
              className="hidden sm:order-2 sm:block"
            />
            {!isTranscriptionEditorVisible ? (
              <Button
                className="order-2 min-w-0 sm:order-3 whitespace-normal wrap-anywhere pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                disabled={disabled || !canTranscribe || isTranscriptionBusy || isRetryAvailable}
                type="button"
                variant="ghost"
                onClick={handleTranscribeClick}
              >
                {transcribeLabel}
              </Button>
            ) : null}
            <Button
              className="order-1 min-w-0 sm:order-4 whitespace-normal wrap-anywhere pointer-coarse:min-h-11 pointer-coarse:min-w-11"
              disabled={
                disabled ||
                isTranscriptionBusy ||
                isRetryAvailable ||
                (isTranscriptionEditorVisible ? !canSendTranscription : !canTranscribeAndSend)
              }
              type="submit"
            >
              {activeTranscriptionAction === 'transcribe-and-send' ||
              activeTranscriptionAction === 'send' ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                  data-icon="inline-start"
                />
              ) : (
                <SendHorizontal
                  aria-hidden="true"
                  data-icon="inline-start"
                />
              )}
              {isTranscriptionEditorVisible ? sendTranscriptionLabel : transcribeAndSendLabel}
            </Button>
          </div>
        ) : null}
      </form>
    </div>
  );
};

/**
 * Renders a microphone trigger with a built-in audio dialog.
 * @param props The audio input configuration, lifecycle callbacks, and wrapper props.
 * @returns A React element that renders the audio recording control.
 * @example
 * import { createElement } from 'react';
 * import { AudioInput, type IAudioInputTranscribeHandler, type IAudioInputTranscriptionResultHandler } from 'jg-react-ui/components/audio-input';
 * declare const transcribe: IAudioInputTranscribeHandler;
 * declare const onTranscriptionResult: IAudioInputTranscriptionResultHandler;
 * const example = createElement(AudioInput, { transcribe, onTranscriptionResult });
 */
export const AudioInput = ({
  autoStart = true,
  cancelLabel,
  cancelResetDelayMs = AUDIO_INPUT_DEFAULT_CANCEL_RESET_DELAY_MS,
  className,
  closeButtonAriaLabel = AUDIO_INPUT_DEFAULT_CLOSE_BUTTON_ARIA_LABEL,
  controlsRef,
  defaultIsDialogOpen = false,
  defaultIsRecording,
  defaultIsTranscriptionEditorVisible,
  defaultTranscription,
  dialogDescription,
  dialogTitle = AUDIO_INPUT_DEFAULT_DIALOG_TITLE,
  disabled = false,
  isDialogOpen: controlledIsDialogOpen,
  isErrorVisible,
  isRecording,
  isTranscriptionEditorVisible,
  maxBytes,
  onCancel,
  onDialogOpenChange,
  onElapsedMsChange,
  onLimitProgressChange,
  onRecordedBytesChange,
  onRecordingActiveChange,
  onRecordingCancel,
  onRecordingComplete,
  onRecordingDataAvailable,
  onRecordingError,
  onRecordingStart,
  onRecordingStop,
  onStatusChange,
  onTranscriptionComplete,
  onTranscriptionEditorVisibleChange,
  onTranscriptionError,
  onTranscriptionResult,
  onTranscriptionStatusChange,
  onTranscriptionTextChange,
  preferredMimeType,
  recorderClassName,
  recorderRootClassName,
  restartButtonAriaLabel = AUDIO_INPUT_DEFAULT_RESTART_BUTTON_ARIA_LABEL,
  restartButtonClassName,
  retryLabel,
  sendTranscriptionLabel,
  statusLabels,
  transcribe,
  transcribeAndSendLabel,
  transcribeLabel,
  transcribeLimitRecordingLabel,
  transcription,
  transcriptionActionsClassName,
  transcriptionPlaceholder,
  transcriptionTextareaClassName,
  transcriptionTextareaLabel,
  triggerAriaLabel = AUDIO_INPUT_DEFAULT_TRIGGER_ARIA_LABEL,
  triggerButtonProps,
  triggerClassName,
  triggerSize = 'icon',
  triggerTitle,
  triggerVariant = 'ghost',
  ...rootProps
}: IAudioInputProps): ReactElement => {
  const isDialogOpenControlled = controlledIsDialogOpen !== undefined;
  const [uncontrolledIsDialogOpen, setUncontrolledIsDialogOpen] = useState(
    () => defaultIsDialogOpen,
  );
  const [dialogTranscriptionStatus, setDialogTranscriptionStatus] =
    useState<IAudioInputTranscriptionStatus>('idle');
  const recorderControlsRef = useRef<IAudioInputControls | null>(null);
  const shouldSkipDialogCloseCancelRef = useRef(false);
  const isDialogOpen = controlledIsDialogOpen ?? uncontrolledIsDialogOpen;
  const dialogSessionRef = useRef(0);
  const delayedCommandRef = useRef<number | null>(null);
  const pendingCommandRef = useRef<'startRecording' | 'restartRecording' | null>(null);

  /** Releases a deferred start before its owner changes or unmounts. */
  const clearDelayedCommand = useCallback((): void => {
    pendingCommandRef.current = null;
    if (delayedCommandRef.current === null) return;
    window.clearTimeout(delayedCommandRef.current);
    delayedCommandRef.current = null;
  }, []);

  useLayoutEffect(() => {
    dialogSessionRef.current += 1;
    if (!isDialogOpen) clearDelayedCommand();
  }, [clearDelayedCommand, isDialogOpen]);

  useLayoutEffect(
    () => () => {
      dialogSessionRef.current += 1;
      clearDelayedCommand();
    },
    [clearDelayedCommand],
  );

  /** Defers external starts until the recorder mounts and owns the timeout until it runs. */
  const scheduleRecorderCommand = useCallback(
    (command: 'startRecording' | 'restartRecording'): void => {
      clearDelayedCommand();
      pendingCommandRef.current = command;
      if (recorderControlsRef.current === null) return;
      delayedCommandRef.current = window.setTimeout(() => {
        delayedCommandRef.current = null;
        pendingCommandRef.current = null;
        recorderControlsRef.current?.[command]();
      }, 0);
    },
    [clearDelayedCommand],
  );

  /** Runs a queued external command only after the portalled recorder actually mounts. */
  const attachRecorderControls = useCallback(
    (controls: IAudioInputControls | null): void => {
      recorderControlsRef.current = controls;
      const command = pendingCommandRef.current;
      if (controls !== null && command !== null) scheduleRecorderCommand(command);
    },
    [scheduleRecorderCommand],
  );
  const resolvedTriggerTitle = triggerTitle ?? triggerAriaLabel;
  const isDialogTranscribing = dialogTranscriptionStatus === 'transcribing';

  /**
   * Updates the controllable dialog open state.
   * @param nextIsDialogOpen Whether the audio dialog should be open.
   */
  const setAudioInputDialogOpen = useCallback(
    (nextIsDialogOpen: boolean): void => {
      dialogSessionRef.current += 1;
      clearDelayedCommand();
      if (!isDialogOpenControlled) {
        setUncontrolledIsDialogOpen(nextIsDialogOpen);
      }

      onDialogOpenChange?.(nextIsDialogOpen);
    },
    [clearDelayedCommand, isDialogOpenControlled, onDialogOpenChange],
  );

  /**
   * Cancels recorder work when the dialog closes from the built-in close control.
   */
  const cancelRecorderForDialogClose = useCallback((): void => {
    recorderControlsRef.current?.cancelRecording();
  }, []);

  /**
   * Handles dialog open state changes.
   * @param nextIsDialogOpen Whether the dialog is opening or closing.
   */
  const handleDialogOpenChange = useCallback(
    (nextIsDialogOpen: boolean): void => {
      if (nextIsDialogOpen || !isDialogTranscribing) {
        if (!nextIsDialogOpen && !shouldSkipDialogCloseCancelRef.current)
          cancelRecorderForDialogClose();
        shouldSkipDialogCloseCancelRef.current = false;
        setAudioInputDialogOpen(nextIsDialogOpen);
      }
    },
    [cancelRecorderForDialogClose, isDialogTranscribing, setAudioInputDialogOpen],
  );

  /**
   * Closes the built-in dialog after the recorder cancel action runs.
   */
  const handleRecorderCancel = useCallback((): void => {
    shouldSkipDialogCloseCancelRef.current = true;
    onCancel?.();
    setAudioInputDialogOpen(false);
  }, [onCancel, setAudioInputDialogOpen]);

  /**
   * Sends transcription results to the parent and closes the built-in dialog.
   * @param nextTranscription The accepted transcription text.
   * @param recording The recording that produced the transcription.
   * @returns A promise that resolves after parent result handling completes.
   */
  const handleTranscriptionResult = useCallback(
    async (nextTranscription: string, recording: IAudioInputRecording): Promise<void> => {
      const session = dialogSessionRef.current;
      await onTranscriptionResult?.(nextTranscription, recording);
      if (dialogSessionRef.current !== session) return;
      shouldSkipDialogCloseCancelRef.current = true;
      setAudioInputDialogOpen(false);
    },
    [onTranscriptionResult, setAudioInputDialogOpen],
  );

  /**
   * Tracks async transcription status for built-in dialog controls and forwards it to consumers.
   * @param nextStatus The next transcription lifecycle status.
   */
  const handleTranscriptionStatusChange = useCallback(
    (nextStatus: IAudioInputTranscriptionStatus): void => {
      setDialogTranscriptionStatus(nextStatus);
      onTranscriptionStatusChange?.(nextStatus);
    },
    [onTranscriptionStatusChange],
  );

  useImperativeHandle(
    controlsRef,
    (): IAudioInputControls => ({
      cancelRecording: () => {
        shouldSkipDialogCloseCancelRef.current = true;
        recorderControlsRef.current?.cancelRecording();
        setAudioInputDialogOpen(false);
      },
      resetRecording: () => {
        dialogSessionRef.current += 1;
        clearDelayedCommand();
        recorderControlsRef.current?.resetRecording();
      },
      restartRecording: () => {
        setAudioInputDialogOpen(true);

        if (isDialogOpen) {
          recorderControlsRef.current?.restartRecording();
          return;
        }

        if (!autoStart) {
          scheduleRecorderCommand('restartRecording');
        }
      },
      startRecording: () => {
        setAudioInputDialogOpen(true);

        if (isDialogOpen) {
          recorderControlsRef.current?.startRecording();
          return;
        }

        if (!autoStart) {
          scheduleRecorderCommand('startRecording');
        }
      },
      stopRecording: () => {
        recorderControlsRef.current?.stopRecording();
      },
    }),
    [
      autoStart,
      clearDelayedCommand,
      isDialogOpen,
      scheduleRecorderCommand,
      setAudioInputDialogOpen,
    ],
  );

  /**
   * Starts a fresh recorder session from the built-in dialog utility action.
   */
  const handleRestartRecordingClick = useCallback((): void => {
    recorderControlsRef.current?.restartRecording();
  }, []);

  useEffect(() => {
    if (!isDialogOpen) {
      if (shouldSkipDialogCloseCancelRef.current) {
        shouldSkipDialogCloseCancelRef.current = false;
      } else {
        cancelRecorderForDialogClose();
      }
    }
  }, [cancelRecorderForDialogClose, isDialogOpen]);

  return (
    <div
      data-slot="audio-input"
      data-state={isDialogOpen ? 'open' : 'closed'}
      className={cn('inline-grid min-w-0', className)}
      {...rootProps}
    >
      <Dialog
        isDismissalDisabled={disabled || isDialogTranscribing}
        open={isDialogOpen}
        onOpenChange={handleDialogOpenChange}
      >
        <DialogTrigger asChild>
          <Button
            {...triggerButtonProps}
            aria-label={triggerAriaLabel}
            className={cn(
              'whitespace-normal wrap-anywhere pointer-coarse:min-h-11 pointer-coarse:min-w-11',
              triggerClassName,
            )}
            disabled={disabled}
            size={triggerSize}
            title={resolvedTriggerTitle}
            type="button"
            variant={triggerVariant}
          >
            <Mic aria-hidden="true" />
          </Button>
        </DialogTrigger>

        <DialogContent
          closeButtonAriaLabel={closeButtonAriaLabel}
          size="small"
        >
          <DialogHeader
            layout="split"
            actions={
              <Button
                aria-label={restartButtonAriaLabel}
                className={cn(
                  'whitespace-normal wrap-anywhere pointer-coarse:min-h-11 pointer-coarse:min-w-11',
                  restartButtonClassName,
                )}
                disabled={disabled || isDialogTranscribing}
                size="icon-touch"
                title={restartButtonAriaLabel}
                type="button"
                variant="ghost"
                onClick={handleRestartRecordingClick}
              >
                <RefreshCcw aria-hidden="true" />
              </Button>
            }
          >
            <DialogTitle>{dialogTitle}</DialogTitle>
            {dialogDescription ? <DialogDescription>{dialogDescription}</DialogDescription> : null}
          </DialogHeader>
          <DialogBody
            padding="none"
            className="grid gap-4 px-4 pt-2 pb-4 sm:px-5 sm:pt-3 sm:pb-5"
          >
            <AudioInputRecorder
              autoStart={autoStart}
              cancelLabel={cancelLabel}
              cancelResetDelayMs={cancelResetDelayMs}
              className={recorderRootClassName}
              controlsRef={attachRecorderControls}
              defaultIsRecording={defaultIsRecording}
              defaultIsTranscriptionEditorVisible={defaultIsTranscriptionEditorVisible}
              defaultTranscription={defaultTranscription}
              disabled={disabled}
              isErrorVisible={isErrorVisible}
              isRecording={isRecording}
              isTranscriptionEditorVisible={isTranscriptionEditorVisible}
              maxBytes={maxBytes}
              preferredMimeType={preferredMimeType}
              recorderClassName={cn('bg-transparent dark:bg-transparent', recorderClassName)}
              retryLabel={retryLabel}
              sendTranscriptionLabel={sendTranscriptionLabel}
              statusLabels={statusLabels}
              transcribe={transcribe}
              transcribeAndSendLabel={transcribeAndSendLabel}
              transcribeLabel={transcribeLabel}
              transcribeLimitRecordingLabel={transcribeLimitRecordingLabel}
              transcription={transcription}
              transcriptionActionsClassName={transcriptionActionsClassName}
              transcriptionPlaceholder={transcriptionPlaceholder}
              transcriptionTextareaClassName={transcriptionTextareaClassName}
              transcriptionTextareaLabel={transcriptionTextareaLabel}
              onCancel={handleRecorderCancel}
              onElapsedMsChange={onElapsedMsChange}
              onLimitProgressChange={onLimitProgressChange}
              onRecordedBytesChange={onRecordedBytesChange}
              onRecordingActiveChange={onRecordingActiveChange}
              onRecordingCancel={onRecordingCancel}
              onRecordingComplete={onRecordingComplete}
              onRecordingDataAvailable={onRecordingDataAvailable}
              onRecordingError={onRecordingError}
              onRecordingStart={onRecordingStart}
              onRecordingStop={onRecordingStop}
              onStatusChange={onStatusChange}
              onTranscriptionComplete={onTranscriptionComplete}
              onTranscriptionEditorVisibleChange={onTranscriptionEditorVisibleChange}
              onTranscriptionError={onTranscriptionError}
              onTranscriptionResult={handleTranscriptionResult}
              onTranscriptionStatusChange={handleTranscriptionStatusChange}
              onTranscriptionTextChange={onTranscriptionTextChange}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
};
