import {
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type * as React from 'react';
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import { Radio as BaseRadio } from '@base-ui/react/radio';
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group';
import { Select as BaseSelect } from '@base-ui/react/select';
import { Switch as BaseSwitch } from '@base-ui/react/switch';
import { Check, ChevronDown, Circle } from 'lucide-react';
import { cn } from 'cnfast';

import { resolveFinalFocus } from '../../shared/final-focus/index.js';
import { isNativeButtonRender } from '../../shared/native-button-render/index.js';
import type {
  ICheckboxProps,
  IFieldDescriptionProps,
  IFieldErrorProps,
  IFieldGroupProps,
  IFieldLegendProps,
  IFieldProps,
  IFieldSetProps,
  IInputProps,
  ILabelProps,
  IRadioGroupItemProps,
  IRadioGroupProps,
  ISelectContentProps,
  ISelectItemProps,
  ISelectProps,
  ISelectTriggerProps,
  ISelectValueProps,
  ISwitchProps,
  ITextareaProps,
} from './types.js';

type ISelectDismissHandlers = {
  onEscapeKeyDown?: ((event: Event) => void) | undefined;
  onFocusOutside?: ((event: Event) => void) | undefined;
  onInteractOutside?: ((event: Event) => void) | undefined;
  onPointerDownOutside?: ((event: Event) => void) | undefined;
};

type ISelectOptionsContext = {
  setDismissHandlers: React.Dispatch<React.SetStateAction<ISelectDismissHandlers>>;
};

const COLLISION_AVOIDANCE_DISABLED = {
  side: 'none',
  align: 'none',
  fallbackAxisSide: 'none',
} as const;

const SelectOptionsContext = createContext<ISelectOptionsContext | null>(null);

const getCheckedDataState = (isActive: boolean): 'checked' | 'unchecked' =>
  isActive ? 'checked' : 'unchecked';

const getOpenDataState = (isOpen: boolean): 'open' | 'closed' => (isOpen ? 'open' : 'closed');

/**
 * Renders a vertical field wrapper for one label, control, and help text group.
 * @param props The field wrapper props.
 * @returns A React element that renders the field.
 * @example
 * import { createElement } from 'react';
 * import { Field } from 'jg-react-ui/components/form';
 * const example = createElement(Field, { children: 'Project settings' });
 */
export const Field = ({ className, ...props }: IFieldProps): React.ReactElement => (
  <div
    data-slot="field"
    className={cn('grid min-w-0 content-start gap-2', className)}
    {...props}
  />
);

/**
 * Renders a fieldset without browser default border spacing.
 * @param props The fieldset props.
 * @returns A React element that renders the fieldset.
 * @example
 * import { createElement } from 'react';
 * import { FieldSet } from 'jg-react-ui/components/form';
 * const example = createElement(FieldSet, { children: 'Project settings' });
 */
export const FieldSet = ({ className, ...props }: IFieldSetProps): React.ReactElement => (
  <fieldset
    data-slot="field-set"
    className={cn('grid min-w-0 gap-3 border-0 p-0', className)}
    {...props}
  />
);

/**
 * Renders a compact legend for grouped form controls.
 * @param props The legend props.
 * @returns A React element that renders the field legend.
 * @example
 * import { createElement } from 'react';
 * import { FieldLegend } from 'jg-react-ui/components/form';
 * const example = createElement(FieldLegend, { children: 'Project settings' });
 */
export const FieldLegend = ({ className, ...props }: IFieldLegendProps): React.ReactElement => (
  <legend
    data-slot="field-legend"
    className={cn('text-sm leading-none font-medium', className)}
    {...props}
  />
);

/**
 * Renders a vertical group for multiple fields or choices.
 * @param props The group wrapper props.
 * @returns A React element that renders the field group.
 * @example
 * import { createElement } from 'react';
 * import { FieldGroup } from 'jg-react-ui/components/form';
 * const example = createElement(FieldGroup, { children: 'Project settings' });
 */
export const FieldGroup = ({ className, ...props }: IFieldGroupProps): React.ReactElement => (
  <div
    data-slot="field-group"
    className={cn('grid min-w-0 gap-3', className)}
    {...props}
  />
);

/**
 * Renders an accessible native form label.
 * @param props The native label props.
 * @returns A React element that renders the label.
 * @example
 * import { createElement } from 'react';
 * import { Label } from 'jg-react-ui/components/form';
 * const example = createElement(Label, { htmlFor: 'project-name', children: 'Project name' });
 */
export const Label = ({ className, ...props }: ILabelProps): React.ReactElement => (
  <label
    data-slot="label"
    className={cn('text-sm leading-none font-medium', className)}
    {...props}
  />
);

/**
 * Renders the shared text input surface.
 * @param props The native input props.
 * @returns A React element that renders the input.
 * @example
 * import { createElement } from 'react';
 * import { Input } from 'jg-react-ui/components/form';
 * const example = createElement(Input, { 'aria-label': 'Project name', name: 'projectName' });
 */
export const Input = ({ className, type, ...props }: IInputProps): React.ReactElement => (
  <input
    data-slot="input"
    type={type}
    className={cn(
      'border-border bg-background shadow-inset selection:bg-primary selection:text-primary-foreground placeholder:text-secondary-foreground focus-visible:ring-foreground focus-visible:ring-offset-background aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:placeholder:text-destructive dark:bg-border/30 dark:aria-invalid:ring-destructive/40 flex h-8 pointer-coarse:min-h-11 pointer-coarse:text-base w-full min-w-0 rounded-lg border px-3 py-1 text-sm transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:border-transparent! focus-visible:shadow-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 motion-reduce:transition-none',
      className,
    )}
    {...props}
  />
);

/**
 * Provides select state through the Base UI select root.
 * @param props The Base UI select root props and public callback aliases.
 * @returns A React element that renders the select root.
 * @example
 * import { createElement } from 'react';
 * import { Select } from 'jg-react-ui/components/form';
 * const example = createElement(Select, { children: 'Project settings' });
 */
export const Select = ({
  onOpenChange,
  onValueChange,
  ...props
}: ISelectProps): React.ReactElement => {
  const [dismissHandlers, setDismissHandlers] = useState<ISelectDismissHandlers>({});
  const optionsContext = useMemo<ISelectOptionsContext>(
    () => ({
      setDismissHandlers,
    }),
    [],
  );
  const handleOpenChange = useCallback<NonNullable<BaseSelect.Root.Props<string>['onOpenChange']>>(
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

      // item activation can prevent the native event without vetoing popup closure.
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
    <SelectOptionsContext value={optionsContext}>
      <BaseSelect.Root
        data-slot="select"
        onOpenChange={handleOpenChange}
        onValueChange={(value) => {
          onValueChange?.(value ?? '');
        }}
        {...props}
      />
    </SelectOptionsContext>
  );
};

/**
 * Renders the select trigger with the shared input surface styling.
 * @param props The Base UI select trigger props and optional slot rendering flag.
 * @returns A React element that renders the select trigger.
 * @example
 * import { createElement } from 'react';
 * import { SelectTrigger } from 'jg-react-ui/components/form';
 * const example = createElement(SelectTrigger, { children: 'Project settings' });
 * @throws
 * - SelectTrigger asChild requires exactly one valid React element child.
 */
export const SelectTrigger = ({
  asChild = false,
  className,
  children,
  ...props
}: ISelectTriggerProps): React.ReactElement => (
  <BaseSelect.Trigger
    data-slot="select-trigger"
    nativeButton={!asChild || isNativeButtonRender(children)}
    render={asChild ? resolveFormRender(children, 'SelectTrigger') : undefined}
    className={cn(
      'border-border bg-background shadow-inset data-placeholder:text-secondary-foreground focus-visible:ring-foreground focus-visible:ring-offset-background aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-border/30 dark:aria-invalid:ring-destructive/40 flex h-8 pointer-coarse:min-h-11 pointer-coarse:text-base w-full min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-1 text-sm outline-none focus-visible:border-transparent! focus-visible:shadow-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-invalid:ring-3 [&>span]:truncate',
      className,
    )}
    {...props}
  >
    {asChild ? undefined : children}
    {asChild ? null : <BaseSelect.Icon render={<ChevronDown className="size-4 opacity-60" />} />}
  </BaseSelect.Trigger>
);

/**
 * Renders selected select value text or placeholder content.
 * @param props The Base UI select value props.
 * @returns A React element that renders the select value.
 * @example
 * import { createElement } from 'react';
 * import { SelectValue } from 'jg-react-ui/components/form';
 * const example = createElement(SelectValue, { children: 'Project settings' });
 * @throws
 * - SelectValue asChild requires exactly one valid React element child.
 */
export const SelectValue = ({
  asChild = false,
  children,
  ...props
}: ISelectValueProps): React.ReactElement => (
  <BaseSelect.Value
    data-slot="select-value"
    render={asChild ? resolveFormRender(children, 'SelectValue') : undefined}
    {...props}
  >
    {asChild ? undefined : children}
  </BaseSelect.Value>
);

/**
 * Renders themed select content inside a portal.
 * @param props The Base UI select popup props and public positioning options.
 * @returns A React element that renders the select content.
 * @example
 * import { createElement } from 'react';
 * import { SelectContent } from 'jg-react-ui/components/form';
 * const example = createElement(SelectContent, { children: 'Project settings' });
 * @throws
 * - SelectContent asChild requires exactly one valid React element child.
 */
export const SelectContent = ({
  align = 'start',
  alignItemWithTrigger,
  alignOffset = 0,
  arrowPadding,
  asChild = false,
  avoidCollisions,
  className,
  children,
  collisionAvoidance,
  collisionBoundary,
  collisionPadding,
  finalFocus,
  forceMount,
  hideWhenDetached = false,
  onCloseAutoFocus,
  onEscapeKeyDown,
  onFocusOutside,
  onInteractOutside,
  onPointerDownOutside,
  position = 'popper',
  side = 'bottom',
  sideOffset = 0,
  sticky,
  ...props
}: ISelectContentProps): React.ReactElement => {
  const optionsContext = useContext(SelectOptionsContext);
  const hasRegisteredContentOptions =
    Boolean(onEscapeKeyDown) ||
    Boolean(onFocusOutside) ||
    Boolean(onInteractOutside) ||
    Boolean(onPointerDownOutside);

  // forceMount and sticky remain accepted by the public API but have no matching select props.
  void forceMount;
  void sticky;

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

    return () => {
      optionsContext.setDismissHandlers({});
    };
  }, [
    onEscapeKeyDown,
    onFocusOutside,
    onInteractOutside,
    onPointerDownOutside,
    optionsContext,
    hasRegisteredContentOptions,
  ]);

  return (
    <BaseSelect.Portal>
      <BaseSelect.Positioner
        align={align}
        alignItemWithTrigger={alignItemWithTrigger ?? position !== 'popper'}
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
        <BaseSelect.Popup
          data-slot="select-content"
          finalFocus={resolveFinalFocus(finalFocus, onCloseAutoFocus)}
          render={
            asChild
              ? resolveFormRender(children, 'SelectContent')
              : (renderProps, state) => (
                  <div
                    {...renderProps}
                    data-state={getOpenDataState(state.open)}
                  />
                )
          }
          className={cn(
            'bg-background text-foreground shadow-raised data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 border-border relative z-50 max-h-80 min-w-32 origin-(--transform-origin) overflow-hidden rounded-lg border will-change-[opacity,transform] data-closed:duration-150 data-closed:ease-in data-open:duration-200 data-open:ease-out motion-reduce:data-closed:duration-0 motion-reduce:data-open:duration-0 motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none',
            className,
          )}
          {...props}
        >
          {asChild ? undefined : (
            <BaseSelect.List
              className={cn(
                'max-h-[min(20rem,var(--available-height))] scroll-py-1 overflow-y-auto overscroll-contain p-1',
                position === 'popper' && 'w-full min-w-(--anchor-width)',
              )}
            >
              {children}
            </BaseSelect.List>
          )}
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  );
};

