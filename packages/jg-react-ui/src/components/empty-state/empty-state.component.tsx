import type * as React from 'react';
import { cn } from 'cnfast';

import { useSlottedRender } from '../../shared/slotted-render/index.js';
import type {
  IEmptyStateDescriptionProps,
  IEmptyStateProps,
  IEmptyStateTitleProps,
} from './types.js';

/**
 * Renders a centered dashed container for an absent or filtered result.
 * @param props The container attributes, content, classes, and optional slotted child.
 * @returns A React element that renders the empty-state container.
 * @example
 * import { createElement } from 'react';
 * import { EmptyState } from 'jg-react-ui/components/empty-state';
 * const example = createElement(EmptyState, { children: 'No records found' });
 * @throws
 * - asChild requires exactly one valid React element child.
 */
export const EmptyState = ({
  asChild = false,
  className,
  ...props
}: IEmptyStateProps): React.ReactElement =>
  useSlottedRender<'div', HTMLDivElement>({
    asChild,
    defaultTagName: 'div',
    baseProps: {
      'data-slot': 'empty-state',
      className: cn(
        'border-border grid content-center justify-items-center gap-3 rounded-lg border border-dashed p-6 text-center',
        className,
      ),
    } as React.ComponentPropsWithRef<'div'>,
    elementProps: props,
  });

/**
 * Renders the primary empty-state message.
 * @param props The title attributes, content, classes, and optional slotted child.
 * @returns A React element that renders the empty-state title.
 * @example
 * import { createElement } from 'react';
 * import { EmptyStateTitle } from 'jg-react-ui/components/empty-state';
 * const example = createElement(EmptyStateTitle, { children: 'No records found' });
 * @throws
 * - asChild requires exactly one valid React element child.
 */
export const EmptyStateTitle = ({
  asChild = false,
  className,
  ...props
}: IEmptyStateTitleProps): React.ReactElement =>
  useSlottedRender<'p', HTMLParagraphElement>({
    asChild,
    defaultTagName: 'p',
    baseProps: {
      'data-slot': 'empty-state-title',
      className: cn('font-medium', className),
    } as React.ComponentPropsWithRef<'p'>,
    elementProps: props,
  });

/**
 * Renders supporting empty-state guidance.
 * @param props The description attributes, content, classes, and optional slotted child.
 * @returns A React element that renders the empty-state description.
 * @example
 * import { createElement } from 'react';
 * import { EmptyStateDescription } from 'jg-react-ui/components/empty-state';
 * const example = createElement(EmptyStateDescription, { children: 'Upload a file to get started.' });
 * @throws
 * - asChild requires exactly one valid React element child.
 */
export const EmptyStateDescription = ({
  asChild = false,
  className,
  ...props
}: IEmptyStateDescriptionProps): React.ReactElement =>
  useSlottedRender<'p', HTMLParagraphElement>({
    asChild,
    defaultTagName: 'p',
    baseProps: {
      'data-slot': 'empty-state-description',
      className: cn('text-secondary-foreground max-w-md text-sm', className),
    } as React.ComponentPropsWithRef<'p'>,
    elementProps: props,
  });
