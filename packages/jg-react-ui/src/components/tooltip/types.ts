import type { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';

/** Native attributes and shared options for TooltipProvider.
 * @see TooltipProvider
 */
export type ITooltipProviderProps = Omit<BaseTooltip.Provider.Props, 'delay' | 'timeout'> & {
  delay?: BaseTooltip.Provider.Props['delay'];
  delayDuration?: BaseTooltip.Provider.Props['delay'];
  disableHoverableContent?: boolean;
  skipDelayDuration?: BaseTooltip.Provider.Props['timeout'];
  timeout?: BaseTooltip.Provider.Props['timeout'];
};

/** Native attributes and shared options for Tooltip.
 * @see Tooltip
 */
export type ITooltipProps = Omit<BaseTooltip.Root.Props, 'disableHoverablePopup'> & {
  delayDuration?: BaseTooltip.Trigger.Props['delay'];
  disableHoverableContent?: boolean;
  disableHoverablePopup?: BaseTooltip.Root.Props['disableHoverablePopup'];
};

/** Native attributes and shared options for TooltipTrigger.
 * @see TooltipTrigger
 */
export type ITooltipTriggerProps = Omit<BaseTooltip.Trigger.Props, 'render'> & {
  asChild?: boolean;
};

/** Native attributes and shared options for TooltipContent.
 * @see TooltipContent
 */
export type ITooltipContentProps = Omit<BaseTooltip.Popup.Props, 'render'> &
  Pick<
    BaseTooltip.Positioner.Props,
    | 'align'
    | 'alignOffset'
    | 'arrowPadding'
    | 'collisionAvoidance'
    | 'collisionBoundary'
    | 'collisionPadding'
    | 'side'
    | 'sideOffset'
  > & {
    asChild?: boolean;
    avoidCollisions?: boolean;
    forceMount?: BaseTooltip.Portal.Props['keepMounted'];
    hideWhenDetached?: boolean;
    sticky?: 'partial' | 'always';
  };
