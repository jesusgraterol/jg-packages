import {
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type * as React from 'react';
import { Menu as BaseMenu } from '@base-ui/react/menu';
import type { BaseUIEvent } from '@base-ui/react/types';
import { Check, ChevronRight } from 'lucide-react';
import { cn } from 'cnfast';

import { resolveFinalFocus } from '../../shared/final-focus/index.js';
import { isNativeButtonRender } from '../../shared/native-button-render/index.js';
import { dropdownMenuItemVariants } from './constants.js';
import type {
  IDropdownMenuCheckboxItemProps,
  IDropdownMenuContentProps,
  IDropdownMenuGroupProps,
  IDropdownMenuItemProps,
  IDropdownMenuLabelProps,
  IDropdownMenuProps,
  IDropdownMenuRadioGroupProps,
  IDropdownMenuRadioItemProps,
  IDropdownMenuSeparatorProps,
  IDropdownMenuShortcutProps,
  IDropdownMenuSubContentProps,
  IDropdownMenuSubProps,
  IDropdownMenuSubTriggerProps,
  IDropdownMenuTriggerProps,
} from './types.js';

type IDropdownMenuDismissHandlers = {
  onEscapeKeyDown?: ((event: Event) => void) | undefined;
  onFocusOutside?: ((event: Event) => void) | undefined;
  onInteractOutside?: ((event: Event) => void) | undefined;
  onPointerDownOutside?: ((event: Event) => void) | undefined;
};

type IDropdownMenuOptionsContext = {
  closeMenu: () => void;
  setDismissHandlers: React.Dispatch<React.SetStateAction<IDropdownMenuDismissHandlers>>;
  setLoopFocus: React.Dispatch<React.SetStateAction<boolean | undefined>>;
};

const COLLISION_AVOIDANCE_DISABLED = {
  side: 'none',
  align: 'none',
  fallbackAxisSide: 'none',
} as const;

const DropdownMenuOptionsContext = createContext<IDropdownMenuOptionsContext | null>(null);

const getOpenDataState = (isOpen: boolean): 'open' | 'closed' => (isOpen ? 'open' : 'closed');

/**
 * Provides dropdown menu root state and positioning context.
 * @param props The Base UI menu root props and public callback aliases.
 * @returns A React element that renders the dropdown menu root.
 * @example
 * import { createElement } from 'react';
 * import { DropdownMenu } from 'jg-react-ui/components/dropdown-menu';
 * const example = createElement(DropdownMenu, { children: 'Project settings' });
 */
export const DropdownMenu = ({
  actionsRef,
  loopFocus,
  onOpenChange,
  ...props
}: IDropdownMenuProps): React.ReactElement => {
  const internalActionsReference = useRef<BaseMenu.Root.Actions | null>(null);
  const menuActionsReference = actionsRef ?? internalActionsReference;
  const [dismissHandlers, setDismissHandlers] = useState<IDropdownMenuDismissHandlers>({});
  const [contentLoopFocus, setLoopFocus] = useState<boolean | undefined>();
  const closeMenu = useCallback(() => {
    menuActionsReference.current?.close();
  }, [menuActionsReference]);
  const optionsContext = useMemo<IDropdownMenuOptionsContext>(
    () => ({
      closeMenu,
      setDismissHandlers,
      setLoopFocus,
    }),
    [closeMenu],
  );
  const handleOpenChange = useCallback<NonNullable<BaseMenu.Root.Props['onOpenChange']>>(
    (open, eventDetails) => {
      if (!open && eventDetails.reason === 'escape-key') {
        dismissHandlers.onEscapeKeyDown?.(eventDetails.event);
      }

      if (!open && eventDetails.reason === 'outside-press') {
        dismissHandlers.onPointerDownOutside?.(eventDetails.event);
        dismissHandlers.onInteractOutside?.(eventDetails.event);
      }

      if (!open && eventDetails.reason === 'focus-out') {
        dismissHandlers.onFocusOutside?.(eventDetails.event);
        dismissHandlers.onInteractOutside?.(eventDetails.event);
      }

      // only a consumer-cancelled dismissal should veto closure after item activation.
      if (
        !open &&
        (eventDetails.reason === 'escape-key' ||
          eventDetails.reason === 'outside-press' ||
          eventDetails.reason === 'focus-out') &&
        eventDetails.event.defaultPrevented
      ) {
        eventDetails.cancel();

        return;
      }

      onOpenChange?.(open);
    },
    [dismissHandlers, onOpenChange],
  );

  return (
    <DropdownMenuOptionsContext value={optionsContext}>
      <BaseMenu.Root
        data-slot="dropdown-menu"
        actionsRef={menuActionsReference}
        loopFocus={loopFocus ?? contentLoopFocus ?? false}
        onOpenChange={handleOpenChange}
        {...props}
      />
    </DropdownMenuOptionsContext>
  );
};

/**
 * Renders the interactive element that opens the dropdown menu.
 * @param props The Base UI menu trigger props and optional slot rendering flag.
 * @returns A React element that renders the dropdown menu trigger.
 * @example
 * import { createElement } from 'react';
 * import { DropdownMenuTrigger } from 'jg-react-ui/components/dropdown-menu';
 * const example = createElement(DropdownMenuTrigger, { children: 'Project settings' });
 * @throws
 * - DropdownMenuTrigger asChild requires exactly one valid React element child.
 */
export const DropdownMenuTrigger = ({
  asChild = false,
  children,
  ...props
}: IDropdownMenuTriggerProps): React.ReactElement => (
  <BaseMenu.Trigger
    data-slot="dropdown-menu-trigger"
    nativeButton={!asChild || isNativeButtonRender(children)}
    render={asChild ? resolveDropdownMenuRender(children, 'DropdownMenuTrigger') : undefined}
    {...props}
  >
    {asChild ? undefined : children}
  </BaseMenu.Trigger>
);

/**
 * Renders themed dropdown menu content inside a portal.
 * @param props The Base UI menu popup props and public positioning options.
 * @returns A React element that renders the dropdown menu content.
 * @example
 * import { createElement } from 'react';
 * import { DropdownMenuContent } from 'jg-react-ui/components/dropdown-menu';
 * const example = createElement(DropdownMenuContent, { children: 'Project settings' });
 * @throws
 * - DropdownMenuContent asChild requires exactly one valid React element child.
 */
export const DropdownMenuContent = ({
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
  finalFocus,
  forceMount,
  hideWhenDetached = false,
  loop,
  onCloseAutoFocus,
  onEscapeKeyDown,
  onFocusOutside,
  onInteractOutside,
  onPointerDownOutside,
  side = 'bottom',
  sideOffset = 4,
  ...props
}: IDropdownMenuContentProps): React.ReactElement => {
  const optionsContext = useContext(DropdownMenuOptionsContext);
  const hasRegisteredContentOptions =
    loop !== undefined ||
    Boolean(onEscapeKeyDown) ||
    Boolean(onFocusOutside) ||
    Boolean(onInteractOutside) ||
    Boolean(onPointerDownOutside);

  useEffect(() => {
    if (!optionsContext || !hasRegisteredContentOptions) {
      return undefined;
    }

    optionsContext.setDismissHandlers({
      onEscapeKeyDown,
      onFocusOutside,
      onInteractOutside,
      onPointerDownOutside,
    });
    optionsContext.setLoopFocus(loop);

    return () => {
      optionsContext.setDismissHandlers({});
      optionsContext.setLoopFocus(undefined);
    };
  }, [
    loop,
    onEscapeKeyDown,
    onFocusOutside,
    onInteractOutside,
    onPointerDownOutside,
    optionsContext,
    hasRegisteredContentOptions,
  ]);

  return (
    <BaseMenu.Portal keepMounted={forceMount}>
      <BaseMenu.Positioner
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
        <BaseMenu.Popup
          data-slot="dropdown-menu-content"
          finalFocus={resolveFinalFocus(finalFocus, onCloseAutoFocus)}
          render={
            asChild
              ? resolveDropdownMenuRender(children, 'DropdownMenuContent')
              : (renderProps, state) => (
                  <div
                    {...renderProps}
                    data-state={getOpenDataState(state.open)}
                  />
                )
          }
          className={cn(
            'bg-background text-foreground shadow-raised data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 border-border z-50 max-h-[min(20rem,var(--available-height))] min-w-48 max-w-(--available-width) origin-(--transform-origin) overflow-x-hidden overflow-y-auto overscroll-contain rounded-lg border p-1 will-change-[opacity,transform] outline-none data-closed:duration-150 data-closed:ease-in data-open:duration-200 data-open:ease-out motion-reduce:animate-none motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none',
            className,
          )}
          {...props}
        >
          {asChild ? undefined : children}
        </BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  );
};

/**
 * Groups related dropdown menu items.
 * @param props The Base UI menu group props.
 * @returns A React element that renders the dropdown menu group.
 * @example
 * import { createElement } from 'react';
 * import { DropdownMenuGroup } from 'jg-react-ui/components/dropdown-menu';
 * const example = createElement(DropdownMenuGroup, { children: 'Project settings' });
 */
export const DropdownMenuGroup = ({ ...props }: IDropdownMenuGroupProps): React.ReactElement => (
  <BaseMenu.Group
    data-slot="dropdown-menu-group"
    {...props}
  />
);

/**
 * Renders a selectable dropdown menu item.
 * @param props The menu item props and optional item variant settings.
 * @returns A React element that renders the dropdown menu item.
 * @example
 * import { createElement } from 'react';
 * import { DropdownMenuItem } from 'jg-react-ui/components/dropdown-menu';
 * const example = createElement(DropdownMenuItem, { children: 'Project settings' });
 * @throws
 * - DropdownMenuItem asChild requires exactly one valid React element child.
 */
export const DropdownMenuItem = ({
  asChild = false,
  className,
  children,
  closeOnClick,
  inset,
  label,
  onClick,
  onSelect,
  textValue,
  variant,
  ...props
}: IDropdownMenuItemProps): React.ReactElement => {
  const optionsContext = useContext(DropdownMenuOptionsContext);

  return (
    <BaseMenu.Item
      data-slot="dropdown-menu-item"
      closeOnClick={onSelect ? false : closeOnClick}
      label={label ?? textValue}
      nativeButton={asChild ? isNativeButtonRender(children) : false}
      onClick={(event) => {
        handleItemSelect(
          event,
          onClick ? () => onClick(event) : undefined,
          onSelect,
          closeOnClick,
          optionsContext?.closeMenu,
        );
      }}
      render={asChild ? resolveDropdownMenuRender(children, 'DropdownMenuItem') : undefined}
      className={cn(dropdownMenuItemVariants({ inset, variant }), className)}
      {...props}
    >
      {asChild ? undefined : children}
    </BaseMenu.Item>
  );
};

/**
 * Renders a dropdown menu checkbox item with a check indicator.
 * @param props The checkbox item props and optional item variant settings.
 * @returns A React element that renders the dropdown menu checkbox item.
 * @example
 * import { createElement } from 'react';
 * import { DropdownMenuCheckboxItem } from 'jg-react-ui/components/dropdown-menu';
 * const example = createElement(DropdownMenuCheckboxItem, { children: 'Project settings' });
 * @throws
 * - DropdownMenuCheckboxItem asChild requires exactly one valid React element child.
 */
export const DropdownMenuCheckboxItem = ({
  asChild = false,
  checked,
  className,
  children,
  closeOnClick,
  defaultChecked,
  label,
  onCheckedChange,
  onClick,
  onSelect,
  textValue,
  variant,
  ...props
}: IDropdownMenuCheckboxItemProps): React.ReactElement => {
  const optionsContext = useContext(DropdownMenuOptionsContext);

  return (
    <BaseMenu.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      checked={checked === 'indeterminate' ? false : checked}
      closeOnClick={onSelect ? false : (closeOnClick ?? true)}
      defaultChecked={defaultChecked === 'indeterminate' ? false : defaultChecked}
      label={label ?? textValue}
      nativeButton={asChild ? isNativeButtonRender(children) : false}
      onCheckedChange={(nextChecked) => {
        onCheckedChange?.(nextChecked);
      }}
      onClick={(event) => {
        handleItemSelect(
          event,
          onClick ? () => onClick(event) : undefined,
          onSelect,
          closeOnClick ?? true,
          optionsContext?.closeMenu,
        );
      }}
      render={asChild ? resolveDropdownMenuRender(children, 'DropdownMenuCheckboxItem') : undefined}
      className={cn(dropdownMenuItemVariants({ variant }), 'pl-8', className)}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <BaseMenu.CheckboxItemIndicator>
          <Check
            aria-hidden="true"
            data-slot="dropdown-menu-checkbox-item-check"
            className="size-4"
          />
        </BaseMenu.CheckboxItemIndicator>
      </span>
      {asChild ? undefined : children}
    </BaseMenu.CheckboxItem>
  );
};

/**
 * Provides selection state for dropdown menu radio items.
 * @param props The Base UI menu radio group props.
 * @returns A React element that renders the dropdown menu radio group.
 * @example
 * import { createElement } from 'react';
 * import { DropdownMenuRadioGroup } from 'jg-react-ui/components/dropdown-menu';
 * const example = createElement(DropdownMenuRadioGroup, { children: 'Project settings' });
 */
export const DropdownMenuRadioGroup = ({
  onValueChange,
  ...props
}: IDropdownMenuRadioGroupProps): React.ReactElement => (
  <BaseMenu.RadioGroup
    data-slot="dropdown-menu-radio-group"
    onValueChange={(value) => {
      if (typeof value === 'string') {
        onValueChange?.(value);
      }
    }}
    {...props}
  />
);

/**
 * Renders a dropdown menu radio item with a selection indicator.
 * @param props The radio item props and optional item variant settings.
 * @returns A React element that renders the dropdown menu radio item.
 * @example
 * import { createElement } from 'react';
 * import { DropdownMenuRadioItem } from 'jg-react-ui/components/dropdown-menu';
 * const example = createElement(DropdownMenuRadioItem, { value: 'personal', children: 'Personal' });
 * @throws
 * - DropdownMenuRadioItem asChild requires exactly one valid React element child.
 */
export const DropdownMenuRadioItem = ({
  asChild = false,
  className,
  children,
  closeOnClick,
  label,
  onClick,
  onSelect,
  textValue,
  variant,
  ...props
}: IDropdownMenuRadioItemProps): React.ReactElement => {
  const optionsContext = useContext(DropdownMenuOptionsContext);

  return (
    <BaseMenu.RadioItem
      data-slot="dropdown-menu-radio-item"
      closeOnClick={onSelect ? false : (closeOnClick ?? true)}
      label={label ?? textValue}
      nativeButton={asChild ? isNativeButtonRender(children) : false}
      onClick={(event) => {
        handleItemSelect(
          event,
          onClick ? () => onClick(event) : undefined,
          onSelect,
          closeOnClick ?? true,
          optionsContext?.closeMenu,
        );
      }}
      render={asChild ? resolveDropdownMenuRender(children, 'DropdownMenuRadioItem') : undefined}
      className={cn(dropdownMenuItemVariants({ variant }), 'pl-8', className)}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <BaseMenu.RadioItemIndicator>
          <Check
            aria-hidden="true"
            data-slot="dropdown-menu-radio-item-check"
            className="size-4"
          />
        </BaseMenu.RadioItemIndicator>
      </span>
      {asChild ? undefined : children}
    </BaseMenu.RadioItem>
  );
};

/**
 * Renders a non-interactive dropdown menu label.
 * @param props The label props and optional inset alignment.
 * @returns A React element that renders the dropdown menu label.
 * @example
 * import { createElement } from 'react';
 * import { DropdownMenuLabel } from 'jg-react-ui/components/dropdown-menu';
 * const example = createElement(DropdownMenuLabel, { children: 'Project settings' });
 */
export const DropdownMenuLabel = ({
  className,
  inset,
  ...props
}: IDropdownMenuLabelProps): React.ReactElement => (
  <div
    data-slot="dropdown-menu-label"
    role="presentation"
    className={cn('text-foreground px-2 py-1.5 text-sm font-semibold', inset && 'pl-8', className)}
    {...props}
  />
);

/**
 * Renders a visual divider between dropdown menu groups.
 * @param props The Base UI menu separator props.
 * @returns A React element that renders the dropdown menu separator.
 * @example
 * import { createElement } from 'react';
 * import { DropdownMenuSeparator } from 'jg-react-ui/components/dropdown-menu';
 * const example = createElement(DropdownMenuSeparator, { children: 'Project settings' });
 */
export const DropdownMenuSeparator = ({
  className,
  ...props
}: IDropdownMenuSeparatorProps): React.ReactElement => (
  <BaseMenu.Separator
    data-slot="dropdown-menu-separator"
    className={cn('bg-border -mx-1 my-1 h-px', className)}
    {...props}
  />
);

/**
 * Renders right-aligned shortcut text for a dropdown menu item.
 * @param props The shortcut span props.
 * @returns A React element that renders the dropdown menu shortcut.
 * @example
 * import { createElement } from 'react';
 * import { DropdownMenuShortcut } from 'jg-react-ui/components/dropdown-menu';
 * const example = createElement(DropdownMenuShortcut, { children: 'Project settings' });
 */
export const DropdownMenuShortcut = ({
  className,
  ...props
}: IDropdownMenuShortcutProps): React.ReactElement => (
  <span
    data-slot="dropdown-menu-shortcut"
    className={cn('text-secondary-foreground ml-auto pl-4 text-xs tracking-normal', className)}
    {...props}
  />
);

/**
 * Provides nested dropdown menu state.
 * @param props The Base UI submenu root props and public callback aliases.
 * @returns A React element that renders the dropdown menu sub root.
 * @example
 * import { createElement } from 'react';
 * import { DropdownMenuSub } from 'jg-react-ui/components/dropdown-menu';
 * const example = createElement(DropdownMenuSub, { children: 'Project settings' });
 */
export const DropdownMenuSub = ({
  loopFocus,
  onOpenChange,
  ...props
}: IDropdownMenuSubProps): React.ReactElement => (
  <BaseMenu.SubmenuRoot
    data-slot="dropdown-menu-sub"
    loopFocus={loopFocus ?? false}
    onOpenChange={(open) => {
      onOpenChange?.(open);
    }}
    {...props}
  />
);

/**
 * Renders the trigger that opens a nested dropdown menu.
 * @param props The sub trigger props and optional item variant settings.
 * @returns A React element that renders the dropdown menu sub trigger.
 * @example
 * import { createElement } from 'react';
 * import { DropdownMenuSubTrigger } from 'jg-react-ui/components/dropdown-menu';
 * const example = createElement(DropdownMenuSubTrigger, { children: 'Project settings' });
 * @throws
 * - DropdownMenuSubTrigger asChild requires exactly one valid React element child.
 */
export const DropdownMenuSubTrigger = ({
  asChild = false,
  className,
  children,
  inset,
  label,
  textValue,
  variant,
  ...props
}: IDropdownMenuSubTriggerProps): React.ReactElement => (
  <BaseMenu.SubmenuTrigger
    data-slot="dropdown-menu-sub-trigger"
    label={label ?? textValue}
    nativeButton={asChild ? isNativeButtonRender(children) : false}
    render={asChild ? resolveDropdownMenuRender(children, 'DropdownMenuSubTrigger') : undefined}
    className={cn(dropdownMenuItemVariants({ inset, variant }), className)}
    {...props}
  >
    {asChild ? undefined : children}
    {asChild ? null : <ChevronRight className="ml-auto size-4 opacity-60" />}
  </BaseMenu.SubmenuTrigger>
);

/**
 * Renders nested dropdown menu content.
 * @param props The Base UI menu popup props and public positioning options.
 * @returns A React element that renders the dropdown menu sub content.
 * @example
 * import { createElement } from 'react';
 * import { DropdownMenuSubContent } from 'jg-react-ui/components/dropdown-menu';
 * const example = createElement(DropdownMenuSubContent, { children: 'Project settings' });
 * @throws
 * - DropdownMenuContent asChild requires exactly one valid React element child.
 */
export const DropdownMenuSubContent = ({
  align = 'start',
  className,
  side = 'inline-end',
  sideOffset = 0,
  ...props
}: IDropdownMenuSubContentProps): React.ReactElement => (
  <DropdownMenuContent
    data-slot="dropdown-menu-sub-content"
    align={align}
    side={side}
    sideOffset={sideOffset}
    className={className}
    {...props}
  />
);

/**
 * Resolves the render element used by Base UI for dropdown asChild rendering.
 * @param children The children provided by the consumer.
 * @param componentName The public component name used in the error message.
 * @returns A valid React element for Base UI's render prop.
 */
const resolveDropdownMenuRender = (
  children: React.ReactNode,
  componentName:
    | 'DropdownMenuCheckboxItem'
    | 'DropdownMenuContent'
    | 'DropdownMenuItem'
    | 'DropdownMenuRadioItem'
    | 'DropdownMenuSubTrigger'
    | 'DropdownMenuTrigger',
): React.ReactElement => {
  if (!isValidElement(children)) {
    throw new Error(`${componentName} asChild requires exactly one valid React element child.`);
  }

  return children;
};

/**
 * Runs item selection and closes the menu unless selection is canceled.
 * @param event The Base UI item click event.
 * @param onClick The consumer click callback, with its original event.
 * @param onSelect The select callback.
 * @param closeOnClick Whether the item should close after selection.
 */
const handleItemSelect = (
  event: BaseUIEvent<React.MouseEvent<HTMLElement>>,
  onClick: (() => void) | undefined,
  onSelect: ((event: Event) => void) | undefined,
  closeOnClick: boolean | undefined,
  closeMenu: (() => void) | undefined,
): void => {
  // Base UI forwards Enter/Space as an already-prevented keyboard event to onClick.
  let isSelectionPrevented =
    event.defaultPrevented && event.type !== 'keydown' && event.type !== 'keyup';
  if (onClick) {
    const preventDefault = event.preventDefault.bind(event);
    event.preventDefault = () => {
      isSelectionPrevented = true;
      preventDefault();
    };
    try {
      onClick();
    } finally {
      event.preventDefault = preventDefault;
    }
  }
  if (isSelectionPrevented || event.baseUIHandlerPrevented) {
    event.preventBaseUIHandler();
    return;
  }
  if (!onSelect) return;

  const selectEvent = new Event('select', { cancelable: true });

  onSelect(selectEvent);

  if (!selectEvent.defaultPrevented && closeOnClick !== false) {
    closeMenu?.();
  }
};
