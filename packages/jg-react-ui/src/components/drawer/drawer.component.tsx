import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import type * as React from 'react';
import { Drawer as BaseDrawer } from '@base-ui/react/drawer';
import { XIcon } from 'lucide-react';
import { cn } from 'cnfast';

import { MODAL_BACKDROP_SURFACE_CLASS_NAME } from '../../shared/modal-surface/index.js';
import { isNativeButtonRender } from '../../shared/native-button-render/index.js';
import { createRetainedModalChildren } from '../../shared/retained-modal-children/index.js';
import { buttonVariants } from '../button/index.js';
import { drawerBodyVariants, drawerHeaderVariants, drawerPopupVariants } from './constants.js';
import { preserveDocumentWidthWithoutScrollbarGutter } from './utilities.js';
import type {
  IDrawerBodyProps,
  IDrawerCloseProps,
  IDrawerContentProps,
  IDrawerDensity,
  IDrawerDescriptionProps,
  IDrawerFooterProps,
  IDrawerHeaderProps,
  IDrawerProps,
  IDrawerSide,
  IDrawerTitleProps,
  IDrawerTriggerProps,
} from './types.js';

type IDrawerLayoutContext = {
  isScrollbarGutterAdjustmentActive: boolean;
  side: IDrawerSide;
};

const DrawerDismissalContext = createContext(false);
const DrawerLayoutContext = createContext<IDrawerLayoutContext | null>(null);
const DrawerDensityContext = createContext<IDrawerDensity>('comfortable');

/**
 * Provides a modal side drawer with swipe, focus, and controlled-state behavior.
 * @param props The drawer root props and required side.
 * @returns A React element that renders the drawer root.
 * @example
 * import { createElement as h } from 'react';
 * import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter, DrawerClose } from 'jg-react-ui/components/drawer';
 * const example = h(Drawer, { side: 'right' }, h(DrawerTrigger, null, 'Navigation'),
 *   h(DrawerContent, { size: 'medium' },
 *     h(DrawerHeader, null, h(DrawerTitle, null, 'Workspace navigation'), h(DrawerDescription, null, 'Choose a workspace')),
 *     h(DrawerBody, null, h('a', { href: '/workspace' }, 'Workspace')),
 *     h(DrawerFooter, null, h(DrawerClose, null, 'Close navigation'))));
 */
export const Drawer = ({
  children,
  defaultOpen,
  isDismissalDisabled = false,
  modal,
  onOpenChange,
  onOpenChangeComplete,
  open,
  side,
  ...props
}: IDrawerProps): React.ReactElement => {
  const [closeCompletionKey, markCloseComplete] = useReducer(
    (currentCloseCompletionKey: number): number => currentCloseCompletionKey + 1,
    0,
  );
  const [isOpenTransitionActive, setIsOpenTransitionActive] = useState(
    open ?? defaultOpen ?? false,
  );

  useEffect(() => {
    if (open === true) {
      setIsOpenTransitionActive(true);
    }
  }, [open]);

  const isScrollLockEnabled = modal === undefined || modal === true;
  const layoutContext = useMemo<IDrawerLayoutContext>(
    () => ({
      isScrollbarGutterAdjustmentActive:
        isScrollLockEnabled && (open === true || isOpenTransitionActive),
      side,
    }),
    [isOpenTransitionActive, isScrollLockEnabled, open, side],
  );
  const handleOpenChange = useCallback<NonNullable<BaseDrawer.Root.Props['onOpenChange']>>(
    (isOpen, eventDetails) => {
      if (!isOpen && isDismissalDisabled) {
        eventDetails.cancel();

        return;
      }

      if (isOpen) {
        setIsOpenTransitionActive(true);
      }

      onOpenChange?.(isOpen);
    },
    [isDismissalDisabled, onOpenChange],
  );
  const handleOpenChangeComplete = useCallback<
    NonNullable<BaseDrawer.Root.Props['onOpenChangeComplete']>
  >(
    (isOpen) => {
      setIsOpenTransitionActive(isOpen);

      if (!isOpen) {
        markCloseComplete();
      }

      onOpenChangeComplete?.(isOpen);
    },
    [onOpenChangeComplete],
  );

  return (
    <DrawerDismissalContext value={isDismissalDisabled}>
      <DrawerLayoutContext value={layoutContext}>
        <BaseDrawer.Root
          {...props}
          data-slot="drawer"
          defaultOpen={defaultOpen}
          disablePointerDismissal={isDismissalDisabled}
          modal={modal}
          open={open}
          swipeDirection={side}
          onOpenChange={handleOpenChange}
          onOpenChangeComplete={handleOpenChangeComplete}
        >
          {createRetainedModalChildren(children, open, closeCompletionKey)}
        </BaseDrawer.Root>
      </DrawerLayoutContext>
    </DrawerDismissalContext>
  );
};