/**
 * Renders a select option with a check indicator.
 * @param props The Base UI select item props and optional text label alias.
 * @returns A React element that renders the select item.
 * @example
 * import { createElement } from 'react';
 * import { SelectItem } from 'jg-react-ui/components/form';
 * const example = createElement(SelectItem, { value: 'personal', children: 'Personal' });
 * @throws
 * - SelectItem asChild requires exactly one valid React element child.
 */
export const SelectItem = ({
  asChild = false,
  className,
  children,
  label,
  textValue,
  ...props
}: ISelectItemProps): React.ReactElement => (
  <BaseSelect.Item
    data-slot="select-item"
    label={label ?? textValue}
    nativeButton={asChild ? isNativeButtonRender(children) : false}
    render={asChild ? resolveFormRender(children, 'SelectItem') : undefined}
    className={cn(
      'focus:bg-secondary focus:text-foreground pointer-coarse:min-h-11 pointer-coarse:text-base relative flex w-full cursor-default items-center rounded-md py-1.5 pr-8 pl-2 text-sm outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50',
      className,
    )}
    {...props}
  >
    {asChild ? undefined : (
      <>
        <span className="absolute right-2 flex size-3.5 items-center justify-center">
          <BaseSelect.ItemIndicator>
            <Check className="size-4" />
          </BaseSelect.ItemIndicator>
        </span>
        <BaseSelect.ItemText>{children}</BaseSelect.ItemText>
      </>
    )}
  </BaseSelect.Item>
);

