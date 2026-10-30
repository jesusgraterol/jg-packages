import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { createErrorFeedback, Exception } from 'jg-exception';

import {
  DEFAULT_UI_PREFERENCES,
  getUiPreferencesStorageKey,
  UiPreferencesSchema,
  type IUiPreferences,
} from '../../contracts/index.js';
import { ErrorFeedbackProvider } from '../error-feedback-provider/index.js';
import { toastr } from '../toastr/index.js';

import { UiPreferencesProvider, useUiPreferences } from './index.js';

const DISMISSED_AT = '2026-10-30T00:00:00.000Z';
let storageId = '';
let sequence = 0;
const usedIds = new Set<string>();

const Controls = ({ label = 'Preferences' }: { label?: string }) => {
  const state = useUiPreferences();
  return (
    <section aria-label={label}>
      <output aria-label={label + ' snapshot'}>{JSON.stringify(state.preferences)}</output>
      <output aria-label={label + ' editable'}>{String(state.canUpdatePreferences)}</output>
      <output aria-label={label + ' pending'}>{String(state.isPreferencesUpdatePending)}</output>
      <button
        onClick={() =>
          state.updatePreferences(
            { theme: 'dark' },
            { successNotification: { title: 'Dark saved' } },
          )
        }
      >
        {label} dark
      </button>
      <button
        onClick={() =>
          state.updatePreferences(
            { prefersWrappedCode: true },
            { successNotification: { title: 'Wrapping saved' } },
          )
        }
      >
        {label} wrap
      </button>
      <button
        onClick={() => state.updatePreferences({ appInstallToastrDismissedAt: DISMISSED_AT })}
      >
        {label} dismiss install
      </button>
      <button onClick={() => state.updatePreferences({ appInstallToastrDismissedAt: null })}>
        {label} reset dismissal
      </button>
    </section>
  );
};

const readSnapshot = (label = 'Preferences'): IUiPreferences =>
  UiPreferencesSchema.parse(
    JSON.parse(screen.getByLabelText(label + ' snapshot').textContent ?? '{}'),
  );
const readFlag = (field: string, label = 'Preferences') =>
  screen.getByLabelText(label + ' ' + field).textContent;

const deferred = () => {
  let resolveOperation: (() => void) | undefined;
  let rejectOperation: ((error: unknown) => void) | undefined;
  const promise = new Promise<void>((resolve, reject) => {
    resolveOperation = resolve;
    rejectOperation = reject;
  });
  return {
    promise,
    resolve: () => resolveOperation?.(),
    reject: (error: unknown) => rejectOperation?.(error),
  };
};

beforeEach(() => {
  storageId = 'preference-test-' + sequence++;
  usedIds.add(storageId);
  window.localStorage.removeItem(getUiPreferencesStorageKey(storageId));
  vi.spyOn(toastr, 'success').mockReturnValue(0);
  vi.spyOn(toastr, 'error').mockReturnValue(0);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  for (const id of usedIds) window.localStorage.removeItem(getUiPreferencesStorageKey(id));
  usedIds.clear();
});

test('missing and read-only providers deny mutation and retain their complete defaults', async () => {
  render(<Controls label="Missing" />);
  render(
    <UiPreferencesProvider
      mode="read-only"
      storageId={storageId}
    >
      <Controls />
    </UiPreferencesProvider>,
  );
  await page.getByRole('button', { name: 'Missing dark', exact: true }).click();
  await page.getByRole('button', { name: 'Preferences dark', exact: true }).click();
  expect(readSnapshot('Missing')).toStrictEqual(DEFAULT_UI_PREFERENCES);
  expect(readSnapshot()).toStrictEqual(DEFAULT_UI_PREFERENCES);
  expect(readFlag('editable')).toBe('false');
  expect(readFlag('editable', 'Missing')).toBe('false');
  expect(window.localStorage.getItem(getUiPreferencesStorageKey(storageId))).toBeNull();
});

