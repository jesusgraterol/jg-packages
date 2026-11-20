import type { ReactElement } from 'react';

import { Badge } from '../badge/index.js';
import { Button } from '../button/index.js';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../dialog/index.js';

import type { IAudioInputStatus } from './types.js';

// the toolbar owns presentation only; the recorder retains byte admission and lifecycle.
type IAudioInputToolbarMeterProps = {
  elapsed: string;
  maxBytes: number;
  ownerId: string;
  progress: number;
  status: IAudioInputStatus;
  statusLabel: string;
  waveform: ReactElement;
};

/**
 * Renders compact recording feedback with actionable capacity details only near the cap.
 * @returns The toolbar meter and its optional capacity dialog.
 */
export const AudioInputToolbarMeter = ({
  elapsed,
  maxBytes,
  ownerId,
  progress,
  status,
  statusLabel,
  waveform,
}: IAudioInputToolbarMeterProps): ReactElement => {
  // reserve the last tenth of capacity for a warning before the existing hard stop.
  const isNearlyFull = status === 'recording' && progress >= 0.9;
  const warningLabel = progress >= 1 ? 'Recording full' : 'Recording nearly full';

  return (
    <div
      data-slot="audio-input-toolbar-meter"
      data-status={status}
      data-warning={isNearlyFull || undefined}
    >
      <span
        aria-hidden="true"
        data-slot="audio-input-live-indicator"
        className="relative flex size-2.5 shrink-0 items-center justify-center"
      >
        {status === 'recording' ? (
          <>
            <span className="bg-destructive absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:hidden" />
            <span className="bg-destructive relative inline-flex size-2 rounded-full" />
          </>
        ) : null}
      </span>
      <span data-slot="audio-input-toolbar-waveform">{waveform}</span>
      <span
        data-slot="audio-input-elapsed"
        className="text-secondary-foreground font-mono text-xs tabular-nums"
      >
        {elapsed}
      </span>
      <p
        data-slot="audio-input-recording-status"
        className="min-w-0 truncate text-sm leading-none font-medium"
        role="status"
        aria-live="polite"
      >
        {isNearlyFull ? warningLabel : statusLabel}
      </p>
      {isNearlyFull ? (
        <Dialog>
          <DialogTrigger asChild>
            <Button
              data-slot="audio-input-limit-warning"
              aria-label={warningLabel}
              size="toolbar"
              variant="ghost"
              type="button"
              className="text-[color:color-mix(in_oklab,var(--chart-2)_45%,var(--foreground))] dark:text-chart-2"
            >
              <span data-slot="audio-input-warning-label">
                {progress >= 1 ? 'Full' : 'Nearly full'}
              </span>
              <Badge
                data-slot="audio-input-warning-timer"
                variant="warning"
                className="gap-0.5 px-0.5 font-mono tabular-nums"
              >
                {elapsed}
                <span aria-hidden="true">!</span>
              </Badge>
            </Button>
          </DialogTrigger>
          <DialogContent
            data-audio-input-owner={ownerId}
            initialFocus="dismiss-control"
            size="small"
          >
            <DialogHeader>
              <DialogTitle>{warningLabel}</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <p>
                {Math.round(progress * 100)}% of the recording capacity used. Transcribe or send
                {progress >= 1 ? ' this recording now.' : ' this recording before it fills up.'}
              </p>
              <p className="text-secondary-foreground mt-3 text-sm">
                Audio limit: {maxBytes.toLocaleString()} bytes.
              </p>
            </DialogBody>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
};
