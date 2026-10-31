import type * as React from 'react';
import { Progress as BaseProgress } from '@base-ui/react/progress';
import { cn } from 'cnfast';

import type { IProgressProps } from './types.js';
import { normalizeProgressMax, normalizeProgressValue } from './utilities.js';

/**
 * Renders a themed Base UI progress bar in determinate or indeterminate mode.
 * @param props The progress props for the desired mode.
 * @returns A React element that renders the track and animated indicator.
 * @example
 * import { createElement } from 'react';
 * import { Progress } from 'jg-react-ui/components/progress';
 * const example = createElement(Progress, { value: 32, 'aria-label': 'Upload progress' });
 */
export const Progress = ({
  className,
  indicatorClassName,
  indeterminate,
  max,
  value,
  ...props
}: IProgressProps): React.ReactElement => {
  const normalizedMax = normalizeProgressMax(max);
  const progressValue = indeterminate ? null : normalizeProgressValue(value, normalizedMax);

  return (
    <BaseProgress.Root
      data-slot="progress"
      className={cn(
        'bg-border dark:bg-secondary relative flex h-1 w-full items-center overflow-x-hidden rounded-full',
        className,
      )}
      max={normalizedMax}
      value={progressValue}
      {...props}
    >
      <BaseProgress.Indicator
        data-slot="progress-indicator"
        className={cn(
          'bg-primary dark:bg-primary-foreground data-indeterminate:animate-progress h-full transition-[width] duration-300 ease-out data-indeterminate:w-full data-indeterminate:origin-left data-indeterminate:will-change-transform motion-reduce:animate-none motion-reduce:transition-none motion-reduce:data-indeterminate:w-1/3',
          indicatorClassName,
        )}
      />
    </BaseProgress.Root>
  );
};
