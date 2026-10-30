import { act, cleanup, render, screen } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { DEFAULT_UI_PREFERENCES, getUiPreferencesStorageKey } from '../../contracts/index.js';
import { UiPreferencesProvider } from '../ui-preferences-provider/index.js';
import { ThemeProvider, useTheme } from '../theme-provider/index.js';
import { Toastr, toastr } from './index.js';

const originalClass = document.documentElement.className;
const storageId = 'toastr-browser';

afterEach(() => {
  toastr.dismiss();
  cleanup();
  document.documentElement.className = originalClass;
  localStorage.removeItem(getUiPreferencesStorageKey(storageId));
});

test('custom toast props merge with the theme, icon, class, and portal defaults', async () => {
  const view = render(
    <UiPreferencesProvider
      mode="read-only"
      initialPreferences={{ ...DEFAULT_UI_PREFERENCES, theme: 'dark' }}
    >
      <ThemeProvider disableTransitionOnChange={false}>
        <Toastr
          closeButton
          className="consumer-host"
          style={{ color: 'rgb(1, 2, 3)', zIndex: 1 }}
          icons={{ success: <span>Custom success icon</span> }}
          toastOptions={{
            duration: Infinity,
            classNames: { title: 'consumer-title' },
            style: { borderInlineStartColor: 'rgb(4, 5, 6)' },
          }}
        />
      </ThemeProvider>
    </UiPreferencesProvider>,
  );
  act(() => {
    toastr.success('Saved notification', { description: 'The latest snapshot is saved.' });
  });
  await expect.element(page.getByText('Saved notification', { exact: true })).toBeVisible();
  expect(screen.getByText('Custom success icon')).toBeVisible();
  expect(screen.getByText('Saved notification')).toHaveClass('consumer-title');
  const host = screen.getByRole('region', { name: /Notifications/u }).querySelector('ol');
  expect(host).toHaveAttribute('data-sonner-theme', 'dark');
  expect(host).toHaveClass('consumer-host');
  expect(host?.style.zIndex).toBe('2147483647');
  const portal = document.querySelector('[data-slot="toastr-portal"]');
  expect(portal?.parentElement).toBe(document.body);
  expect(view.container.querySelector('[data-slot="toastr-portal"]')).toBeNull();
  expect(portal).toHaveStyle({ pointerEvents: 'none', position: 'fixed' });
  expect(screen.getByText('Saved notification').closest('li')).toHaveStyle({
    borderInlineStartColor: 'rgb(4, 5, 6)',
  });
  view.unmount();
  expect(document.querySelector('[data-slot="toastr-portal"]')).toBeNull();
});

test('every built-in status icon renders and follows the current theme', async () => {
  const view = render(
    <UiPreferencesProvider
      mode="read-only"
      initialPreferences={{ ...DEFAULT_UI_PREFERENCES, theme: 'light' }}
    >
      <ThemeProvider disableTransitionOnChange={false}>
        <Toastr toastOptions={{ duration: Infinity }} />
      </ThemeProvider>
    </UiPreferencesProvider>,
  );
  for (const type of ['success', 'info', 'warning', 'error', 'loading'] as const) {
    act(() => {
      toastr[type]('Status ' + type, { id: type });
    });
    await expect.element(page.getByText('Status ' + type, { exact: true })).toBeInTheDocument();
    expect(
      screen
        .getByText('Status ' + type)
        .closest('li')
        ?.querySelector('[data-slot="icon-tile"] svg'),
    ).not.toBeNull();
  }
  view.rerender(
    <UiPreferencesProvider
      mode="read-only"
      initialPreferences={{ ...DEFAULT_UI_PREFERENCES, theme: 'dark' }}
    >
      <ThemeProvider disableTransitionOnChange={false}>
        <Toastr toastOptions={{ duration: Infinity }} />
      </ThemeProvider>
    </UiPreferencesProvider>,
  );
  await expect
    .poll(() => document.querySelector('[data-sonner-toaster]')?.getAttribute('data-sonner-theme'))
    .toBe('dark');
});

test('hydration starts from the server snapshot before applying stored preferences and the toast portal', async () => {
  const ThemeState = () => {
    const { theme } = useTheme();
    return <output aria-label="Hydrated theme">{theme}</output>;
  };
  const content = (
    <UiPreferencesProvider
      mode="local"
      storageId={storageId}
    >
      <ThemeProvider disableTransitionOnChange={false}>
        <ThemeState />
        <Toastr />
      </ThemeProvider>
    </UiPreferencesProvider>
  );
  localStorage.setItem(
    getUiPreferencesStorageKey(storageId),
    JSON.stringify({ ...DEFAULT_UI_PREFERENCES, theme: 'dark' }),
  );
  const container = document.createElement('div');
  container.innerHTML = renderToString(content);
  expect(container.textContent).toContain('system');
  document.body.appendChild(container);
  const recoverable = vi.fn();
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    act(() => {
      root = hydrateRoot(container, content, { onRecoverableError: recoverable });
    });
    await expect.element(page.getByLabelText('Hydrated theme')).toHaveTextContent('dark');
    expect(recoverable).not.toHaveBeenCalled();
    expect(document.querySelector('[data-slot="toastr-portal"]')?.parentElement).toBe(
      document.body,
    );
  } finally {
    act(() => {
      root?.unmount();
    });
    container.remove();
  }
});