test.each(['split', 'unified'] as const)(
  'local mode restores the complete saved %s record and persists changes',
  async (codeDiffView) => {
    const stored = {
      theme: 'dark',
      codeDiffView,
      prefersWrappedCode: false,
      appInstallToastrDismissedAt: DISMISSED_AT,
    };
    window.localStorage.setItem(getUiPreferencesStorageKey(storageId), JSON.stringify(stored));
    render(
      <UiPreferencesProvider
        mode="local"
        storageId={storageId}
      >
        <Controls />
      </UiPreferencesProvider>,
    );
    expect(readSnapshot()).toStrictEqual(stored);
    await page.getByRole('button', { name: 'Preferences wrap', exact: true }).click();
    expect(readSnapshot()).toStrictEqual({ ...stored, prefersWrappedCode: true });
    expect(
      JSON.parse(window.localStorage.getItem(getUiPreferencesStorageKey(storageId)) ?? '{}'),
    ).toStrictEqual({ ...stored, prefersWrappedCode: true });
    expect(toastr.success).not.toHaveBeenCalled();
  },
);

test.each(['malformed', 'unavailable'] as const)(
  'local mode stays editable with %s storage',
  async (kind) => {
    if (kind === 'malformed')
      window.localStorage.setItem(getUiPreferencesStorageKey(storageId), '{invalid');
    else
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Quota unavailable', 'QuotaExceededError');
      });
    render(
      <UiPreferencesProvider
        mode="local"
        storageId={storageId}
      >
        <Controls />
      </UiPreferencesProvider>,
    );
    expect(readSnapshot()).toStrictEqual(DEFAULT_UI_PREFERENCES);
    expect(readFlag('editable')).toBe('true');
    await page.getByRole('button', { name: 'Preferences dark', exact: true }).click();
    expect(readSnapshot().theme).toBe('dark');
    expect(toastr.error).not.toHaveBeenCalled();
  },
);

test('a nullable dismissal can be cleared after it was set', async () => {
  render(
    <UiPreferencesProvider
      mode="local"
      storageId={storageId}
    >
      <Controls />
    </UiPreferencesProvider>,
  );
  await page.getByRole('button', { name: 'Preferences dismiss install', exact: true }).click();
  expect(readSnapshot().appInstallToastrDismissedAt).toBe(DISMISSED_AT);
  await page.getByRole('button', { name: 'Preferences reset dismissal', exact: true }).click();
  expect(readSnapshot().appInstallToastrDismissedAt).toBeNull();
});

test('equivalent patches do not write storage or invoke a remote adapter', async () => {
  const persist = vi.fn<(preferences: IUiPreferences) => Promise<void>>(() => Promise.resolve());
  render(
    <UiPreferencesProvider
      mode="remote"
      initialPreferences={{ ...DEFAULT_UI_PREFERENCES, theme: 'dark' }}
      persistPreferences={persist}
      storageId={storageId}
    >
      <Controls />
    </UiPreferencesProvider>,
  );
  await page.getByRole('button', { name: 'Preferences dark', exact: true }).click();
  expect(persist).not.toHaveBeenCalled();
  expect(localStorage.getItem(getUiPreferencesStorageKey(storageId))).toBeNull();
  expect(readFlag('pending')).toBe('false');
});

test('an untyped remote consumer missing its adapter cannot falsely confirm persistence', async () => {
  render(
    // @ts-expect-error JavaScript callers can omit the required persistence adapter.
    <UiPreferencesProvider
      mode="remote"
      initialPreferences={DEFAULT_UI_PREFERENCES}
      storageId={storageId}
    >
      <Controls />
    </UiPreferencesProvider>,
  );
  await page.getByRole('button', { name: 'Preferences dark', exact: true }).click();
  expect(readFlag('pending')).toBe('false');
  expect(localStorage.getItem(getUiPreferencesStorageKey(storageId))).toBeNull();
  expect(toastr.success).not.toHaveBeenCalled();
});

