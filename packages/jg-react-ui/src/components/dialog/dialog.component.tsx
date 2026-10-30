import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import type * as React from 'react';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { ArrowLeftIcon, XIcon } from 'lucide-react';
import { cn } from 'cnfast';

import { useDialogNavigationRoot } from '../../shared/dialog-navigation-root/index.js';
import {
  COMPACT_MODAL_CLOSE_BUTTON_CLASS_NAME,
  MODAL_BACKDROP_KEYFRAME_MOTION_CLASS_NAME,
  MODAL_BACKDROP_SURFACE_CLASS_NAME,
} from '../../shared/modal-surface/index.js';
import { isNativeButtonRender } from '../../shared/native-button-render/index.js';
import { createRetainedModalChildren } from '../../shared/retained-modal-children/index.js';
import { buttonVariants } from '../button/index.js';
import { DialogMotionContext } from './dialog-motion.context.js';
import { useDialogMotion } from './dialog-motion.hook.js';
import {
  dialogBodyVariants,
  dialogContentVariants,
  dialogFooterVariants,
  dialogHeaderVariants,
} from './constants.js';
import type {
  IDialogBodyProps,
  IDialogCancelProps,
  IDialogCloseProps,
  IDialogContentProps,
  IDialogDescriptionProps,
  IDialogFooterProps,
  IDialogHeaderProps,
  IDialogOverlayProps,
  IDialogProps,
  IDialogTitleProps,
  IDialogTriggerProps,
  IDialogSize,
} from './types.js';

type IDialogLayoutContext = {
  backButtonAriaLabel: string;
  backButtonIcon: React.ReactNode;
  backButtonReference: React.RefObject<HTMLButtonElement | null>;
  closeButtonAriaLabel: string;
  closeButtonIcon: React.ReactNode;
  closeButtonReference: React.RefObject<HTMLButtonElement | null>;
  isCloseButtonVisible: boolean;
  size: IDialogSize;
};

type IDialogDismissalContext = {
  isDismissalDisabled: boolean;
  isOverlayCloseEnabled: boolean;
};

const DialogDismissalContext = createContext<IDialogDismissalContext>({
  isDismissalDisabled: false,
  isOverlayCloseEnabled: false,
});
const DialogLayoutContext = createContext<IDialogLayoutContext | null>(null);

// default generated control icons preserve the established dialog appearance.
const DEFAULT_DIALOG_BACK_BUTTON_ICON = <ArrowLeftIcon />;
const DEFAULT_DIALOG_CLOSE_BUTTON_ICON = <XIcon />;
// coarse pointers need full touch targets while mouse controls retain their existing sizes.
const COARSE_POINTER_DISMISS_BUTTON_CLASS_NAME = 'pointer-coarse:min-h-11 pointer-coarse:min-w-11';
const SMALL_DIALOG_CLOSE_BUTTON_CLASS_NAME = cn(
  buttonVariants({ size: 'icon-sm', variant: 'ghost' }),
  COMPACT_MODAL_CLOSE_BUTTON_CLASS_NAME,
  COARSE_POINTER_DISMISS_BUTTON_CLASS_NAME,
);

const getOpenDataState = (isOpen: boolean): 'open' | 'closed' => (isOpen ? 'open' : 'closed');

/**
 * Provides the dialog root state and accessibility context.
 * @param props The Base UI dialog root props.
 * @returns A React element that renders the dialog root.
 * @example
 * import { createElement as h } from 'react';
 * import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose, DialogTrigger, DialogDescription, DialogCancel } from 'jg-react-ui/components/dialog';
 * const example = h(Dialog, null, h(DialogTrigger, null, 'Edit workspace'),
 *   h(DialogContent, { size: 'medium' },
 *     h(DialogHeader, null, h(DialogTitle, null, 'Workspace'), h(DialogDescription, null, 'Edit settings')),
 *     h(DialogBody, null, h('input', { 'aria-label': 'Workspace name' })),
 *     h(DialogFooter, null, h(DialogCancel, null, 'Cancel'), h(DialogClose, null, 'Done'))));
 */
