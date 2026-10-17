import { afterEach, expect, test } from 'vitest';

import { createLocalStore, createSessionStore } from './web-storage-store.js';

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

test("round-trips records through the browser's own localStorage and sessionStorage", () => {
  const settings = createLocalStore<{ theme: string }>('settings');
  const wizard = createSessionStore<number>('wizard-step');

  expect(settings.isCompatible()).toBe(true);
  settings.set(undefined, { theme: 'dark' });
  wizard.set('step', 2);

  expect(localStorage.getItem('jg-storage:settings')).toBe('{"theme":"dark"}');
  expect(sessionStorage.getItem('jg-storage:wizard-step:step')).toBe('2');
  expect(settings.get()).toStrictEqual({ theme: 'dark' });
  expect(wizard.get('step')).toBe(2);
  expect(localStorage.getItem('jg-storage-probe')).toBeNull();
});
