import type * as React from 'react';
import type { Menu as BaseMenu } from '@base-ui/react/menu';
import type { VariantProps } from 'class-variance-authority';

import type { dropdownMenuItemVariants } from './constants.js';

/** Native attributes and shared options for DropdownMenu.
 * @see DropdownMenu
 */
export type IDropdownMenuProps = Omit<BaseMenu.Root.Props, 'onOpenChange'> & {
  onOpenChange?: (open: boolean) => void;
};

/** Native attributes and shared options for DropdownMenuTrigger.
 * @see DropdownMenuTrigger
 */
export type IDropdownMenuTriggerProps = Omit<BaseMenu.Trigger.Props, 'nativeButton' | 'render'> & {
  asChild?: boolean;
};

/** Native attributes and shared options for DropdownMenuContent.
 * @see DropdownMenuContent
 */
export type IDropdownMenuContentProps = Omit<BaseMenu.Popup.Props, 'render'> &
  Pick<
    BaseMenu.Positioner.Props,
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
    forceMount?: BaseMenu.Portal.Props['keepMounted'];
    hideWhenDetached?: boolean;
    loop?: boolean;
    onCloseAutoFocus?: (event: Event) => void;
    onEscapeKeyDown?: (event: Event) => void;
    onFocusOutside?: (event: Event) => void;
    onInteractOutside?: (event: Event) => void;
    onPointerDownOutside?: (event: Event) => void;
    sticky?: 'partial' | 'always';
  };

/** Native attributes and shared options for DropdownMenuGroup.
 * @see DropdownMenuGroup
 */
export type IDropdownMenuGroupProps = BaseMenu.Group.Props;

/** Native attributes and shared options for DropdownMenuSelectableItem.
 * @see DropdownMenuSelectableItem
 */
export type IDropdownMenuSelectableItemProps = {
  asChild?: boolean;
  label?: string;
  onSelect?: (event: Event) => void;
  textValue?: string;
};

/** Native attributes and shared options for DropdownMenuItem.
 * @see DropdownMenuItem
 */
export type IDropdownMenuItemProps = Omit<
  BaseMenu.Item.Props,
  'label' | 'nativeButton' | 'onSelect' | 'render'
> &
  VariantProps<typeof dropdownMenuItemVariants> &
  IDropdownMenuSelectableItemProps;

/** Native attributes and shared options for DropdownMenuCheckboxItem.
 * @see DropdownMenuCheckboxItem
 */
export type IDropdownMenuCheckboxItemProps = Omit<
  BaseMenu.CheckboxItem.Props,
  | 'checked'
  | 'defaultChecked'
  | 'label'
  | 'nativeButton'
  | 'onCheckedChange'
  | 'onSelect'
  | 'render'
> &
  VariantProps<typeof dropdownMenuItemVariants> &
  IDropdownMenuSelectableItemProps & {
    checked?: boolean | 'indeterminate';
    defaultChecked?: boolean | 'indeterminate';
    onCheckedChange?: (checked: boolean) => void;
  };

/** Native attributes and shared options for DropdownMenuRadioGroup.
 * @see DropdownMenuRadioGroup
 */
export type IDropdownMenuRadioGroupProps = Omit<BaseMenu.RadioGroup.Props, 'onValueChange'> & {
  onValueChange?: (value: string) => void;
};

/** Native attributes and shared options for DropdownMenuRadioItem.
 * @see DropdownMenuRadioItem
 */
export type IDropdownMenuRadioItemProps = Omit<
  BaseMenu.RadioItem.Props,
  'label' | 'nativeButton' | 'onSelect' | 'render' | 'value'
> &
  VariantProps<typeof dropdownMenuItemVariants> &
  IDropdownMenuSelectableItemProps & {
    value: string;
  };

/** Native attributes and shared options for DropdownMenuLabel.
 * @see DropdownMenuLabel
 */
export type IDropdownMenuLabelProps = React.ComponentProps<'div'> & {
  inset?: boolean;
};

/** Native attributes and shared options for DropdownMenuSeparator.
 * @see DropdownMenuSeparator
 */
export type IDropdownMenuSeparatorProps = BaseMenu.Separator.Props;
/** Native attributes and shared options for DropdownMenuShortcut.
 * @see DropdownMenuShortcut
 */
export type IDropdownMenuShortcutProps = React.ComponentProps<'span'>;

/** Native attributes and shared options for DropdownMenuSub.
 * @see DropdownMenuSub
 */
export type IDropdownMenuSubProps = Omit<BaseMenu.SubmenuRoot.Props, 'onOpenChange'> & {
  onOpenChange?: (open: boolean) => void;
};

/** Native attributes and shared options for DropdownMenuSubTrigger.
 * @see DropdownMenuSubTrigger
 */
export type IDropdownMenuSubTriggerProps = Omit<
  BaseMenu.SubmenuTrigger.Props,
  'label' | 'nativeButton' | 'render'
> & {
  asChild?: boolean;
  inset?: boolean;
  label?: string;
  textValue?: string;
  variant?: VariantProps<typeof dropdownMenuItemVariants>['variant'];
};

/** Native attributes and shared options for DropdownMenuSubContent.
 * @see DropdownMenuSubContent
 */
export type IDropdownMenuSubContentProps = IDropdownMenuContentProps;
