import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { LazyRouteProgress } from './index.js';

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

/**
 * Returns the rendered lazy route progress wrapper.
 * @param container The rendered test container.
 * @returns The fixed loading progress wrapper.
 */
const getProgressWrapper = (container: HTMLElement): HTMLElement => {
  const progressWrapper = container.firstElementChild;

  if (!(progressWrapper instanceof HTMLElement)) {
    throw new Error('Lazy route progress wrapper was not found.');
  }

  return progressWrapper;
};

/**
 * Returns the accessible progress bar element.
 * @param container The rendered test container.
 * @returns The progress bar element.
 */
const getProgressBar = (container: HTMLElement): HTMLElement => {
  const progressBar = container.querySelector<HTMLElement>('[role="progressbar"]');

  if (progressBar === null) {
    throw new Error('Lazy route progress bar was not found.');
  }

  return progressBar;
};

describe('LazyRouteProgress', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });

    container.remove();
  });

  test('renders an accessible fixed top indeterminate progress bar', () => {
    act(() => {
      root.render(<LazyRouteProgress />);
    });

    const progressWrapper = getProgressWrapper(container);
    const progressBar = getProgressBar(container);

    expect(progressWrapper.className).toContain('fixed');
    expect(progressWrapper.className).toContain('inset-x-0');
    expect(progressWrapper.className).toContain('top-[env(safe-area-inset-top,0px)]');
    expect(progressWrapper.className).toContain('pointer-events-none');
    expect(progressBar.getAttribute('aria-label')).toBe('Loading route');
    expect(progressBar.getAttribute('aria-valuetext')).toBe('Route content is loading');
    expect(progressBar.getAttribute('aria-valuenow')).toBe(null);
    expect(progressBar.className).toContain('h-1');
    expect(progressBar.className).toContain('rounded-none');
  });
});