/**
 * Renders the shared checkbox control with a checked indicator.
 * @param props The Base UI checkbox props and indeterminate checked aliases.
 * @returns A React element that renders the checkbox.
 * @example
 * import { createElement } from 'react';
 * import { Checkbox } from 'jg-react-ui/components/form';
 * const example = createElement(Checkbox, { 'aria-label': 'Receive updates' });
 * @throws
 * - Checkbox asChild requires exactly one valid React element child.
 */
export const Checkbox = ({
  asChild = false,
  checked,
  className,
  children,
  defaultChecked,
  indeterminate,
  onCheckedChange,
  ...props
}: ICheckboxProps): React.ReactElement => {
  const [isDefaultIndeterminate, setIsDefaultIndeterminate] = useState(
    defaultChecked === 'indeterminate',
  );
  return (
    <BaseCheckbox.Root
      data-slot="checkbox"
      checked={checked === 'indeterminate' ? false : checked}
      defaultChecked={defaultChecked === 'indeterminate' ? false : defaultChecked}
      indeterminate={
        indeterminate ??
        (checked === 'indeterminate' || (checked === undefined && isDefaultIndeterminate))
      }
      nativeButton={!asChild || isNativeButtonRender(children)}
      onCheckedChange={(nextChecked) => {
        setIsDefaultIndeterminate(false);
        onCheckedChange?.(nextChecked);
      }}
      render={
        asChild
          ? resolveFormRender(children, 'Checkbox')
          : (renderProps, state) => (
              <button
                {...renderProps}
                type="button"
                data-state={
                  state.indeterminate ? 'indeterminate' : getCheckedDataState(state.checked)
                }
              />
            )
      }
      className={cn(
        'peer border-border focus-visible:border-foreground focus-visible:ring-foreground/50 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-border/30 dark:data-checked:border-primary-foreground dark:data-checked:bg-primary-foreground dark:data-checked:text-primary dark:data-indeterminate:border-primary-foreground dark:data-indeterminate:bg-primary-foreground dark:data-indeterminate:text-primary dark:aria-invalid:ring-destructive/40 size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] data-disabled:cursor-not-allowed data-disabled:opacity-50 motion-reduce:transition-none',
        className,
      )}
      {...props}
    >
      {asChild ? undefined : (
        <BaseCheckbox.Indicator
          data-slot="checkbox-indicator"
          className="grid place-content-center text-current transition-none"
        >
          <Check className="size-3.5" />
        </BaseCheckbox.Indicator>
      )}
    </BaseCheckbox.Root>
  );
};

