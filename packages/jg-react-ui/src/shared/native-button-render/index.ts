import type * as React from 'react';

const NATIVE_BUTTON_RENDER_COMPONENT_FLAG = '__jgReactUiNativeButtonRenderComponent';

type INativeButtonRenderComponent = {
  [NATIVE_BUTTON_RENDER_COMPONENT_FLAG]?: true;
};

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
