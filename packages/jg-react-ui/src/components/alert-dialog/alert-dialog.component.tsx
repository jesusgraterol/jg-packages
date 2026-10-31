import { Children, isValidElement, useCallback, useReducer } from 'react';
import type * as React from 'react';
import { AlertDialog as BaseAlertDialog } from '@base-ui/react/alert-dialog';
import { XIcon } from 'lucide-react';
import { cn } from 'cnfast';

import { useDialogNavigationRoot } from '../../shared/dialog-navigation-root/index.js';
import {
  COMPACT_MODAL_CLOSE_BUTTON_CLASS_NAME,
  MODAL_BACKDROP_KEYFRAME_MOTION_CLASS_NAME,
  MODAL_BACKDROP_SURFACE_CLASS_NAME,
} from '../../shared/modal-surface/index.js';
import { isNativeButtonRender } from '../../shared/native-button-render/index.js';
import { createRetainedModalChildren } from '../../shared/retained-modal-children/index.js';
import { Button, buttonVariants } from '../button/index.js';
import { ALERT_DIALOG_CONTENT_CLASS_NAME } from './constants.js';
import type {
  IAlertDialogActionProps,
  IAlertDialogContentProps,
  IAlertDialogDescriptionProps,
  IAlertDialogFooterProps,
  IAlertDialogHeaderProps,
  IAlertDialogOverlayProps,
  IAlertDialogProps,
  IAlertDialogTitleProps,
  IAlertDialogTriggerProps,
} from './types.js';

const ALERT_DIALOG_CLOSE_BUTTON_CLASS_NAME = cn(
  buttonVariants({ size: 'icon-sm', variant: 'ghost' }),
  COMPACT_MODAL_CLOSE_BUTTON_CLASS_NAME,
);

/**
 * Provides the alert dialog root state and accessibility context.
 * @param props The Base UI alert dialog root props.
 * @returns A React element that renders the alert dialog root.
 * @example
 * import { createElement as h } from 'react';
 * import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from 'jg-react-ui/components/alert-dialog';
 * const example = h(AlertDialog, null, h(AlertDialogTrigger, null, 'Review change'),
 *   h(AlertDialogContent, null,
 *     h(AlertDialogHeader, null, h(AlertDialogTitle, null, 'Apply change?'), h(AlertDialogDescription, null, 'Review before continuing.')),
 *     h(AlertDialogFooter, null, h(AlertDialogAction, null, 'Apply change'))));
 */
export const AlertDialog = ({
  children,
  actionsRef: providedActionsRef,
  getNavigationSession,
  onOpenChange,
  onOpenChangeComplete,
  open,
  ...props
}: IAlertDialogProps): React.ReactElement => {
  const { actionsRef, recordOpenChange } = useDialogNavigationRoot({
    actionsRef: providedActionsRef,
    defaultOpen: props.defaultOpen,
    getNavigationSession,
    handle: props.handle,
    open,
  });
  const [closeCompletionKey, markCloseComplete] = useReducer(
    (currentCloseCompletionKey: number): number => currentCloseCompletionKey + 1,
    0,
  );
  const handleOpenChange = useCallback<NonNullable<BaseAlertDialog.Root.Props['onOpenChange']>>(
    (open) => {
      recordOpenChange(open);
      onOpenChange?.(open);
    },
    [onOpenChange, recordOpenChange],
  );
  const handleOpenChangeComplete = useCallback<
    NonNullable<BaseAlertDialog.Root.Props['onOpenChangeComplete']>
  >(
    (isOpen) => {
      if (!isOpen) {
        markCloseComplete();
      }

      onOpenChangeComplete?.(isOpen);
    },
    [onOpenChangeComplete],
  );

  return (
    <BaseAlertDialog.Root
      {...props}
      actionsRef={actionsRef}
      data-slot="alert-dialog"
      open={open}
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={handleOpenChangeComplete}
    >
      {createRetainedModalChildren(children, open, closeCompletionKey)}
    </BaseAlertDialog.Root>
  );
};

/**
 * Renders the interactive element that opens the alert dialog.
 * @param props The Base UI alert dialog trigger props and optional slot rendering flag.
 * @returns A React element that renders the alert dialog trigger.
 * @throws
 * - AlertDialogTrigger asChild requires exactly one valid React element child.
 * @example
 * import { createElement as h } from 'react';
 * import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from 'jg-react-ui/components/alert-dialog';
 * const example = h(AlertDialog, null, h(AlertDialogTrigger, null, 'Review change'),
 *   h(AlertDialogContent, null,
 *     h(AlertDialogHeader, null, h(AlertDialogTitle, null, 'Apply change?'), h(AlertDialogDescription, null, 'Review before continuing.')),
 *     h(AlertDialogFooter, null, h(AlertDialogAction, null, 'Apply change'))));
 */
