import { createContext, isValidElement, useContext } from 'react';
import type * as React from 'react';
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import { cn } from 'cnfast';

import type {
  ITooltipContentProps,
  ITooltipProps,
  ITooltipProviderProps,
  ITooltipTriggerProps,
} from './types.js';

const TooltipDelayContext = createContext<ITooltipProps['delayDuration']>(undefined);
const TooltipDisableHoverableContentContext = createContext<boolean | undefined>(undefined);

const COLLISION_AVOIDANCE_DISABLED = {
  side: 'none',
  align: 'none',
  fallbackAxisSide: 'none',
} as const;

/**
 * Provides shared tooltip timing defaults for a subtree.
 * @param props The Base UI tooltip provider props and public timing options.
 * @returns A React element that renders the tooltip provider.
 * @example
 * import { createElement } from 'react';
 * import { TooltipProvider } from 'jg-react-ui/components/tooltip';
 * const example = createElement(TooltipProvider, { children: 'Project settings' });
 */
export const TooltipProvider = ({
  delay,
  delayDuration = 0,
  disableHoverableContent,
  skipDelayDuration,
  timeout,
  ...props
}: ITooltipProviderProps): React.ReactElement => (
  <TooltipDisableHoverableContentContext value={disableHoverableContent}>
    <BaseTooltip.Provider
      data-slot="tooltip-provider"
      delay={delay ?? delayDuration}
      timeout={timeout ?? skipDelayDuration ?? 300}
      {...props}
    />
  </TooltipDisableHoverableContentContext>
);

/**
 * Provides tooltip state for a trigger and content pair.
 * @param props The Base UI tooltip root props and public timing options.
 * @returns A React element that renders the tooltip root.
 * @example
 * import { createElement } from 'react';
 * import { Tooltip } from 'jg-react-ui/components/tooltip';
 * const example = createElement(Tooltip, { children: 'Project settings' });
 */
export const Tooltip = ({
  delayDuration,
  disableHoverableContent,
  disableHoverablePopup,
  ...props
}: ITooltipProps): React.ReactElement => {
  const providerDisableHoverableContent = useContext(TooltipDisableHoverableContentContext);

  return (
    <TooltipDelayContext value={delayDuration}>
      <BaseTooltip.Root
        data-slot="tooltip"
        disableHoverablePopup={
          disableHoverablePopup ?? disableHoverableContent ?? providerDisableHoverableContent
        }
        {...props}
      />
    </TooltipDelayContext>
  );
};

/**
 * Renders the focusable or hoverable element that opens tooltip content.
 * @param props The Base UI tooltip trigger props and optional slot rendering flag.
 * @returns A React element that renders the tooltip trigger.
 * @example
 * import { createElement } from 'react';
 * import { TooltipTrigger } from 'jg-react-ui/components/tooltip';
 * const example = createElement(TooltipTrigger, { children: 'Project settings' });
 * @throws
 * - TooltipTrigger asChild requires exactly one valid React element child.
 */
export const TooltipTrigger = ({
  asChild = false,
  children,
  delay,
  ...props
}: ITooltipTriggerProps): React.ReactElement => {
  const rootDelay = useContext(TooltipDelayContext);

  return (
    <BaseTooltip.Trigger
      data-slot="tooltip-trigger"
      delay={delay ?? rootDelay}
      render={asChild ? resolveTooltipRender(children, 'TooltipTrigger') : undefined}
      {...props}
    >
      {asChild ? undefined : children}
    </BaseTooltip.Trigger>
  );
};

/**
 * Renders themed tooltip content inside a portal.
 * @param props The Base UI tooltip popup props and public positioning options.
 * @returns A React element that renders the tooltip bubble.
 * @example
 * import { createElement } from 'react';
 * import { TooltipContent } from 'jg-react-ui/components/tooltip';
 * const example = createElement(TooltipContent, { children: 'Project settings' });
 * @throws
 * - TooltipContent asChild requires exactly one valid React element child.
 */
export const TooltipContent = ({
  align = 'center',
  alignOffset = 0,
  arrowPadding,
  asChild = false,
  avoidCollisions,
  children,
  className,
  collisionAvoidance,
  collisionBoundary,
  collisionPadding,
  forceMount,
  hideWhenDetached = false,
  side = 'top',
  sideOffset = 8,
  sticky,
  ...props
}: ITooltipContentProps): React.ReactElement => {
  // sticky remains accepted by the public API but has no matching tooltip prop.
  void sticky;

  return (
    <BaseTooltip.Portal keepMounted={forceMount}>
      <BaseTooltip.Positioner
        align={align}
        alignOffset={alignOffset}
        arrowPadding={arrowPadding}
        collisionAvoidance={
          collisionAvoidance ??
          (avoidCollisions === false ? COLLISION_AVOIDANCE_DISABLED : undefined)
        }
        collisionBoundary={collisionBoundary}
        collisionPadding={collisionPadding}
        side={side}
        sideOffset={sideOffset}
        className={cn('isolate z-50', hideWhenDetached ? 'data-[anchor-hidden]:invisible' : null)}
      >
        <BaseTooltip.Popup
          data-slot="tooltip-content"
          render={asChild ? resolveTooltipRender(children, 'TooltipContent') : undefined}
          className={cn(
            'bg-foreground text-background shadow-raised data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 dark:border-border dark:bg-background dark:text-foreground z-50 max-w-64 origin-(--transform-origin) overflow-hidden rounded-md border border-transparent px-3 py-1.5 text-sm motion-reduce:animate-none motion-reduce:data-closed:animate-none motion-reduce:data-open:animate-none',
            className,
          )}
          {...props}
        >
          {asChild ? undefined : children}
        </BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  );
};

/**
 * Resolves the render element used by Base UI for tooltip asChild rendering.
 * @param children The children provided by the consumer.
 * @param componentName The public component name used in the error message.
 * @returns A valid React element for Base UI's render prop.
 */
const resolveTooltipRender = (
  children: React.ReactNode,
  componentName: 'TooltipContent' | 'TooltipTrigger',
): React.ReactElement => {
  if (!isValidElement(children)) {
    throw new Error(`${componentName} asChild requires exactly one valid React element child.`);
  }

  return children;
};
