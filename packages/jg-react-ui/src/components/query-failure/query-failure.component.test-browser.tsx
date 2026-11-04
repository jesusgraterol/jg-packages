import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { QueryFailure } from './query-failure.component.js';
import type { IQueryFailureProps } from './types.js';

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

// a read that failed, and one that didn't
const FAILED_QUERY = {
  isError: true,
  error: new Error('The sessions could not be read'),
  refetch: () => Promise.resolve(undefined),
};
const SETTLED_QUERY = { isError: false, error: null, refetch: () => Promise.resolve(undefined) };

describe('QueryFailure', () => {
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
    Reflect.deleteProperty(navigator, 'onLine');
  });

  const renderFailure = (props: IQueryFailureProps): void => {
    act(() => {
      root.render(<QueryFailure {...props} />);
    });
  };

  test('illustrates a first read that failed above the alert that retries it', () => {
    renderFailure({ presentation: 'blocking', queries: [FAILED_QUERY], className: 'mt-0' });

    const failure = container.querySelector('[data-slot="query-failure"]') as HTMLElement;
    expect(failure.querySelector('[data-illustration="error"]')).not.toBeNull();
    expect(failure.textContent).not.toContain("You're offline");
    const alert = failure.querySelector('[data-slot="query-error-alert"]') as HTMLElement;
    expect(alert.className).toContain('text-start');
    expect(alert.className).toContain('mt-0');
    expect(alert.querySelector('button')?.textContent).toContain('Retry');
  });

  test('says the browser is offline, with its own illustration', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });

    renderFailure({
      presentation: 'blocking',
      queries: [FAILED_QUERY],
      offlineMessage: 'HQ can be read again once you are back online.',
    });

    const failure = container.querySelector('[data-slot="query-failure"]') as HTMLElement;
    expect(failure.querySelector('[data-illustration="offline"]')).not.toBeNull();
    expect(failure.textContent).toContain('HQ can be read again once you are back online.');
  });

  test.each<[string, IQueryFailureProps]>([
    ['a failure that leaves data on screen', { presentation: 'retained', queries: [FAILED_QUERY] }],
    ['reads that have not failed', { presentation: 'blocking', queries: [SETTLED_QUERY] }],
  ])('shows the alert alone for %s', (_case, props) => {
    renderFailure(props);

    expect(container.querySelector('[data-slot="query-failure"]')).toBeNull();
    expect(container.querySelector('[data-illustration]')).toBeNull();
  });
});