export const AlertDialogTrigger = ({
  asChild = false,
  children,
  ...props
}: IAlertDialogTriggerProps): React.ReactElement => (
  <BaseAlertDialog.Trigger
    data-slot="alert-dialog-trigger"
    nativeButton={!asChild || isNativeButtonRender(children)}
    render={asChild ? resolveAlertDialogRender(children, 'AlertDialogTrigger') : undefined}
    {...props}
  >
    {asChild ? undefined : children}
  </BaseAlertDialog.Trigger>
);

/**
 * Renders the modal backdrop behind alert dialog content.
 * @param props The Base UI alert dialog backdrop props.
 * @returns A React element that renders the alert dialog overlay.
 */
const AlertDialogOverlay = ({
  className,
  ...props
}: IAlertDialogOverlayProps): React.ReactElement => (
  <BaseAlertDialog.Backdrop
    forceRender
    data-slot="alert-dialog-overlay"
    className={cn(
      MODAL_BACKDROP_SURFACE_CLASS_NAME,
      MODAL_BACKDROP_KEYFRAME_MOTION_CLASS_NAME,
      'z-[60]',
      className,
    )}
    {...props}
  />
);

/**
 * Renders the themed alert dialog content inside a portal.
 * @param props The Base UI alert dialog popup props.
 * @returns A React element that renders the alert dialog panel.
 * @throws
 * - AlertDialogContent requires direct AlertDialogHeader and AlertDialogFooter children.
 * @example
 * import { createElement as h } from 'react';
 * import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from 'jg-react-ui/components/alert-dialog';
 * const example = h(AlertDialog, null, h(AlertDialogTrigger, null, 'Review change'),
 *   h(AlertDialogContent, null,
 *     h(AlertDialogHeader, null, h(AlertDialogTitle, null, 'Apply change?'), h(AlertDialogDescription, null, 'Review before continuing.')),
 *     h(AlertDialogFooter, null, h(AlertDialogAction, null, 'Apply change'))));
 */
export const AlertDialogContent = ({
  children,
  ...props
}: IAlertDialogContentProps): React.ReactElement => {
  validateAlertDialogStructure(children);

  return (
    <BaseAlertDialog.Portal>
      <AlertDialogOverlay />
      <BaseAlertDialog.Popup
        {...props}
        data-slot="alert-dialog-content"
        className={ALERT_DIALOG_CONTENT_CLASS_NAME}
      >
        <BaseAlertDialog.Close
          aria-label="Close dialog"
          className={ALERT_DIALOG_CLOSE_BUTTON_CLASS_NAME}
          data-slot="alert-dialog-close"
          nativeButton
          title="Close dialog"
        >
          <XIcon aria-hidden="true" />
        </BaseAlertDialog.Close>
        {children}
      </BaseAlertDialog.Popup>
    </BaseAlertDialog.Portal>
  );
};

/**
 * Groups the alert dialog title, media, and description.
 * @param props The alert dialog header props.
 * @returns A React element that renders the alert dialog header.
 * @example
 * import { createElement as h } from 'react';
 * import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from 'jg-react-ui/components/alert-dialog';
 * const example = h(AlertDialog, null, h(AlertDialogTrigger, null, 'Review change'),
 *   h(AlertDialogContent, null,
 *     h(AlertDialogHeader, null, h(AlertDialogTitle, null, 'Apply change?'), h(AlertDialogDescription, null, 'Review before continuing.')),
 *     h(AlertDialogFooter, null, h(AlertDialogAction, null, 'Apply change'))));
 */
export const AlertDialogHeader = (props: IAlertDialogHeaderProps): React.ReactElement => (
  <header
    {...props}
    data-slot="alert-dialog-header"
    className="grid min-h-0 gap-2 overflow-y-auto text-center"
  />
);

/**
 * Groups alert dialog actions in a responsive footer layout.
 * @param props The alert dialog footer props.
 * @returns A React element that renders the alert dialog footer.
 * @example
 * import { createElement as h } from 'react';
 * import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from 'jg-react-ui/components/alert-dialog';
 * const example = h(AlertDialog, null, h(AlertDialogTrigger, null, 'Review change'),
 *   h(AlertDialogContent, null,
 *     h(AlertDialogHeader, null, h(AlertDialogTitle, null, 'Apply change?'), h(AlertDialogDescription, null, 'Review before continuing.')),
 *     h(AlertDialogFooter, null, h(AlertDialogAction, null, 'Apply change'))));
 */
export const AlertDialogFooter = (props: IAlertDialogFooterProps): React.ReactElement => (
  <footer
    {...props}
    data-slot="alert-dialog-footer"
    className="flex shrink-0 flex-col-reverse gap-2 *:w-full"
  />
);

