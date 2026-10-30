import { Component } from 'react';
import type * as React from 'react';

type IRetainedModalChildrenProps = {
  children?: React.ReactNode;
  closeCompletionKey: number;
  open?: boolean | undefined;
};

type IRetainedModalChildrenState = IRetainedModalChildrenProps & {
  isCloseTransitionActive: boolean;
};

type IModalPayloadChildren = (options: { payload: unknown }) => React.ReactNode;
type IModalChildren = React.ReactNode | IModalPayloadChildren;

// controlled content remains immutable for the complete exit transition.
class RetainedModalChildren extends Component<
  IRetainedModalChildrenProps,
  IRetainedModalChildrenState
> {
  public override state: IRetainedModalChildrenState = {
    ...this.props,
    isCloseTransitionActive: false,
  };

  /**
   * Freezes the last open session until its close-completion key changes.
   * @param props The current controlled modal props.
   * @param state The previously retained session.
   * @returns The current or closing session snapshot.
   */
  public static getDerivedStateFromProps(
    props: IRetainedModalChildrenProps,
    state: IRetainedModalChildrenState,
  ): IRetainedModalChildrenState {
    if (props.open !== false || props.closeCompletionKey !== state.closeCompletionKey) {
      return {
        ...props,
        isCloseTransitionActive: false,
      };
    }

    if (state.open === true || state.isCloseTransitionActive) {
      return {
        ...state,
        open: false,
        isCloseTransitionActive: true,
      };
    }

    return {
      ...props,
      isCloseTransitionActive: false,
    };
  }

  /**
   * Renders the current retained session without adding layout wrappers.
   * @returns The session children.
   */
  public override render(): React.ReactElement {
    return <>{this.state.children}</>;
  }
}

/**
 * Retains the latest controlled modal session while Base UI completes its close transition.
 * @param children The regular or payload-rendered modal children.
 * @param open Whether the controlled modal is open, or undefined for uncontrolled roots.
 * @param closeCompletionKey A value changed after Base UI finishes the close transition.
 * @returns Children that stop accepting parent updates only during a controlled close transition.
 */
export const createRetainedModalChildren = (
  children: IModalChildren,
  open: boolean | undefined,
  closeCompletionKey: number,
): IModalChildren => {
  if (typeof children === 'function') {
    return (options) => (
      <RetainedModalChildren
        closeCompletionKey={closeCompletionKey}
        open={open}
      >
        {children(options)}
      </RetainedModalChildren>
    );
  }

  return (
    <RetainedModalChildren
      closeCompletionKey={closeCompletionKey}
      open={open}
    >
      {children}
    </RetainedModalChildren>
  );
};