/**
 * Renders the interactive element that opens a drawer.
 * @param props The drawer trigger props and optional slot rendering flag.
 * @returns A React element that renders the drawer trigger.
 * @throws
 * - DrawerTrigger asChild requires exactly one valid React element child.
 * @example
 * import { createElement as h } from 'react';
 * import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter, DrawerClose } from 'jg-react-ui/components/drawer';
 * const example = h(Drawer, { side: 'right' }, h(DrawerTrigger, null, 'Navigation'),
 *   h(DrawerContent, { size: 'medium' },
 *     h(DrawerHeader, null, h(DrawerTitle, null, 'Workspace navigation'), h(DrawerDescription, null, 'Choose a workspace')),
 *     h(DrawerBody, null, h('a', { href: '/workspace' }, 'Workspace')),
 *     h(DrawerFooter, null, h(DrawerClose, null, 'Close navigation'))));
 */
export const DrawerTrigger = ({
  asChild = false,
  children,
  ...props
}: IDrawerTriggerProps): React.ReactElement => (
  <BaseDrawer.Trigger
    data-slot="drawer-trigger"
    nativeButton={!asChild || isNativeButtonRender(children)}
    render={asChild ? resolveDrawerRender(children, 'DrawerTrigger') : undefined}
    {...props}
  >
    {asChild ? undefined : children}
  </BaseDrawer.Trigger>
);

/**
 * Renders an interactive element that closes a drawer.
 * @param props The drawer close props and optional slot rendering flag.
 * @returns A React element that renders the drawer close control.
 * @throws
 * - DrawerClose asChild requires exactly one valid React element child.
 * @example
 * import { createElement as h } from 'react';
 * import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter, DrawerClose } from 'jg-react-ui/components/drawer';
 * const example = h(Drawer, { side: 'right' }, h(DrawerTrigger, null, 'Navigation'),
 *   h(DrawerContent, { size: 'medium' },
 *     h(DrawerHeader, null, h(DrawerTitle, null, 'Workspace navigation'), h(DrawerDescription, null, 'Choose a workspace')),
 *     h(DrawerBody, null, h('a', { href: '/workspace' }, 'Workspace')),
 *     h(DrawerFooter, null, h(DrawerClose, null, 'Close navigation'))));
 */
export const DrawerClose = ({
  asChild = false,
  children,
  disabled,
  ...props
}: IDrawerCloseProps): React.ReactElement => {
  const isDismissalDisabled = useContext(DrawerDismissalContext);

  return (
    <BaseDrawer.Close
      data-slot="drawer-close"
      disabled={isDismissalDisabled || disabled}
      nativeButton={!asChild || isNativeButtonRender(children)}
      render={asChild ? resolveDrawerRender(children, 'DrawerClose') : undefined}
      {...props}
    >
      {asChild ? undefined : children}
    </BaseDrawer.Close>
  );
};

