import {
  isValidElement,
  type ComponentPropsWithRef,
  type ElementType,
  type JSX,
  type ReactElement,
  type ReactNode,
} from 'react';
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';

// intrinsic element names supported by the shared slotted render hook.
type IIntrinsicElementName = keyof JSX.IntrinsicElements;
type IMergeInputProps<TElementName extends ElementType> = Parameters<
  typeof mergeProps<TElementName>
>[0];

// options needed to render a project-owned component with asChild behavior.
type IUseSlottedRenderOptions<TElementName extends IIntrinsicElementName> = {
  asChild?: boolean;
  baseProps: ComponentPropsWithRef<TElementName>;
  defaultTagName: TElementName;
  elementProps: ComponentPropsWithRef<TElementName>;
};

/**
 * Renders an intrinsic element or clones one valid child with merged props.
 * @param options The default tag, base props, element props, and optional asChild flag.
 * @returns A React element rendered through Base UI's useRender hook.
 * @throws
 * - asChild requires exactly one valid React element child.
 */
export const useSlottedRender = <
  TElementName extends IIntrinsicElementName,
  TRenderedElement extends Element = HTMLElement,
>({
  asChild = false,
  baseProps,
  defaultTagName,
  elementProps,
}: IUseSlottedRenderOptions<TElementName>): ReactElement => {
  const { children, ...elementPropsWithoutChildren } = elementProps;
  const render = asChild ? resolveSlottedRender(children) : undefined;
  const resolvedElementProps = asChild ? elementPropsWithoutChildren : elementProps;

  return useRender<Record<string, unknown>, TRenderedElement>({
    defaultTagName,
    render,
    props: mergeProps<TElementName>(
      baseProps as IMergeInputProps<TElementName>,
      resolvedElementProps as IMergeInputProps<TElementName>,
    ),
  });
};

/**
 * Resolves the single child element used by asChild rendering.
 * @param children The component children.
 * @returns The render element passed to Base UI.
 * @throws
 * - asChild requires exactly one valid React element child.
 */
const resolveSlottedRender = (children: ReactNode): ReactElement => {
  if (!isValidElement(children)) {
    throw new Error('asChild requires exactly one valid React element child.');
  }

  return children;
};
