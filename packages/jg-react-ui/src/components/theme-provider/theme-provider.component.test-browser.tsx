import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { DEFAULT_UI_PREFERENCES, getUiPreferencesStorageKey } from '../../contracts/index.js';
import { UiPreferencesProvider } from '../ui-preferences-provider/index.js';
import { ThemeProvider, ThemeToggleButton, useTheme } from './index.js';
import { disableTransitionsTemporarily, resolveTheme } from './utilities.js';

const originalClass = document.documentElement.className;
const storageId = 'theme-provider-browser';

const ThemeState = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <>
      <output aria-label="Theme state">
        {theme}:{resolvedTheme}
      </output>
      <button onClick={() => setTheme('system')}>Use system theme</button>
    </>
  );
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.className = originalClass;
  localStorage.removeItem(getUiPreferencesStorageKey(storageId));
});

test('local changes apply one root class, announce the next action, and preserve callbacks', async () => {
  const requested = vi.fn();
  render(
    <UiPreferencesProvider
      mode="local"
      storageId={storageId}
      initialPreferences={{ ...DEFAULT_UI_PREFERENCES, theme: 'light' }}
    >
      <ThemeProvider disableTransitionOnChange={false}>
        <ThemeState />
        <ThemeToggleButton onThemeChangeRequested={requested} />
      </ThemeProvider>
    </UiPreferencesProvider>,
  );
  await expect.element(page.getByLabelText('Theme state')).toHaveTextContent('light:light');
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect.element(page.getByLabelText('Theme state')).toHaveTextContent('dark:dark');
  expect(document.documentElement.classList.contains('dark')).toBe(true);
  expect(document.documentElement.classList.contains('light')).toBe(false);
  expect(requested).toHaveBeenCalledExactlyOnceWith('dark');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect.element(page.getByLabelText('Theme state')).toHaveTextContent('light:light');
  expect(document.documentElement.classList.contains('dark')).toBe(false);
  await page.getByRole('button', { name: 'Use system theme' }).click();
  await expect
    .element(page.getByLabelText('Theme state'))
    .toHaveTextContent(`system:${resolveTheme('system')}`);
});

test('read-only and explicitly disabled controls cannot request a change', () => {
  const requested = vi.fn();
  const view = render(
    <ThemeProvider disableTransitionOnChange={false}>
      <ThemeToggleButton onThemeChangeRequested={requested} />
    </ThemeProvider>,
  );
  expect(screen.getByRole('button')).toBeDisabled();
  view.rerender(
    <UiPreferencesProvider
      mode="local"
      storageId={storageId}
    >
      <ThemeProvider disableTransitionOnChange={false}>
        <ThemeToggleButton
          disabled
          onThemeChangeRequested={requested}
        />
      </ThemeProvider>
    </UiPreferencesProvider>,
  );
  expect(screen.getByRole('button')).toBeDisabled();
  expect(requested).not.toHaveBeenCalled();
});

test('remote theme toggles stay disabled until their requested save settles', async () => {
  let confirm: (() => void) | undefined;
  const persisted = new Promise<void>((resolve) => {
    confirm = resolve;
  });
  render(
    <UiPreferencesProvider
      mode="remote"
      storageId={storageId}
      initialPreferences={{ ...DEFAULT_UI_PREFERENCES, theme: 'light' }}
      persistPreferences={() => persisted}
    >
      <ThemeProvider disableTransitionOnChange={false}>
        <ThemeToggleButton />
      </ThemeProvider>
    </UiPreferencesProvider>,
  );
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  expect(screen.getByRole('button')).toBeDisabled();
  await act(async () => {
    confirm?.();
    await persisted;
  });
  expect(screen.getByRole('button')).toBeEnabled();
});

test('theme transition suppression restores its owned style after two animation frames', () => {
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  const restore = disableTransitionsTemporarily();
  const style = document.head.lastElementChild;
  try {
    expect(style?.textContent).toContain('transition:none!important');
    restore();
    expect(style?.isConnected).toBe(true);
    frames.shift()?.(0);
    expect(style?.isConnected).toBe(true);
    frames.shift()?.(0);
    expect(style?.isConnected).toBe(false);
  } finally {
    style?.remove();
  }
});

test('system resolution falls back when matchMedia is unavailable', () => {
  vi.stubGlobal('matchMedia', undefined);
  try {
    expect(resolveTheme('system')).toBe('light');
  } finally {
    vi.unstubAllGlobals();
  }
});

test('default transitions apply the selected class and remove contradictory pre-paint classes', () => {
  const frames: FrameRequestCallback[] = [];
  const existingStyles = new Set(document.head.querySelectorAll('style'));
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  document.documentElement.classList.add('light', 'dark');
  try {
    render(
      <UiPreferencesProvider
        mode="local"
        storageId={storageId}
        initialPreferences={{ ...DEFAULT_UI_PREFERENCES, theme: 'dark' }}
      >
        <ThemeProvider>
          <ThemeToggleButton />
        </ThemeProvider>
      </UiPreferencesProvider>,
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(document.head.querySelectorAll('style').length).toBe(existingStyles.size + 1);
    frames.shift()?.(0);
    frames.shift()?.(0);
    expect(document.head.querySelectorAll('style').length).toBe(existingStyles.size);
  } finally {
    for (const style of document.head.querySelectorAll('style'))
      if (!existingStyles.has(style)) style.remove();
  }
});

test.each([true, false])('system resolution follows matchMedia(matches=%s)', (matches) => {
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches } as MediaQueryList);
  expect(resolveTheme('system')).toBe(matches ? 'dark' : 'light');
});