/**
 * Renders a responsive navigation surface with a fixed header and scrolling body.
 * @param props The drawer popup props and required size.
 * @returns A React element that renders the drawer panel.
 * @throws
 * - DrawerContent must be rendered inside Drawer.
 * - DrawerContent requires direct DrawerHeader and DrawerBody children, with an optional trailing DrawerFooter.
 * @example
 * import { createElement as h } from 'react';
 * import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter, DrawerClose } from 'jg-react-ui/components/drawer';
 * const example = h(Drawer, { side: 'right' }, h(DrawerTrigger, null, 'Navigation'),
 *   h(DrawerContent, { size: 'medium' },
 *     h(DrawerHeader, null, h(DrawerTitle, null, 'Workspace navigation'), h(DrawerDescription, null, 'Choose a workspace')),
 *     h(DrawerBody, null, h('a', { href: '/workspace' }, 'Workspace')),
 *     h(DrawerFooter, null, h(DrawerClose, null, 'Close navigation'))));
 */
export const DrawerContent = ({
  children,
  closeButtonAriaLabel = 'Close drawer',
  closeButtonIcon,
  density = 'comfortable',
  forceMount,
  size,
  viewportStyle,
  ...props
}: IDrawerContentProps): React.ReactElement => {
  const layoutContext = useContext(DrawerLayoutContext);
  const isScrollbarGutterAdjustmentActive =
    layoutContext?.isScrollbarGutterAdjustmentActive ?? false;
  const side = layoutContext?.side;
  const restoreDocumentScrollbarGutterReference = useRef<(() => void) | null>(null);
  const handleViewportReference = useCallback(
    (viewportElement: HTMLDivElement | null): void => {
      restoreDocumentScrollbarGutterReference.current?.();
      restoreDocumentScrollbarGutterReference.current = null;

      if (side === 'right' && isScrollbarGutterAdjustmentActive && viewportElement !== null) {
        restoreDocumentScrollbarGutterReference.current =
          preserveDocumentWidthWithoutScrollbarGutter(viewportElement);
      }
    },
    [isScrollbarGutterAdjustmentActive, side],
  );

  if (!side) {
    throw new Error('DrawerContent must be rendered inside Drawer.');
  }

  validateDrawerStructure(children);

  return (
    <BaseDrawer.Portal keepMounted={forceMount}>
      <BaseDrawer.Backdrop
        data-slot="drawer-overlay"
        className={cn(
          MODAL_BACKDROP_SURFACE_CLASS_NAME,
          'opacity-[calc(1-var(--drawer-swipe-progress))] transition-opacity duration-300 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-swiping:transition-none data-swiping:duration-0 motion-reduce:transition-none',
        )}
      />
      <BaseDrawer.Viewport
        ref={handleViewportReference}
        data-slot="drawer-viewport"
        style={viewportStyle}
        className={cn(
          'fixed inset-0 z-50 flex items-stretch',
          side === 'left' ? 'justify-start' : 'justify-end',
        )}
      >
        <BaseDrawer.Popup
          {...props}
          data-density={density}
          data-side={side}
          data-size={size}
          data-slot="drawer-content"
          className={drawerPopupVariants({ side, size })}
        >
          <BaseDrawer.Content className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
            <DrawerDensityContext value={density}>{children}</DrawerDensityContext>
            <DrawerClose
              aria-label={closeButtonAriaLabel}
              title={closeButtonAriaLabel}
              type="button"
              className={cn(
                buttonVariants({ size: 'icon-touch', variant: 'ghost' }),
                'absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] z-10 rounded-none not-disabled:not-aria-disabled:hover:bg-transparent not-disabled:not-aria-disabled:active:not-aria-[haspopup]:translate-y-0 lg:rounded-lg',
              )}
            >
              <span
                aria-hidden="true"
                data-slot="drawer-close-visual"
                className="group-hover/button:bg-secondary group-focus-visible/button:bg-secondary inline-flex size-full items-center justify-center rounded-lg transition-[color,background-color,transform] group-active/button:translate-y-px motion-reduce:transition-none motion-reduce:group-active/button:translate-y-0 [&_svg]:size-4!"
              >
                {closeButtonIcon ?? <XIcon />}
              </span>
            </DrawerClose>
          </BaseDrawer.Content>
        </BaseDrawer.Popup>
      </BaseDrawer.Viewport>
    </BaseDrawer.Portal>
  );
};