test('different roots stay isolated, storage IDs are captured, and keyed remounts select a new namespace', async () => {
  const firstId = storageId;
  const secondId = storageId + '-second';
  const replacementId = storageId + '-replacement';
  usedIds.add(secondId);
  usedIds.add(replacementId);
  const first = render(
    <UiPreferencesProvider
      mode="local"
      storageId={firstId}
    >
      <Controls label="First" />
    </UiPreferencesProvider>,
  );
  render(
    <UiPreferencesProvider
      mode="local"
      storageId={secondId}
    >
      <Controls label="Second" />
    </UiPreferencesProvider>,
  );
  await page.getByRole('button', { name: 'First dark', exact: true }).click();
  expect(readSnapshot('First').theme).toBe('dark');
  expect(readSnapshot('Second')).toStrictEqual(DEFAULT_UI_PREFERENCES);
  first.rerender(
    <UiPreferencesProvider
      mode="local"
      storageId={replacementId}
    >
      <Controls label="First" />
    </UiPreferencesProvider>,
  );
  expect(readSnapshot('First').theme).toBe('dark');
  expect(window.localStorage.getItem(getUiPreferencesStorageKey(replacementId))).toBeNull();
  first.rerender(
    <UiPreferencesProvider
      key="replacement"
      mode="local"
      storageId={replacementId}
    >
      <Controls label="First" />
    </UiPreferencesProvider>,
  );
  expect(readSnapshot('First')).toStrictEqual(DEFAULT_UI_PREFERENCES);
  expect(
    UiPreferencesSchema.parse(
      JSON.parse(window.localStorage.getItem(getUiPreferencesStorageKey(firstId)) ?? '{}'),
    ).theme,
  ).toBe('dark');
});

test('cross-tab events use only the captured raw key and read the real stored record', async () => {
  render(
    <UiPreferencesProvider
      mode="local"
      storageId={storageId}
    >
      <Controls />
    </UiPreferencesProvider>,
  );
  const updated = { ...DEFAULT_UI_PREFERENCES, theme: 'dark' };
  window.localStorage.setItem(getUiPreferencesStorageKey(storageId), JSON.stringify(updated));
  await act(() =>
    window.dispatchEvent(
      new StorageEvent('storage', { key: getUiPreferencesStorageKey(storageId + '-other') }),
    ),
  );
  expect(readSnapshot()).toStrictEqual(DEFAULT_UI_PREFERENCES);
  await act(() =>
    window.dispatchEvent(
      new StorageEvent('storage', { key: getUiPreferencesStorageKey(storageId) }),
    ),
  );
  expect(readSnapshot()).toStrictEqual(updated);
});

test('remote changes are ordered and coalesced, with success only for the latest confirmed revision', async () => {
  const first = deferred(),
    second = deferred();
  const persist = vi
    .fn<(preferences: IUiPreferences) => Promise<void>>()
    .mockImplementationOnce(() => first.promise)
    .mockImplementationOnce(() => second.promise);
  render(
    <UiPreferencesProvider
      mode="remote"
      initialPreferences={DEFAULT_UI_PREFERENCES}
      persistPreferences={persist}
      storageId={storageId}
    >
      <Controls />
    </UiPreferencesProvider>,
  );
  await page.getByRole('button', { name: 'Preferences dark', exact: true }).click();
  await page.getByRole('button', { name: 'Preferences wrap', exact: true }).click();
  expect(persist).toHaveBeenCalledTimes(1);
  expect(readFlag('pending')).toBe('true');
  expect(window.localStorage.getItem(getUiPreferencesStorageKey(storageId))).toBeNull();
  await act(async () => {
    first.resolve();
    await first.promise;
  });
  expect(persist).toHaveBeenCalledTimes(2);
  expect(persist.mock.calls[0]?.[0]).toStrictEqual({ ...DEFAULT_UI_PREFERENCES, theme: 'dark' });
  expect(persist.mock.calls[1]?.[0]).toStrictEqual({
    ...DEFAULT_UI_PREFERENCES,
    theme: 'dark',
    prefersWrappedCode: true,
  });
  expect(toastr.success).not.toHaveBeenCalled();
  await act(async () => {
    second.resolve();
    await second.promise;
  });
  expect(readFlag('pending')).toBe('false');
  expect(
    JSON.parse(window.localStorage.getItem(getUiPreferencesStorageKey(storageId)) ?? '{}'),
  ).toStrictEqual({ ...DEFAULT_UI_PREFERENCES, theme: 'dark', prefersWrappedCode: true });
  expect(toastr.success).toHaveBeenCalledExactlyOnceWith('Wrapping saved', {
    description: undefined,
  });
});

