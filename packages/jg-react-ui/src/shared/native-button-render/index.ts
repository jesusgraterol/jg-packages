import type * as React from 'react';
import { isValidElement } from 'react';

const NATIVE_BUTTON_RENDER_COMPONENT_FLAG = '__jgReactUiNativeButtonRenderComponent';

type INativeButtonRenderComponent = {
  [NATIVE_BUTTON_RENDER_COMPONENT_FLAG]?: true;
};

type IAsChildRenderProps = { asChild?: boolean; children?: React.ReactNode };

/**
 * Marks a project component as rendering a native button unless `asChild` changes its element.
 * @param component The component that renders a native button by default.
 * @returns The same component with an internal native-button marker.
 */
export const markNativeButtonRenderComponent = <TComponent extends React.ElementType>(
  component: TComponent,
): TComponent & INativeButtonRenderComponent => {
  Object.defineProperty(component, NATIVE_BUTTON_RENDER_COMPONENT_FLAG, {
    value: true,
  });

  return component;
};

/**
 * Determines whether a slotted child ultimately renders a native button element.
 * @param children The slotted child passed to a Base UI button-like primitive.
 * @returns True when the child should be treated as a native button.
 */
export const isNativeButtonRender = (children: React.ReactNode): boolean => {
  if (!isValidElement<IAsChildRenderProps>(children)) return false;
  if (children.type === 'button') return true;
  if (isMarkedNativeButtonRenderComponent(children.type) && children.props.asChild !== true)
    return true;
  if (children.props.asChild === true) return isNativeButtonRender(children.props.children);
  return false;
};

const isMarkedNativeButtonRenderComponent = (elementType: React.ReactElement['type']): boolean =>
  typeof elementType !== 'string' &&
  (elementType as INativeButtonRenderComponent)[NATIVE_BUTTON_RENDER_COMPONENT_FLAG] === true;