/**
 * Groups the drawer title, description, and optional contextual actions.
 * @param props The drawer header props.
 * @returns A React element that renders the drawer header.
 * @example
 * import { createElement as h } from 'react';
 * import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter, DrawerClose } from 'jg-react-ui/components/drawer';
 * const example = h(Drawer, { side: 'right' }, h(DrawerTrigger, null, 'Navigation'),
 *   h(DrawerContent, { size: 'medium' },
 *     h(DrawerHeader, null, h(DrawerTitle, null, 'Workspace navigation'), h(DrawerDescription, null, 'Choose a workspace')),
 *     h(DrawerBody, null, h('a', { href: '/workspace' }, 'Workspace')),
 *     h(DrawerFooter, null, h(DrawerClose, null, 'Close navigation'))));
 */
export const DrawerHeader = ({
  actions,
  children,
  ...props
}: IDrawerHeaderProps): React.ReactElement => {
  const density = useContext(DrawerDensityContext);

  return (
    <header
      {...props}
      data-slot="drawer-header"
      className={cn(
        drawerHeaderVariants({ density }),
        actions ? 'grid-cols-[minmax(0,1fr)_auto] items-start' : undefined,
      )}
    >
      <div className="grid min-w-0 gap-1.5">{children}</div>
      {actions ? <div className="flex items-center justify-end gap-1">{actions}</div> : null}
    </header>
  );
};

/**
 * Renders the drawer's vertically scrollable content region.
 * @param props The body element props.
 * @returns A React element that renders the drawer body.
 * @example
 * import { createElement as h } from 'react';
 * import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter, DrawerClose } from 'jg-react-ui/components/drawer';
 * const example = h(Drawer, { side: 'right' }, h(DrawerTrigger, null, 'Navigation'),
 *   h(DrawerContent, { size: 'medium' },
 *     h(DrawerHeader, null, h(DrawerTitle, null, 'Workspace navigation'), h(DrawerDescription, null, 'Choose a workspace')),
 *     h(DrawerBody, null, h('a', { href: '/workspace' }, 'Workspace')),
 *     h(DrawerFooter, null, h(DrawerClose, null, 'Close navigation'))));
 */
export const DrawerBody = ({ className, ...props }: IDrawerBodyProps): React.ReactElement => {
  const density = useContext(DrawerDensityContext);

  return (
    <div
      {...props}
      data-slot="drawer-body"
      className={cn(className, drawerBodyVariants({ density }))}
    />
  );
};

/**
 * Renders an optional fixed drawer footer below the scrolling body.
 * @param props The footer element props.
 * @returns A React element that renders the drawer footer.
 * @example
 * import { createElement as h } from 'react';
 * import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter, DrawerClose } from 'jg-react-ui/components/drawer';
 * const example = h(Drawer, { side: 'right' }, h(DrawerTrigger, null, 'Navigation'),
 *   h(DrawerContent, { size: 'medium' },
 *     h(DrawerHeader, null, h(DrawerTitle, null, 'Workspace navigation'), h(DrawerDescription, null, 'Choose a workspace')),
 *     h(DrawerBody, null, h('a', { href: '/workspace' }, 'Workspace')),
 *     h(DrawerFooter, null, h(DrawerClose, null, 'Close navigation'))));
 */
export const DrawerFooter = ({ className, ...props }: IDrawerFooterProps): React.ReactElement => (
  <footer
    {...props}
    data-slot="drawer-footer"
    className={cn(
      'bg-background shrink-0 border-t border-border pt-3 pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))]',
      className,
    )}
  />
);

