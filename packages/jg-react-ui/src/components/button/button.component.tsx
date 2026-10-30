import * as React from 'react';
import { Button as BaseButton } from '@base-ui/react/button';
import { prettifyBadgeCount } from 'jg-utilities';
import { cn } from 'cnfast';

import { markNativeButtonRenderComponent } from '../../shared/native-button-render/index.js';
import {
  BUTTON_BADGE_CLASS_NAME,
  BUTTON_BADGE_DEFAULT_MAX_VALUE,
  BUTTON_BADGE_LOCATION_CLASS_NAMES,
  BUTTON_BADGE_THEME_CLASS_NAMES,
  buttonVariants,
} from './constants.js';
import type { IButtonProps } from './types.js';

type IBaseButtonInternalProps = Omit<
  React.ComponentProps<typeof BaseButton>,
  'children' | 'className' | 'data-size' | 'data-slot' | 'data-variant' | 'nativeButton' | 'render'
>;

/**
 * Renders the shared command button or passes its styles to a child element.
 * @param props The button props, visual variant, size, badge options, and slot rendering flag.
 * @returns A React element that renders the button surface.
 * @example
 * import { createElement } from 'react';
 * import { Button } from 'jg-react-ui/components/button';
 * const action = createElement(Button, { size: 'touch' }, 'Save changes');
 * @throws
 * - Button asChild requires exactly one valid React element child.
 */
export const Button = markNativeButtonRenderComponent(
  ({
    className,
    variant = 'default',
    size = 'default',
    asChild = false,
    badgeCount,
    badgeLocation = 'top-right',
    badgeTheme = 'primary',
    children,
    maxValue = BUTTON_BADGE_DEFAULT_MAX_VALUE,
    ...props
  }: IButtonProps): React.ReactElement => {
    const shouldRenderBadge = typeof badgeCount === 'number' && badgeCount > 0;
    const badgeLabel = shouldRenderBadge ? prettifyBadgeCount(badgeCount, maxValue) : undefined;
    const componentClassName = cn(
      buttonVariants({ variant, size, className }),
      badgeLabel ? 'relative overflow-visible' : null,
    );
    const badgeElement =
      badgeLabel === undefined ? null : (
        <span
          data-location={badgeLocation}
          data-slot="button-badge"
          data-theme={badgeTheme}
          className={cn(
            BUTTON_BADGE_CLASS_NAME,
            BUTTON_BADGE_LOCATION_CLASS_NAMES[badgeLocation],
            BUTTON_BADGE_THEME_CLASS_NAMES[badgeTheme],
          )}
        >
          {badgeLabel}
        </span>
      );
    const buttonRender = asChild ? resolveButtonRender(children, badgeElement) : undefined;
    const baseButtonProps = props as IBaseButtonInternalProps;

    return (
      <BaseButton
        data-slot="button"
        data-variant={variant}
        data-size={size}
        nativeButton={!asChild}
        render={buttonRender}
        className={componentClassName}
        {...baseButtonProps}
      >
        {asChild ? undefined : children}
        {asChild ? undefined : badgeElement}
      </BaseButton>
    );
  },
);

/**
 * Resolves the render element used by Base UI for Button asChild rendering.
 * @param children The button children passed by the consumer.
 * @param badgeElement The optional badge element to append inside the child.
 * @returns A valid React element for Base UI's render prop.
 * @throws
 * - Button asChild requires exactly one valid React element child.
 */
const resolveButtonRender = (
  children: React.ReactNode,
  badgeElement: React.ReactElement | null,
): React.ReactElement => {
  if (!React.isValidElement<{ children?: React.ReactNode }>(children)) {
    throw new Error('Button asChild requires exactly one valid React element child.');
  }

  if (badgeElement === null) {
    return children;
  }

  return React.cloneElement(
    children,
    undefined,
    <>
      {children.props.children}
      {badgeElement}
    </>,
  );
};
