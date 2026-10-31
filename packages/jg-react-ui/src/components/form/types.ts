import type * as React from 'react';
import type { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import type { Radio as BaseRadio } from '@base-ui/react/radio';
import type { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group';
import type { Select as BaseSelect } from '@base-ui/react/select';
import type { Switch as BaseSwitch } from '@base-ui/react/switch';

/** Native attributes and shared options for Field.
 * @see Field
 */
export type IFieldProps = React.ComponentProps<'div'>;
/** Native attributes and shared options for FieldGroup.
 * @see FieldGroup
 */
export type IFieldGroupProps = React.ComponentProps<'div'>;
/** Native attributes and shared options for FieldLegend.
 * @see FieldLegend
 */
export type IFieldLegendProps = React.ComponentProps<'legend'>;
/** Native attributes and shared options for FieldSet.
 * @see FieldSet
 */
export type IFieldSetProps = React.ComponentProps<'fieldset'>;
/** Native attributes and shared options for Label.
 * @see Label
 */
export type ILabelProps = React.ComponentProps<'label'>;
/** Native attributes and shared options for Input.
 * @see Input
 */
export type IInputProps = React.ComponentProps<'input'>;
/** Native attributes and shared options for Textarea.
 * @see Textarea
 */
export type ITextareaProps = React.ComponentProps<'textarea'>;

/** Native attributes and shared options for Select.
 * @see Select
 */
export type ISelectProps = Omit<
  BaseSelect.Root.Props<string>,
  'defaultValue' | 'onOpenChange' | 'onValueChange' | 'value'
> & {
  defaultValue?: string;
  onOpenChange?: (open: boolean) => void;
  onValueChange?: (value: string) => void;
  // null keeps the select controlled while no option is selected, showing its placeholder
  value?: string | null;
};

/** Native attributes and shared options for SelectTrigger.
 * @see SelectTrigger
 */
export type ISelectTriggerProps = Omit<BaseSelect.Trigger.Props, 'nativeButton' | 'render'> & {
  asChild?: boolean;
};

/** Native attributes and shared options for SelectValue.
 * @see SelectValue
 */
export type ISelectValueProps = Omit<BaseSelect.Value.Props, 'render'> & {
  asChild?: boolean;
};

/** Native attributes and shared options for SelectContent.
 * @see SelectContent
 */
export type ISelectContentProps = Omit<BaseSelect.Popup.Props, 'render'> &
  Pick<
    BaseSelect.Positioner.Props,
    | 'align'
    | 'alignItemWithTrigger'
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
    forceMount?: boolean;
    hideWhenDetached?: boolean;
    onCloseAutoFocus?: (event: Event) => void;
    onEscapeKeyDown?: (event: Event) => void;
    onFocusOutside?: (event: Event) => void;
    onInteractOutside?: (event: Event) => void;
    onPointerDownOutside?: (event: Event) => void;
    position?: 'item-aligned' | 'popper';
    sticky?: 'partial' | 'always';
  };

/** Native attributes and shared options for SelectItem.
 * @see SelectItem
 */
export type ISelectItemProps = Omit<
  BaseSelect.Item.Props,
  'label' | 'nativeButton' | 'render' | 'value'
> & {
  asChild?: boolean;
  label?: string;
  textValue?: string;
  value: string;
};

/** Native attributes and shared options for Checkbox.
 * @see Checkbox
 */
export type ICheckboxProps = Omit<
  BaseCheckbox.Root.Props,
  'checked' | 'defaultChecked' | 'nativeButton' | 'onCheckedChange' | 'render'
> & {
  asChild?: boolean;
  checked?: boolean | 'indeterminate';
  defaultChecked?: boolean | 'indeterminate';
  onCheckedChange?: (checked: boolean | 'indeterminate') => void;
};

/** Native attributes and shared options for RadioGroup.
 * @see RadioGroup
 */
export type IRadioGroupProps = Omit<BaseRadioGroup.Props<string>, 'onValueChange'> & {
  dir?: 'ltr' | 'rtl';
  loop?: boolean;
  onValueChange?: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
};

/** Native attributes and shared options for RadioGroupItem.
 * @see RadioGroupItem
 */
export type IRadioGroupItemProps = Omit<
  BaseRadio.Root.Props<string>,
  'nativeButton' | 'render' | 'value'
> & {
  asChild?: boolean;
  value: string;
};

/** Native attributes and shared options for Switch.
 * @see Switch
 */
export type ISwitchProps = Omit<
  BaseSwitch.Root.Props,
  'nativeButton' | 'onCheckedChange' | 'render'
> & {
  asChild?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: 'default' | 'sm';
};

/** Native attributes and shared options for FieldDescription.
 * @see FieldDescription
 */
export type IFieldDescriptionProps = React.ComponentProps<'p'>;
/** Native attributes and shared options for FieldError.
 * @see FieldError
 */
export type IFieldErrorProps = React.ComponentProps<'p'>;