/**
 * Announces the drawer heading.
 * @param props The Base UI drawer title props.
 * @returns A React element that renders the drawer title.
 * @example
 * import { createElement as h } from 'react';
 * import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter, DrawerClose } from 'jg-react-ui/components/drawer';
 * const example = h(Drawer, { side: 'right' }, h(DrawerTrigger, null, 'Navigation'),
 *   h(DrawerContent, { size: 'medium' },
 *     h(DrawerHeader, null, h(DrawerTitle, null, 'Workspace navigation'), h(DrawerDescription, null, 'Choose a workspace')),
 *     h(DrawerBody, null, h('a', { href: '/workspace' }, 'Workspace')),
 *     h(DrawerFooter, null, h(DrawerClose, null, 'Close navigation'))));
 */
export const DrawerTitle = ({ className, ...props }: IDrawerTitleProps): React.ReactElement => (
  <BaseDrawer.Title
    data-slot="drawer-title"
    className={cn('min-w-0 truncate text-lg font-semibold', className)}
    {...props}
  />
);

/**
 * Provides supporting context for the drawer title.
 * @param props The Base UI drawer description props.
 * @returns A React element that renders the drawer description.
 * @example
 * import { createElement as h } from 'react';
 * import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerFooter, DrawerClose } from 'jg-react-ui/components/drawer';
 * const example = h(Drawer, { side: 'right' }, h(DrawerTrigger, null, 'Navigation'),
 *   h(DrawerContent, { size: 'medium' },
 *     h(DrawerHeader, null, h(DrawerTitle, null, 'Workspace navigation'), h(DrawerDescription, null, 'Choose a workspace')),
 *     h(DrawerBody, null, h('a', { href: '/workspace' }, 'Workspace')),
 *     h(DrawerFooter, null, h(DrawerClose, null, 'Close navigation'))));
 */
export const DrawerDescription = ({
  className,
  ...props
}: IDrawerDescriptionProps): React.ReactElement => (
  <BaseDrawer.Description
    data-slot="drawer-description"
    className={cn('text-secondary-foreground text-sm leading-6', className)}
    {...props}
  />
);

/**
 * Resolves the render element used by Base UI for drawer slot rendering.
 * @param children The children provided by the consumer.
 * @param componentName The public component name used in the error message.
 * @returns A valid React element for Base UI's render prop.
 * @throws
 * - DrawerClose asChild requires exactly one valid React element child.
 * - DrawerTrigger asChild requires exactly one valid React element child.
 */
const resolveDrawerRender = (
  children: React.ReactNode,
  componentName: 'DrawerClose' | 'DrawerTrigger',
): React.ReactElement => {
  if (!isValidElement(children)) {
    throw new Error(`${componentName} asChild requires exactly one valid React element child.`);
  }

  return children;
};

/**
 * Enforces the fixed header and scrolling body drawer contract.
 * @param children The drawer panel children.
 * @throws
 * - DrawerContent requires direct DrawerHeader and DrawerBody children, with an optional trailing DrawerFooter.
 */
const validateDrawerStructure = (children: React.ReactNode): void => {
  const nodes = Children.toArray(children);
  const elements = nodes.filter(isValidElement);
  const headerCount = elements.filter((element) => element.type === DrawerHeader).length;
  const bodyCount = elements.filter((element) => element.type === DrawerBody).length;
  const footerCount = elements.filter((element) => element.type === DrawerFooter).length;
  const hasValidOrder =
    elements[0]?.type === DrawerHeader &&
    elements[1]?.type === DrawerBody &&
    (elements.length === 2 || elements[2]?.type === DrawerFooter);

  if (
    nodes.length !== elements.length ||
    headerCount !== 1 ||
    bodyCount !== 1 ||
    footerCount > 1 ||
    elements.length !== headerCount + bodyCount + footerCount ||
    !hasValidOrder
  ) {
    throw new Error(
      'DrawerContent requires direct DrawerHeader and DrawerBody children, with an optional trailing DrawerFooter.',
    );
  }
};