/**
 * Announces the primary alert dialog heading.
 * @param props The Base UI alert dialog title props.
 * @returns A React element that renders the alert dialog title.
 * @example
 * import { createElement as h } from 'react';
 * import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from 'jg-react-ui/components/alert-dialog';
 * const example = h(AlertDialog, null, h(AlertDialogTrigger, null, 'Review change'),
 *   h(AlertDialogContent, null,
 *     h(AlertDialogHeader, null, h(AlertDialogTitle, null, 'Apply change?'), h(AlertDialogDescription, null, 'Review before continuing.')),
 *     h(AlertDialogFooter, null, h(AlertDialogAction, null, 'Apply change'))));
 */
export const AlertDialogTitle = ({
  className,
  ...props
}: IAlertDialogTitleProps): React.ReactElement => (
  <BaseAlertDialog.Title
    data-slot="alert-dialog-title"
    className={cn('text-foreground px-8 text-lg font-semibold', className)}
    {...props}
  />
);

/**
 * Provides supporting context for the alert dialog title.
 * @param props The Base UI alert dialog description props.
 * @returns A React element that renders the alert dialog description.
 * @example
 * import { createElement as h } from 'react';
 * import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from 'jg-react-ui/components/alert-dialog';
 * const example = h(AlertDialog, null, h(AlertDialogTrigger, null, 'Review change'),
 *   h(AlertDialogContent, null,
 *     h(AlertDialogHeader, null, h(AlertDialogTitle, null, 'Apply change?'), h(AlertDialogDescription, null, 'Review before continuing.')),
 *     h(AlertDialogFooter, null, h(AlertDialogAction, null, 'Apply change'))));
 */
export const AlertDialogDescription = ({
  className,
  ...props
}: IAlertDialogDescriptionProps): React.ReactElement => (
  <BaseAlertDialog.Description
    data-slot="alert-dialog-description"
    className={cn('text-secondary-foreground text-sm leading-6', className)}
    {...props}
  />
);

/**
 * Renders the primary alert dialog action with shared button styling.
 * @param props The Base UI close props and button variants for the primary action.
 * @returns A React element that renders the alert dialog action button.
 * @throws
 * - AlertDialogAction asChild requires exactly one valid React element child.
 * @example
 * import { createElement as h } from 'react';
 * import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from 'jg-react-ui/components/alert-dialog';
 * const example = h(AlertDialog, null, h(AlertDialogTrigger, null, 'Review change'),
 *   h(AlertDialogContent, null,
 *     h(AlertDialogHeader, null, h(AlertDialogTitle, null, 'Apply change?'), h(AlertDialogDescription, null, 'Review before continuing.')),
 *     h(AlertDialogFooter, null, h(AlertDialogAction, null, 'Apply change'))));
 */
export const AlertDialogAction = ({
  asChild = false,
  children,
  className,
  variant = 'default',
  size = 'default',
  ...props
}: IAlertDialogActionProps): React.ReactElement => (
  <BaseAlertDialog.Close
    data-slot="alert-dialog-action"
    nativeButton={!asChild || isNativeButtonRender(children)}
    render={
      asChild ? (
        resolveAlertDialogRender(children, 'AlertDialogAction')
      ) : (
        <Button
          variant={variant}
          size={size}
        />
      )
    }
    className={asChild ? cn(buttonVariants({ variant, size, className })) : className}
    {...props}
  >
    {asChild ? undefined : children}
  </BaseAlertDialog.Close>
);

/**
 * Resolves the render element used by Base UI for alert dialog asChild rendering.
 * @param children The children provided by the consumer.
 * @param componentName The public component name used in the error message.
 * @returns A valid React element for Base UI's render prop.
 * @throws
 * - AlertDialogAction asChild requires exactly one valid React element child.
 * - AlertDialogTrigger asChild requires exactly one valid React element child.
 */
const resolveAlertDialogRender = (
  children: React.ReactNode,
  componentName: 'AlertDialogAction' | 'AlertDialogTrigger',
): React.ReactElement => {
  if (!isValidElement(children)) {
    throw new Error(`${componentName} asChild requires exactly one valid React element child.`);
  }

  return children;
};

/**
 * Enforces the compact alert dialog header and footer contract.
 * @param children The alert dialog panel children.
 * @throws
 * - AlertDialogContent requires direct AlertDialogHeader and AlertDialogFooter children.
 */
const validateAlertDialogStructure = (children: React.ReactNode): void => {
  const nodes = Children.toArray(children);
  const elements = nodes.filter(isValidElement);
  const headerCount = elements.filter((element) => element.type === AlertDialogHeader).length;
  const footerCount = elements.filter((element) => element.type === AlertDialogFooter).length;

  if (
    nodes.length !== elements.length ||
    headerCount !== 1 ||
    footerCount !== 1 ||
    elements.length !== headerCount + footerCount
  ) {
    throw new Error(
      'AlertDialogContent requires direct AlertDialogHeader and AlertDialogFooter children.',
    );
  }
};