test('a dismissal-only remote change reaches persistence', async () => {
  const persist = vi.fn<(preferences: IUiPreferences) => Promise<void>>(() => Promise.resolve());
  render(
    <UiPreferencesProvider
      mode="remote"
      initialPreferences={DEFAULT_UI_PREFERENCES}
      persistPreferences={persist}
      storageId={storageId}
    >
      <Controls />
    </UiPreferencesProvider>,
  );
  await page.getByRole('button', { name: 'Preferences dismiss install', exact: true }).click();
  expect(persist).toHaveBeenCalledExactlyOnceWith({
    ...DEFAULT_UI_PREFERENCES,
    appInstallToastrDismissedAt: DISMISSED_AT,
  });
});

test('a remote rejection rolls back and uses operation-specific safe feedback', async () => {
  const pending = deferred();
  render(
    <UiPreferencesProvider
      mode="remote"
      initialPreferences={DEFAULT_UI_PREFERENCES}
      persistPreferences={() => pending.promise}
      storageId={storageId}
    >
      <Controls />
    </UiPreferencesProvider>,
  );
  await page.getByRole('button', { name: 'Preferences dark', exact: true }).click();
  await act(async () => {
    pending.reject(new Error('private API details'));
    await pending.promise.catch(() => undefined);
  });
  expect(readSnapshot()).toStrictEqual(DEFAULT_UI_PREFERENCES);
  expect(readFlag('pending')).toBe('false');
  expect(toastr.error).toHaveBeenCalledExactlyOnceWith('Preference update failed', {
    description: 'We could not save your preferences. Please try again.',
  });
});

test('cancellation rolls back without showing failure feedback', async () => {
  const pending = deferred();
  render(
    <UiPreferencesProvider
      mode="remote"
      initialPreferences={DEFAULT_UI_PREFERENCES}
      persistPreferences={() => pending.promise}
      storageId={storageId}
    >
      <Controls />
    </UiPreferencesProvider>,
  );
  await page.getByRole('button', { name: 'Preferences dark', exact: true }).click();
  await act(async () => {
    pending.reject(new DOMException('user cancelled', 'AbortError'));
    await pending.promise.catch(() => undefined);
  });
  expect(readSnapshot()).toStrictEqual(DEFAULT_UI_PREFERENCES);
  expect(readFlag('pending')).toBe('false');
  expect(toastr.error).not.toHaveBeenCalled();
});

test('a newer authoritative snapshot wins rollback after a remote failure', async () => {
  const pending = deferred();
  const persist = () => pending.promise;
  const view = render(
    <UiPreferencesProvider
      mode="remote"
      initialPreferences={DEFAULT_UI_PREFERENCES}
      persistPreferences={persist}
      storageId={storageId}
    >
      <Controls />
    </UiPreferencesProvider>,
  );
  await page.getByRole('button', { name: 'Preferences dark', exact: true }).click();
  const latest = { ...DEFAULT_UI_PREFERENCES, theme: 'light', prefersWrappedCode: true } as const;
  view.rerender(
    <UiPreferencesProvider
      mode="remote"
      initialPreferences={latest}
      persistPreferences={persist}
      storageId={storageId}
    >
      <Controls />
    </UiPreferencesProvider>,
  );
  await act(async () => {
    pending.reject(new Error('rejected'));
    await pending.promise.catch(() => undefined);
  });
  expect(readSnapshot()).toStrictEqual(latest);
});

