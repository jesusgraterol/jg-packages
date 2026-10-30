import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { createRetainedModalChildren } from './index.js';

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

/**
 * Resolves the shared regular-or-payload children contract for the test root.
 * @param children The session content to render.
 * @param open Whether the controlled root is open.
 * @param closeCompletionKey The current close-completion key.
 * @returns The resolved React children.
 */
const renderRetainedChildren = (
  children: ReactNode,
  open: boolean,
  closeCompletionKey: number,
): ReactNode => {
  const retainedChildren = createRetainedModalChildren(children, open, closeCompletionKey);

  return typeof retainedChildren === 'function'
    ? retainedChildren({ payload: undefined })
    : retainedChildren;
};

describe('createRetainedModalChildren', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  test('retains the complete closing session until the exit transition finishes', () => {
    act(() => root.render(renderRetainedChildren('Open session', true, 0)));
    act(() => root.render(renderRetainedChildren('Closing session', false, 0)));
    act(() => root.render(renderRetainedChildren('New route', false, 0)));

    expect(container.textContent).toBe('Open session');

    act(() => root.render(renderRetainedChildren('New route', false, 1)));

    expect(container.textContent).toBe('New route');
  });

  test('keeps idle controlled children current while the root is closed', () => {
    act(() => root.render(renderRetainedChildren('Loading', false, 0)));
    act(() => root.render(renderRetainedChildren('Ready', false, 0)));

    expect(container.textContent).toBe('Ready');
  });
});
