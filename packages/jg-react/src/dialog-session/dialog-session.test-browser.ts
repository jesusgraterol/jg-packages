import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';

import { createDialogSession } from './dialog-session.js';
import { useDialogSession } from './dialog-session.hook.js';

afterEach(() => {
  // Vitest runs without globals here, so Testing Library can't unmount on its own
  cleanup();
  document.body.replaceChildren();
});

/**
 * Waits for two animation frames, so a focus return scheduled for the next one has run.
 * @returns A promise that resolves after them.
 */
const waitForFrames = async (): Promise<void> => {
  for (let frame = 0; frame < 2; frame += 1) {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  }
};

/**
 * Adds an element to the page.
 * @param tagName The element's tag, such as `button`.
 * @param parent Where to add it. Defaults to the body.
 * @returns The element.
 */
const addElement = <K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  parent: HTMLElement = document.body,
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tagName);
  parent.append(element);
  return element;
};

/**
 * Stands in for a dialog: takes focus while it's open, then unmounts, which leaves focus on the
 * body.
 * @returns A function that unmounts it.
 */
const showDialog = (): (() => void) => {
  const input = addElement('input');
  input.focus();
  return () => {
    input.remove();
  };
};

describe('focus return', () => {
  test('returns focus to the element the session opened from, once the dialog unmounts', async () => {
    const session = createDialogSession<string>();
    const trigger = addElement('button');
    trigger.focus();

    void session.open('first');
    const unmount = showDialog();
    session.close();
    unmount();
    await waitForFrames();

    expect(document.activeElement).toBe(trigger);
  });

  test('returns focus to an element given to open', async () => {
    const session = createDialogSession<string>();
    const trigger = addElement('button');
    addElement('button').focus();

    void session.open('first', { returnFocusTo: trigger });
    const unmount = showDialog();
    session.close();
    unmount();
    await waitForFrames();

    expect(document.activeElement).toBe(trigger);
  });

  test.each([
    [
      'removed',
      (trigger: HTMLButtonElement) => {
        trigger.remove();
      },
    ],
    [
      'disabled',
      (trigger: HTMLButtonElement) => {
        trigger.disabled = true;
      },
    ],
    [
      'inside an inert part of the page',
      (trigger: HTMLButtonElement) => {
        trigger.parentElement?.setAttribute('inert', '');
      },
    ],
  ])('leaves focus alone when the element is %s', async (_, change) => {
    const session = createDialogSession<string>();
    const container = addElement('div');
    const trigger = addElement('button', container);
    trigger.focus();

    void session.open('first');
    const unmount = showDialog();
    change(trigger);
    session.close();
    unmount();
    await waitForFrames();

    expect(document.activeElement).not.toBe(trigger);
  });

  test('leaves focus where the user moved it', async () => {
    const session = createDialogSession<string>();
    const trigger = addElement('button');
    const search = addElement('input');
    trigger.focus();

    void session.open('first');
    session.close();
    search.focus();
    await waitForFrames();

    expect(document.activeElement).toBe(search);
  });

  test('leaves focus alone while a new session is open', async () => {
    const session = createDialogSession<string>();
    const trigger = addElement('button');
    trigger.focus();

    void session.open('first');
    const unmount = showDialog();
    session.close();
    unmount();
    void session.open('second', { returnFocusTo: null });
    await waitForFrames();

    expect(document.activeElement).not.toBe(trigger);
  });

  test('leaves focus alone with restoreFocus: false', async () => {
    const session = createDialogSession<string>({ restoreFocus: false });
    const trigger = addElement('button');
    trigger.focus();

    void session.open('first');
    const unmount = showDialog();
    session.close();
    unmount();
    await waitForFrames();

    expect(document.activeElement).not.toBe(trigger);
  });

  test('takes no element to return focus to when focus is on one that is not HTML, such as an SVG', () => {
    const session = createDialogSession<string>();
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('tabindex', '0');
    document.body.append(icon);
    icon.focus();

    void session.open('first');

    expect(document.activeElement).toBe(icon);
    expect(session.getSnapshot()?.returnFocusTo).toBeNull();
  });

  test('returns focus to the element the replaced session opened from', async () => {
    const session = createDialogSession<string>();
    const trigger = addElement('button');
    trigger.focus();

    void session.open('first');
    const unmount = showDialog();
    // opened from inside the first dialog, which focus is in
    void session.open('second');
    unmount();
    session.close();
    await waitForFrames();

    expect(document.activeElement).toBe(trigger);
  });
});

describe('useDialogSession', () => {
  test('re-renders when a session opens and closes', () => {
    const session = createDialogSession<{ title: string }, boolean>();
    const { result } = renderHook(() => useDialogSession(session));
    expect(result.current).toBeNull();

    act(() => {
      void session.open({ title: 'Delete?' });
    });
    expect(result.current).toMatchObject({ id: 1, options: { title: 'Delete?' } });

    act(() => {
      session.close(true, result.current?.id);
    });
    expect(result.current).toBeNull();
  });
});