test('a remote request settling after read-only mode synchronizes its latest props without feedback', async () => {
  const pending = deferred();
  const view = render(
    <UiPreferencesProvider
      mode="remote"
      initialPreferences={DEFAULT_UI_PREFERENCES}
      persistPreferences={() => pending.promise}
      storageId={storageId}
    >
      <Controls />
    </UiPreferencesProvider>,
  );
  await page.getByRole('button', { name: 'Preferences dark', exact: true }).click();
  const latest = { ...DEFAULT_UI_PREFERENCES, codeDiffView: 'unified' } as const;
  view.rerender(
    <UiPreferencesProvider
      mode="read-only"
      initialPreferences={latest}
      storageId={storageId}
    >
      <Controls />
    </UiPreferencesProvider>,
  );
  await act(async () => {
    pending.reject(new Error('old session'));
    await pending.promise.catch(() => undefined);
  });
  expect(readSnapshot()).toStrictEqual(latest);
  expect(readFlag('editable')).toBe('false');
  expect(readFlag('pending')).toBe('false');
  expect(toastr.error).not.toHaveBeenCalled();
  expect(window.localStorage.getItem(getUiPreferencesStorageKey(storageId))).toBeNull();
});

test.each(['resolve', 'reject'] as const)(
  'unmounting before %s suppresses late storage and notification side effects',
  async (outcome) => {
    const pending = deferred();
    const view = render(
      <UiPreferencesProvider
        mode="remote"
        initialPreferences={DEFAULT_UI_PREFERENCES}
        persistPreferences={() => pending.promise}
        storageId={storageId}
      >
        <Controls />
      </UiPreferencesProvider>,
    );
    await page.getByRole('button', { name: 'Preferences dark', exact: true }).click();
    view.unmount();
    await act(async () => {
      if (outcome === 'resolve') pending.resolve();
      else pending.reject(new Error('finished after unmount'));
      await pending.promise.catch(() => undefined);
    });
    expect(window.localStorage.getItem(getUiPreferencesStorageKey(storageId))).toBeNull();
    expect(toastr.error).not.toHaveBeenCalled();
    expect(toastr.success).not.toHaveBeenCalled();
  },
);

test('a pending request uses the latest scoped application error policy', async () => {
  const pending = deferred();
  const persist = () => pending.promise;
  const oldResolver = createErrorFeedback({
    fallbackMessage: 'Old policy.',
    messagesByCode: { UNKNOWN_APP_ERROR: 'Old authored policy.' },
  });
  const nextResolver = createErrorFeedback({
    fallbackMessage: 'New policy.',
    messagesByCode: { UNKNOWN_APP_ERROR: 'New authored policy.' },
  });
  const tree = (resolver: typeof oldResolver) => (
    <ErrorFeedbackProvider resolveErrorFeedback={resolver}>
      <UiPreferencesProvider
        mode="remote"
        initialPreferences={DEFAULT_UI_PREFERENCES}
        persistPreferences={persist}
        storageId={storageId}
      >
        <Controls />
      </UiPreferencesProvider>
    </ErrorFeedbackProvider>
  );
  const view = render(tree(oldResolver));
  await page.getByRole('button', { name: 'Preferences dark', exact: true }).click();
  view.rerender(tree(nextResolver));
  await act(async () => {
    pending.reject(new Exception('private diagnostics', { code: 'UNKNOWN_APP_ERROR' }));
    await pending.promise.catch(() => undefined);
  });
  expect(toastr.error).toHaveBeenCalledExactlyOnceWith('Preference update failed', {
    description: 'New authored policy.',
  });
});

test('remote mode ignores browser storage events in favor of its authoritative snapshot', async () => {
  const preferences = { ...DEFAULT_UI_PREFERENCES, theme: 'dark' } as const;
  const persist = vi.fn<(preferences: IUiPreferences) => Promise<void>>(() => Promise.resolve());
  render(
    <UiPreferencesProvider
      mode="remote"
      initialPreferences={preferences}
      persistPreferences={persist}
      storageId={storageId}
    >
      <Controls />
    </UiPreferencesProvider>,
  );
  window.localStorage.setItem(
    getUiPreferencesStorageKey(storageId),
    JSON.stringify(DEFAULT_UI_PREFERENCES),
  );
  await act(() =>
    window.dispatchEvent(
      new StorageEvent('storage', { key: getUiPreferencesStorageKey(storageId) }),
    ),
  );
  expect(readSnapshot()).toStrictEqual(preferences);
  expect(persist).not.toHaveBeenCalled();
});