/**
 * Provides radio group state and layout.
 * @param props The Base UI radio group props and keyboard options.
 * @returns A React element that renders the radio group.
 * @example
 * import { createElement } from 'react';
 * import { RadioGroup } from 'jg-react-ui/components/form';
 * const example = createElement(RadioGroup, { children: 'Project settings' });
 */
export const RadioGroup = ({
  className,
  dir,
  loop,
  onValueChange,
  orientation,
  ...props
}: IRadioGroupProps): React.ReactElement => {
  // Base UI reads text direction from the DOM and has built-in focus wrapping.
  void dir;
  void loop;

  return (
    <BaseRadioGroup
      data-slot="radio-group"
      aria-orientation={orientation}
      className={cn('grid gap-3', className)}
      onValueChange={(value) => {
        onValueChange?.(value);
      }}
      {...props}
    />
  );
};

/**
 * Renders an individual radio option with a selected indicator.
 * @param props The Base UI radio item props.
 * @returns A React element that renders the radio group item.
 * @example
 * import { createElement } from 'react';
 * import { RadioGroupItem } from 'jg-react-ui/components/form';
 * const example = createElement(RadioGroupItem, { value: 'personal', 'aria-label': 'Personal workspace' });
 * @throws
 * - RadioGroupItem asChild requires exactly one valid React element child.
 */
