import type * as React from 'react';
import { cn } from 'cnfast';

import { useSlottedRender } from '../../shared/slotted-render/index.js';
import { alertVariants } from './constants.js';
import type {
  IAlertActionProps,
  IAlertDescriptionProps,
  IAlertProps,
  IAlertTitleProps,
} from './types.js';

/**
 * Renders an inline alert with shadcn-style composition and optional interactive behavior.
 * @param props The alert element props, interaction mode, and optional slot rendering flag.
 * @returns A React element that renders the alert container with role="alert" by default for static alerts.
 * @example
 * import { createElement } from 'react';
 * import { Alert } from 'jg-react-ui/components/alert';
 * const example = createElement(Alert, null, 'Example');
 * @throws
 * - asChild requires exactly one valid React element child.
 */
export const Alert = ({
  className,
  variant = 'default',
  interaction = 'static',
  role,
  asChild = false,
  ...props
}: IAlertProps): React.ReactElement => {
  const resolvedRole = role ?? (interaction === 'static' ? 'alert' : undefined);

  return useSlottedRender<'div', HTMLDivElement>({
    asChild,
    defaultTagName: 'div',
    baseProps: {
      'data-slot': 'alert',
      'data-variant': variant,
      'data-interaction': interaction,
      role: resolvedRole,
      className: cn(alertVariants({ variant, interaction, className })),
    } as React.ComponentPropsWithRef<'div'>,
    elementProps: props,
  });
};

/**
 * Renders the main title content for an alert.
 * @param props The title element props.
 * @returns A React element that renders the alert title.
 * @example
 * import { createElement } from 'react';
 * import { AlertTitle } from 'jg-react-ui/components/alert';
 * const example = createElement(AlertTitle, null, 'Example');
 */
export const AlertTitle = ({ className, ...props }: IAlertTitleProps): React.ReactElement => (
  <span
    data-slot="alert-title"
    className={cn('block text-sm leading-none font-medium tracking-normal', className)}
    {...props}
  />
);

/**
 * Renders supporting copy for an alert.
 * @param props The description element props.
 * @returns A React element that renders the alert description.
 * @example
 * import { createElement } from 'react';
 * import { AlertDescription } from 'jg-react-ui/components/alert';
 * const example = createElement(AlertDescription, null, 'Example');
 */
export const AlertDescription = ({
  className,
  ...props
}: IAlertDescriptionProps): React.ReactElement => (
  <span
    data-slot="alert-description"
    className={cn('text-secondary-foreground mt-1 block text-sm [&_p]:leading-relaxed', className)}
    {...props}
  />
);

/**
 * Renders an optional action slot in the top-right corner of an alert.
 * @param props The action wrapper props.
 * @returns A React element that renders the alert action container.
 * @example
 * import { createElement } from 'react';
 * import { AlertAction } from 'jg-react-ui/components/alert';
 * const example = createElement(AlertAction, null, 'Example');
 */
export const AlertAction = ({ className, ...props }: IAlertActionProps): React.ReactElement => (
  <div
    data-slot="alert-action"
    className={cn('absolute top-3 right-3 flex items-center', className)}
    {...props}
  />
);