export const Dialog = ({
  children,
  actionsRef: providedActionsRef,
  getNavigationSession,
  isDismissalDisabled = false,
  isOverlayCloseEnabled = false,
  onOpenChange,
  onOpenChangeComplete,
  open,
  ...props
}: IDialogProps): React.ReactElement => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(
    () => open ?? (props.defaultOpen || props.handle?.isOpen || false),
  );
  const requestedOpen = open ?? uncontrolledOpen;
  const { actionsRef, recordOpenChange, isDismissingForNavigation } = useDialogNavigationRoot({
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
  const handleOpenChangeComplete = useCallback<
    NonNullable<BaseDialog.Root.Props['onOpenChangeComplete']>
  >(
    (isOpen) => {
      if (!isOpen) {
        markCloseComplete();
      }

      onOpenChangeComplete?.(isOpen);
    },
    [onOpenChangeComplete],
  );
  const { dialogId, renderedOpen, completeOpenChange, skipReturn } = useDialogMotion(
    requestedOpen,
    actionsRef,
    handleOpenChangeComplete,
  );
  const handleOpenChange = useCallback<NonNullable<BaseDialog.Root.Props['onOpenChange']>>(
    (nextOpen, eventDetails) => {
      if (!nextOpen && isDismissalDisabled && !isDismissingForNavigation()) {
        eventDetails.cancel();

        return;
      }

      if (!nextOpen && isDismissingForNavigation()) {
        skipReturn();
      }
      recordOpenChange(nextOpen);
      if (open === undefined) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [
      isDismissalDisabled,
      isDismissingForNavigation,
      onOpenChange,
      open,
      recordOpenChange,
      skipReturn,
    ],
  );
  const dismissalContext = useMemo<IDialogDismissalContext>(
    () => ({ isDismissalDisabled, isOverlayCloseEnabled }),
    [isDismissalDisabled, isOverlayCloseEnabled],
  );

  return (
    <DialogDismissalContext value={dismissalContext}>
      <DialogMotionContext value={dialogId}>
        <BaseDialog.Root
          {...props}
          actionsRef={actionsRef}
          data-slot="dialog"
          disablePointerDismissal={!isOverlayCloseEnabled}
          open={renderedOpen}
          onOpenChange={handleOpenChange}
          onOpenChangeComplete={completeOpenChange}
        >
          {createRetainedModalChildren(children, requestedOpen, closeCompletionKey)}
        </BaseDialog.Root>
      </DialogMotionContext>
    </DialogDismissalContext>
  );
};

/**
 * Renders the interactive element that opens the dialog.
 * @param props The Base UI dialog trigger props and optional slot rendering flag.
 * @returns A React element that renders the dialog trigger.
 * @throws
 * - DialogTrigger asChild requires exactly one valid React element child.
 * @example
 * import { createElement as h } from 'react';
 * import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose, DialogTrigger, DialogDescription, DialogCancel } from 'jg-react-ui/components/dialog';
 * const example = h(Dialog, null, h(DialogTrigger, null, 'Edit workspace'),
 *   h(DialogContent, { size: 'medium' },
 *     h(DialogHeader, null, h(DialogTitle, null, 'Workspace'), h(DialogDescription, null, 'Edit settings')),
 *     h(DialogBody, null, h('input', { 'aria-label': 'Workspace name' })),
 *     h(DialogFooter, null, h(DialogCancel, null, 'Cancel'), h(DialogClose, null, 'Done'))));
 */
export const DialogTrigger = ({
  asChild = false,
  children,
  ...props
}: IDialogTriggerProps): React.ReactElement => (
  <BaseDialog.Trigger
    data-slot="dialog-trigger"
    nativeButton={!asChild || isNativeButtonRender(children)}
    render={asChild ? resolveDialogRender(children, 'DialogTrigger') : undefined}
    {...props}
  >
    {asChild ? undefined : children}
  </BaseDialog.Trigger>
);

/**
 * Renders the interactive element that closes the dialog.
 * @param props The Base UI dialog close props and optional slot rendering flag.
 * @returns A React element that renders the dialog close control.
 * @throws
 * - DialogClose asChild requires exactly one valid React element child.
 * @example
 * import { createElement as h } from 'react';
 * import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose, DialogTrigger, DialogDescription, DialogCancel } from 'jg-react-ui/components/dialog';
 * const example = h(Dialog, null, h(DialogTrigger, null, 'Edit workspace'),
 *   h(DialogContent, { size: 'medium' },
 *     h(DialogHeader, null, h(DialogTitle, null, 'Workspace'), h(DialogDescription, null, 'Edit settings')),
 *     h(DialogBody, null, h('input', { 'aria-label': 'Workspace name' })),
 *     h(DialogFooter, null, h(DialogCancel, null, 'Cancel'), h(DialogClose, null, 'Done'))));
 */
export const DialogClose = ({
  asChild = false,
  children,
  disabled,
  ...props
}: IDialogCloseProps): React.ReactElement => {
  const { isDismissalDisabled } = useContext(DialogDismissalContext);

  return (
    <BaseDialog.Close
      data-slot="dialog-close"
      disabled={isDismissalDisabled || disabled}
      nativeButton={!asChild || isNativeButtonRender(children)}
      render={asChild ? resolveDialogRender(children, 'DialogClose') : undefined}
      {...props}
    >
      {asChild ? undefined : children}
    </BaseDialog.Close>
  );
};

/**
 * Renders a semantic footer cancel control for page-like dialogs.
 * @param props The dialog close props and optional slot rendering flag.
 * @returns A React element for medium and large dialogs, or null when a compact header owns dismissal.
 * @throws
 * - DialogCancel must be rendered inside DialogContent.
 * - DialogClose asChild requires exactly one valid React element child.
 * @example
 * import { createElement as h } from 'react';
 * import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose, DialogTrigger, DialogDescription, DialogCancel } from 'jg-react-ui/components/dialog';
 * const example = h(Dialog, null, h(DialogTrigger, null, 'Edit workspace'),
 *   h(DialogContent, { size: 'medium' },
 *     h(DialogHeader, null, h(DialogTitle, null, 'Workspace'), h(DialogDescription, null, 'Edit settings')),
 *     h(DialogBody, null, h('input', { 'aria-label': 'Workspace name' })),
 *     h(DialogFooter, null, h(DialogCancel, null, 'Cancel'), h(DialogClose, null, 'Done'))));
 */
export const DialogCancel = (props: IDialogCancelProps): React.ReactElement | null => {
  const { size } = useDialogLayoutContext('DialogCancel');

  if (size === 'small') {
    return null;
  }

  return (
    <DialogClose
      {...props}
      data-slot="dialog-cancel"
      className="hidden sm:inline-flex"
    />
  );
};

/**
 * Renders the backdrop for root and nested dialogs, hiding it behind page-like dialogs on mobile.
 * @param props The Base UI dialog backdrop props.
 * @returns A React element that renders the dialog overlay.
 */
const DialogOverlay = ({
  className,
  size,
  ...props
}: IDialogOverlayProps & { size: IDialogSize }): React.ReactElement => (
  <BaseDialog.Backdrop
    data-slot="dialog-overlay"
    forceRender
    render={(renderProps, state) => (
      <div
        {...renderProps}
        data-state={getOpenDataState(state.open)}
      />
    )}
    className={cn(
      MODAL_BACKDROP_SURFACE_CLASS_NAME,
      MODAL_BACKDROP_KEYFRAME_MOTION_CLASS_NAME,
      size === 'small' ? undefined : 'max-sm:hidden',
      className,
    )}
    {...props}
  />
);

/**
 * Renders the themed dialog content inside a portal.
 * @param props The Base UI dialog popup props and shared dialog options.
 * @returns A React element that renders the dialog panel.
 * @throws
 * - DialogContent asChild requires exactly one valid React element child.
 * - DialogContent requires direct DialogHeader and DialogBody children, with one optional DialogFooter.
 * @example
 * import { createElement as h } from 'react';
 * import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose, DialogTrigger, DialogDescription, DialogCancel } from 'jg-react-ui/components/dialog';
 * const example = h(Dialog, null, h(DialogTrigger, null, 'Edit workspace'),
 *   h(DialogContent, { size: 'medium' },
 *     h(DialogHeader, null, h(DialogTitle, null, 'Workspace'), h(DialogDescription, null, 'Edit settings')),
 *     h(DialogBody, null, h('input', { 'aria-label': 'Workspace name' })),
 *     h(DialogFooter, null, h(DialogCancel, null, 'Cancel'), h(DialogClose, null, 'Done'))));
 */
export const DialogContent = ({
  asChild = false,
  backButtonAriaLabel = 'Go back',
  backButtonIcon = DEFAULT_DIALOG_BACK_BUTTON_ICON,
  children,
  closeButtonAriaLabel = 'Close dialog',
  closeButtonIcon = DEFAULT_DIALOG_CLOSE_BUTTON_ICON,
  forceMount,
  initialFocus,
  isCloseButtonVisible = true,
  size,
  ...props
}: IDialogContentProps): React.ReactElement => {
  const dialogId = useContext(DialogMotionContext);
  const backButtonReference = useRef<HTMLButtonElement>(null);
  const closeButtonReference = useRef<HTMLButtonElement>(null);
  const layoutContext = useMemo<IDialogLayoutContext>(
    () => ({
      backButtonAriaLabel,
      backButtonIcon,
      backButtonReference,
      closeButtonAriaLabel,
      closeButtonIcon,
      closeButtonReference,
      isCloseButtonVisible,
      size,
    }),
    [
      backButtonAriaLabel,
      backButtonIcon,
      closeButtonAriaLabel,
      closeButtonIcon,
      isCloseButtonVisible,
      size,
    ],
  );
  const focusDismissControl = useCallback(
    (): HTMLButtonElement | null =>
      size !== 'small' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(max-width: 639px)').matches
        ? backButtonReference.current
        : closeButtonReference.current,
    [size],
  );
  const focusFirstContentControl = useCallback((): HTMLElement | null => {
    const popup = document.querySelector<HTMLElement>(`[data-dialog-motion-id="${dialogId}"]`);
    const controls = popup?.querySelectorAll<HTMLElement>(
      '[data-slot="dialog-body"] input, [data-slot="dialog-body"] textarea, [data-slot="dialog-body"] select, [data-slot="dialog-body"] button, [data-slot="dialog-body"] a[href], [data-slot="dialog-body"] [contenteditable="true"], [data-slot="dialog-body"] [tabindex], [data-slot="dialog-footer"] button, [data-slot="dialog-footer"] a[href]',
    );

    for (const control of controls ?? []) {
      if (
        control.matches(':disabled, [type="hidden"], [tabindex="-1"]') ||
        control.closest('[hidden], [inert], [aria-hidden="true"]') ||
        control.getAttribute('aria-disabled') === 'true'
      ) {
        continue;
      }

      let current: HTMLElement | null = control;
      let isVisible = true;
      while (current && current !== popup) {
        const style = window.getComputedStyle(current);
        if (style.display === 'none' || style.visibility === 'hidden') {
          isVisible = false;
          break;
        }
        current = current.parentElement;
      }
      if (isVisible) return control;
    }

    return focusDismissControl();
  }, [dialogId, focusDismissControl]);

  const renderElement = asChild ? resolveDialogContentRender(children) : undefined;
  validateDialogStructure(renderElement === undefined ? children : renderElement.props.children);

  return (
    <DialogLayoutContext value={layoutContext}>
      <BaseDialog.Portal keepMounted={forceMount}>
        <DialogOverlay size={size} />
        <BaseDialog.Popup
          {...props}
          data-dialog-motion-id={dialogId}
          data-size={size}
          data-slot="dialog-content"
          initialFocus={
            initialFocus === 'dismiss-control'
              ? focusDismissControl
              : (initialFocus ?? focusFirstContentControl)
          }
          render={
            asChild
              ? renderElement
              : (renderProps, state) => (
                  <div
                    {...renderProps}
                    data-state={getOpenDataState(state.open)}
                  />
                )
          }
          className={dialogContentVariants({ size })}
        >
          {asChild ? undefined : children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </DialogLayoutContext>
  );
};

/**
 * Groups the dialog title, optional supporting context, and header actions.
 * @param props The dialog header props.
 * @returns A React element that renders the dialog header.
 * @throws
 * - DialogHeader must be rendered inside DialogContent.
 * @example
 * import { createElement as h } from 'react';
 * import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose, DialogTrigger, DialogDescription, DialogCancel } from 'jg-react-ui/components/dialog';
 * const example = h(Dialog, null, h(DialogTrigger, null, 'Edit workspace'),
 *   h(DialogContent, { size: 'medium' },
 *     h(DialogHeader, null, h(DialogTitle, null, 'Workspace'), h(DialogDescription, null, 'Edit settings')),
 *     h(DialogBody, null, h('input', { 'aria-label': 'Workspace name' })),
 *     h(DialogFooter, null, h(DialogCancel, null, 'Cancel'), h(DialogClose, null, 'Done'))));
 */
export const DialogHeader = ({
  actions,
  children,
  leadingAction,
  layout = 'centered',
  ...props
}: IDialogHeaderProps): React.ReactElement => {
  const {
    backButtonAriaLabel,
    backButtonIcon,
    backButtonReference,
    closeButtonAriaLabel,
    closeButtonIcon,
    closeButtonReference,
    isCloseButtonVisible,
    size,
  } = useDialogLayoutContext('DialogHeader');

  if (size === 'small') {
    const shouldGroupCloseButton = layout === 'split' && Boolean(actions) && isCloseButtonVisible;
    const closeButton = isCloseButtonVisible ? (
      <DialogClose
        aria-label={closeButtonAriaLabel}
        ref={closeButtonReference}
        title={closeButtonAriaLabel}
        type="button"
        className={
          shouldGroupCloseButton
            ? cn(
                buttonVariants({ size: 'icon-touch', variant: 'ghost' }),
                COARSE_POINTER_DISMISS_BUTTON_CLASS_NAME,
              )
            : SMALL_DIALOG_CLOSE_BUTTON_CLASS_NAME
        }
      >
        <span aria-hidden="true">{closeButtonIcon}</span>
      </DialogClose>
    ) : null;

    if (layout === 'split') {
      return (
        <header
          {...props}
          data-slot="dialog-header"
          className={cn(
            dialogHeaderVariants({ size }),
            leadingAction
              ? actions
                ? 'grid-cols-[auto_minmax(0,1fr)_auto]'
                : 'grid-cols-[auto_minmax(0,1fr)]'
              : actions
                ? 'grid-cols-[minmax(0,1fr)_auto]'
                : undefined,
            'items-center pr-5 text-left',
          )}
        >
          {leadingAction ? (
            <div
              data-slot="dialog-header-leading"
              className="flex items-center justify-start gap-1"
            >
              {leadingAction}
            </div>
          ) : null}

          <div
            data-slot="dialog-heading"
            className={cn(
              'grid min-w-0 gap-1.5',
              !actions && isCloseButtonVisible ? '[&>[data-slot=dialog-title]]:pr-8' : undefined,
            )}
          >
            {children}
          </div>

          {actions ? (
            <div
              data-slot="dialog-header-actions"
              className="flex items-center justify-end gap-1"
            >
              {actions}
              {shouldGroupCloseButton ? closeButton : null}
            </div>
          ) : null}
          {shouldGroupCloseButton ? null : closeButton}
        </header>
      );
    }

    return (
      <header
        {...props}
        data-slot="dialog-header"
        className={cn(
          dialogHeaderVariants({ size }),
          actions ? 'grid-cols-[minmax(0,1fr)_auto] items-start' : undefined,
          leadingAction ? 'pl-15' : undefined,
          actions && isCloseButtonVisible ? 'pr-16' : 'pr-5',
        )}
      >
        {leadingAction ? (
          <div
            data-slot="dialog-header-leading"
            className="absolute top-2 left-2 z-10 flex items-center justify-start gap-1"
          >
            {leadingAction}
          </div>
        ) : null}

        <div
          data-slot="dialog-heading"
          className={cn(
            'grid min-w-0 gap-1.5',
            !actions && isCloseButtonVisible ? '[&>[data-slot=dialog-title]]:px-8' : undefined,
          )}
        >
          {children}
        </div>
        {actions ? (
          <div
            data-slot="dialog-header-actions"
            className="flex items-center justify-center gap-1"
          >
            {actions}
          </div>
        ) : null}
        {closeButton}
      </header>
    );
  }

  const headerChildren = Children.toArray(children);
  const titleChildren = headerChildren.filter(
    (child) => isValidElement(child) && child.type === DialogTitle,
  );
  const supportingChildren = headerChildren.filter(
    (child) => !isValidElement(child) || child.type !== DialogTitle,
  );

  return (
    <header
      {...props}
      data-slot="dialog-header"
      className={dialogHeaderVariants({ size })}
    >
      <div
        data-slot="dialog-header-row"
        className={cn(
          'grid min-h-9 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2',
          leadingAction
            ? 'sm:grid-cols-[auto_minmax(0,1fr)_auto]'
            : 'sm:grid-cols-[minmax(0,1fr)_auto]',
        )}
      >
        {leadingAction ? (
          <div
            data-slot="dialog-header-leading"
            className="flex items-center justify-start gap-1"
          >
            {leadingAction}
          </div>
        ) : (
          <DialogClose
            aria-label={backButtonAriaLabel}
            data-slot="dialog-back"
            ref={backButtonReference}
            title={backButtonAriaLabel}
            type="button"
            className={cn(
              buttonVariants({ size: 'icon-lg', variant: 'ghost' }),
              COARSE_POINTER_DISMISS_BUTTON_CLASS_NAME,
              'sm:hidden',
            )}
          >
            <span aria-hidden="true">{backButtonIcon}</span>
          </DialogClose>
        )}

        <div
          data-slot="dialog-heading"
          className="min-w-0"
        >
          {titleChildren}
        </div>

        <div
          data-slot="dialog-header-actions"
          className="flex items-center justify-end gap-1"
        >
          {actions}
          {isCloseButtonVisible ? (
            <DialogClose
              aria-label={closeButtonAriaLabel}
              ref={closeButtonReference}
              title={closeButtonAriaLabel}
              type="button"
              className={cn(
                buttonVariants({ size: 'icon-sm', variant: 'ghost' }),
                COARSE_POINTER_DISMISS_BUTTON_CLASS_NAME,
                'hidden sm:inline-flex',
              )}
            >
              <span aria-hidden="true">{closeButtonIcon}</span>
            </DialogClose>
          ) : null}
        </div>
      </div>

      {supportingChildren.length > 0 ? (
        <div
          data-slot="dialog-header-supporting"
          className="grid gap-1.5 px-2 sm:px-0"
        >
          {supportingChildren}
        </div>
      ) : null}
    </header>
  );
};

/**
 * Renders the only vertically scrollable region within a dialog surface.
 * @param props The body element props and padding variant.
 * @returns A React element that renders the dialog body.
 * @throws
 * - DialogBody must be rendered inside DialogContent.
 * @example
 * import { createElement as h } from 'react';
 * import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose, DialogTrigger, DialogDescription, DialogCancel } from 'jg-react-ui/components/dialog';
 * const example = h(Dialog, null, h(DialogTrigger, null, 'Edit workspace'),
 *   h(DialogContent, { size: 'medium' },
 *     h(DialogHeader, null, h(DialogTitle, null, 'Workspace'), h(DialogDescription, null, 'Edit settings')),
 *     h(DialogBody, null, h('input', { 'aria-label': 'Workspace name' })),
 *     h(DialogFooter, null, h(DialogCancel, null, 'Cancel'), h(DialogClose, null, 'Done'))));
 */
export const DialogBody = ({
  className,
  padding = 'default',
  ...props
}: IDialogBodyProps): React.ReactElement => {
  const { size } = useDialogLayoutContext('DialogBody');

  return (
    <div
      {...props}
      data-slot="dialog-body"
      className={cn(className, dialogBodyVariants({ padding, size }))}
    />
  );
};

/**
 * Groups dialog actions in a responsive footer layout.
 * @param props The dialog footer props.
 * @returns A React element that renders the dialog footer.
 * @throws
 * - DialogFooter must be rendered inside DialogContent.
 * @example
 * import { createElement as h } from 'react';
 * import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose, DialogTrigger, DialogDescription, DialogCancel } from 'jg-react-ui/components/dialog';
 * const example = h(Dialog, null, h(DialogTrigger, null, 'Edit workspace'),
 *   h(DialogContent, { size: 'medium' },
 *     h(DialogHeader, null, h(DialogTitle, null, 'Workspace'), h(DialogDescription, null, 'Edit settings')),
 *     h(DialogBody, null, h('input', { 'aria-label': 'Workspace name' })),
 *     h(DialogFooter, null, h(DialogCancel, null, 'Cancel'), h(DialogClose, null, 'Done'))));
 */
export const DialogFooter = (props: IDialogFooterProps): React.ReactElement => {
  const { size } = useDialogLayoutContext('DialogFooter');

  return (
    <footer
      {...props}
      data-slot="dialog-footer"
      className={dialogFooterVariants({ size })}
    />
  );
};

/**
 * Announces the primary dialog heading.
 * @param props The Base UI dialog title props.
 * @returns A React element that renders the dialog title.
 * @example
 * import { createElement as h } from 'react';
 * import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose, DialogTrigger, DialogDescription, DialogCancel } from 'jg-react-ui/components/dialog';
 * const example = h(Dialog, null, h(DialogTrigger, null, 'Edit workspace'),
 *   h(DialogContent, { size: 'medium' },
 *     h(DialogHeader, null, h(DialogTitle, null, 'Workspace'), h(DialogDescription, null, 'Edit settings')),
 *     h(DialogBody, null, h('input', { 'aria-label': 'Workspace name' })),
 *     h(DialogFooter, null, h(DialogCancel, null, 'Cancel'), h(DialogClose, null, 'Done'))));
 */
export const DialogTitle = ({ className, ...props }: IDialogTitleProps): React.ReactElement => (
  <BaseDialog.Title
    data-slot="dialog-title"
    className={cn('text-foreground text-lg font-semibold', className)}
    {...props}
  />
);

/**
 * Provides optional supporting context for the dialog title.
 * @param props The Base UI dialog description props.
 * @returns A React element that renders the dialog description.
 * @example
 * import { createElement as h } from 'react';
 * import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose, DialogTrigger, DialogDescription, DialogCancel } from 'jg-react-ui/components/dialog';
 * const example = h(Dialog, null, h(DialogTrigger, null, 'Edit workspace'),
 *   h(DialogContent, { size: 'medium' },
 *     h(DialogHeader, null, h(DialogTitle, null, 'Workspace'), h(DialogDescription, null, 'Edit settings')),
 *     h(DialogBody, null, h('input', { 'aria-label': 'Workspace name' })),
 *     h(DialogFooter, null, h(DialogCancel, null, 'Cancel'), h(DialogClose, null, 'Done'))));
 */
export const DialogDescription = ({
  className,
  ...props
}: IDialogDescriptionProps): React.ReactElement => (
  <BaseDialog.Description
    data-slot="dialog-description"
    className={cn('text-secondary-foreground text-sm leading-6', className)}
    {...props}
  />
);

/**
 * Resolves the render element used by Base UI for dialog asChild rendering.
 * @param children The children provided by the consumer.
 * @param componentName The public component name used in the error message.
 * @returns A valid React element for Base UI's render prop.
 * @throws
 * - DialogClose asChild requires exactly one valid React element child.
 * - DialogTrigger asChild requires exactly one valid React element child.
 */
const resolveDialogRender = (
  children: React.ReactNode,
  componentName: 'DialogClose' | 'DialogTrigger',
): React.ReactElement => {
  if (!isValidElement(children)) {
    throw new Error(`${componentName} asChild requires exactly one valid React element child.`);
  }

  return children;
};

/**
 * Resolves the element used as the dialog panel.
 * @param children The element provided as the dialog panel.
 * @returns The valid panel element.
 * @throws
 * - DialogContent asChild requires exactly one valid React element child.
 */
const resolveDialogContentRender = (
  children: React.ReactNode,
): React.ReactElement<{ children?: React.ReactNode }> => {
  if (!isValidElement<{ children?: React.ReactNode }>(children)) {
    throw new Error('DialogContent asChild requires exactly one valid React element child.');
  }

  return children;
};

/**
 * Returns the active dialog layout or reports a component used outside a dialog panel.
 * @param componentName The public component requesting layout state.
 * @returns The active dialog layout context.
 * @throws
 * - DialogHeader must be rendered inside DialogContent.
 * - DialogBody must be rendered inside DialogContent.
 * - DialogFooter must be rendered inside DialogContent.
 * - DialogCancel must be rendered inside DialogContent.
 */
const useDialogLayoutContext = (componentName: string): IDialogLayoutContext => {
  const context = useContext(DialogLayoutContext);

  if (!context) {
    throw new Error(`${componentName} must be rendered inside DialogContent.`);
  }

  return context;
};

/**
 * Enforces the fixed header, scrolling body, and optional footer panel contract.
 * @param children The dialog content children or the element used for asChild rendering.
 * @throws
 * - DialogContent requires direct DialogHeader and DialogBody children, with one optional DialogFooter.
 */
const validateDialogStructure = (children: React.ReactNode): void => {
  const nodes = Children.toArray(children);
  const elements = nodes.filter(isValidElement);
  const headerCount = elements.filter((element) => element.type === DialogHeader).length;
  const bodyCount = elements.filter((element) => element.type === DialogBody).length;
  const footerCount = elements.filter((element) => element.type === DialogFooter).length;

  if (
    elements.length !== nodes.length ||
    headerCount !== 1 ||
    bodyCount !== 1 ||
    footerCount > 1 ||
    elements.length !== headerCount + bodyCount + footerCount
  ) {
    throw new Error(
      'DialogContent requires direct DialogHeader and DialogBody children, with one optional DialogFooter.',
    );
  }
};