export const RadioGroupItem = ({
  asChild = false,
  className,
  children,
  ...props
}: IRadioGroupItemProps): React.ReactElement => (
  <BaseRadio.Root
    data-slot="radio-group-item"
    nativeButton={!asChild || isNativeButtonRender(children)}
    render={
      asChild
        ? resolveFormRender(children, 'RadioGroupItem')
        : (renderProps, state) => (
            <button
              {...renderProps}
              type="button"
              data-state={getCheckedDataState(state.checked)}
            />
          )
    }
    className={cn(
      'border-border text-primary focus-visible:border-foreground focus-visible:ring-foreground/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-border/30 dark:text-primary-foreground dark:aria-invalid:ring-destructive/40 aspect-square size-4 shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] data-disabled:cursor-not-allowed data-disabled:opacity-50 motion-reduce:transition-none',
      className,
    )}
    {...props}
  >
    {asChild ? undefined : (
      <BaseRadio.Indicator
        data-slot="radio-group-indicator"
        className="relative flex items-center justify-center"
      >
        <Circle className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 fill-current" />
      </BaseRadio.Indicator>
    )}
  </BaseRadio.Root>
);

/**
 * Renders a binary switch control.
 * @param props The Base UI switch props and shared size variant.
 * @returns A React element that renders the switch.
 * @example
 * import { createElement } from 'react';
 * import { Switch } from 'jg-react-ui/components/form';
 * const example = createElement(Switch, { 'aria-label': 'Enable notifications' });
 * @throws
 * - Switch asChild requires exactly one valid React element child.
 */
export const Switch = ({
  asChild = false,
  className,
  children,
  onCheckedChange,
  size = 'default',
  ...props
}: ISwitchProps): React.ReactElement => (
  <BaseSwitch.Root
    data-slot="switch"
    data-size={size}
    nativeButton={!asChild || isNativeButtonRender(children)}
    onCheckedChange={(checked) => {
      onCheckedChange?.(checked);
    }}
    render={
      asChild
        ? resolveFormRender(children, 'Switch')
        : (renderProps, state) => (
            <button
              {...renderProps}
              type="button"
              data-state={getCheckedDataState(state.checked)}
            />
          )
    }
    className={cn(
      'peer group/switch focus-visible:border-foreground focus-visible:ring-foreground/50 data-checked:bg-primary data-unchecked:bg-border dark:data-checked:bg-primary-foreground dark:data-unchecked:bg-border/80 inline-flex shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] data-disabled:cursor-not-allowed data-disabled:opacity-50 data-[size=default]:h-[1.15rem] data-[size=default]:w-8 data-[size=sm]:h-3.5 data-[size=sm]:w-6 motion-reduce:transition-none',
      className,
    )}
    {...props}
  >
    {asChild ? undefined : (
      <BaseSwitch.Thumb
        data-slot="switch-thumb"
        className="bg-background dark:data-checked:bg-primary dark:data-unchecked:bg-foreground pointer-events-none block rounded-full ring-0 transition-transform motion-reduce:transition-none group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-checked:translate-x-[calc(100%-2px)] data-unchecked:translate-x-0"
      />
    )}
  </BaseSwitch.Root>
);

/**
 * Renders the shared multiline text input surface.
 * @param props The native textarea props.
 * @returns A React element that renders the textarea.
 * @example
 * import { createElement } from 'react';
 * import { Textarea } from 'jg-react-ui/components/form';
 * const example = createElement(Textarea, { 'aria-label': 'Project notes', name: 'notes' });
 */
export const Textarea = ({ className, ...props }: ITextareaProps): React.ReactElement => (
  <textarea
    data-slot="textarea"
    className={cn(
      'border-border bg-background shadow-inset placeholder:text-secondary-foreground focus-visible:ring-foreground focus-visible:ring-offset-background aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:placeholder:text-destructive dark:bg-border/30 dark:aria-invalid:ring-destructive/40 pointer-coarse:text-base field-sizing-content min-h-20 w-full min-w-0 resize-y rounded-lg border px-3 py-2 text-sm transition-colors outline-none focus-visible:border-transparent! focus-visible:shadow-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 motion-reduce:transition-none',
      className,
    )}
    {...props}
  />
);

/**
 * Renders supporting help text for a field.
 * @param props The paragraph props.
 * @returns A React element that renders the field description.
 * @example
 * import { createElement } from 'react';
 * import { FieldDescription } from 'jg-react-ui/components/form';
 * const example = createElement(FieldDescription, { children: 'Project settings' });
 */
export const FieldDescription = ({
  className,
  ...props
}: IFieldDescriptionProps): React.ReactElement => (
  <p
    data-slot="field-description"
    className={cn('text-secondary-foreground text-sm', className)}
    {...props}
  />
);

/**
 * Renders validation error text for a field.
 * @param props The paragraph props.
 * @returns A React element that renders the field error.
 * @example
 * import { createElement } from 'react';
 * import { FieldError } from 'jg-react-ui/components/form';
 * const example = createElement(FieldError, { children: 'Project settings' });
 */
export const FieldError = ({ className, ...props }: IFieldErrorProps): React.ReactElement => (
  <p
    data-slot="field-error"
    className={cn('text-destructive text-sm font-medium', className)}
    {...props}
  />
);

/**
 * Resolves the render element used by Base UI for form asChild rendering.
 * @param children The children provided by the consumer.
 * @param componentName The public component name used in the error message.
 * @returns A valid React element for Base UI's render prop.
 */
const resolveFormRender = (
  children: unknown,
  componentName:
    | 'Checkbox'
    | 'RadioGroupItem'
    | 'SelectContent'
    | 'SelectItem'
    | 'SelectTrigger'
    | 'SelectValue'
    | 'Switch',
): React.ReactElement => {
  if (!isValidElement(children)) {
    throw new Error(`${componentName} asChild requires exactly one valid React element child.`);
  }

  return children;
};
