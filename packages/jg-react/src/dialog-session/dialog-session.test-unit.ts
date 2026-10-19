// @vitest-environment node
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';

import { createDialogSession } from './dialog-session.js';
import { useDialogSession } from './dialog-session.hook.js';

describe('createDialogSession', () => {
  test('resolves the caller with the result it closes with, or undefined without one', async () => {
    const session = createDialogSession<{ title: string }, boolean>();

    const confirmed = session.open({ title: 'Delete?' });
    expect(session.close(true)).toBe(true);
    const dismissed = session.open({ title: 'Delete again?' });
    expect(session.close()).toBe(true);

    await expect(confirmed).resolves.toBe(true);
    await expect(dismissed).resolves.toBeUndefined();
    expect(session.getSnapshot()).toBeNull();
  });

  test('gives each session one stable snapshot, with a new id', () => {
    const session = createDialogSession<{ title: string }>();

    void session.open({ title: 'First' });
    const first = session.getSnapshot();
    expect(session.getSnapshot()).toBe(first);
    void session.open({ title: 'Second' });
    const second = session.getSnapshot();

    expect(first).toStrictEqual({ id: 1, options: { title: 'First' }, returnFocusTo: null });
    expect(second).toStrictEqual({ id: 2, options: { title: 'Second' }, returnFocusTo: null });
  });

  test("resolves the open session's caller with undefined when another replaces it", async () => {
    const session = createDialogSession<string, string>();

    const first = session.open('first');
    const second = session.open('second');
    session.close('done');

    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBe('done');
  });

  test("keeps the open session with whileOpen: 'keep', resolving the new call with undefined", async () => {
    const session = createDialogSession<string, string>({ whileOpen: 'keep' });

    const first = session.open('first');
    const second = session.open('second');

    await expect(second).resolves.toBeUndefined();
    expect(session.getSnapshot()?.options).toBe('first');
    session.close('done');
    await expect(first).resolves.toBe('done');
  });

  test('closes only the session with the given id, so a stale close does nothing', async () => {
    const session = createDialogSession<string, string>();
    const first = session.open('first');
    const staleId = session.getSnapshot()?.id;
    const second = session.open('second');
    const currentId = session.getSnapshot()?.id;

    expect(session.close('stale', staleId)).toBe(false);
    expect(session.getSnapshot()?.options).toBe('second');
    expect(session.close('current', currentId)).toBe(true);

    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBe('current');
  });

  test('returns false when no session is open', () => {
    const session = createDialogSession<string>();

    expect(session.close(true)).toBe(false);
    expect(session.close(true, 1)).toBe(false);
  });

  test('notifies its subscribers when a session opens or closes, until they unsubscribe', () => {
    const session = createDialogSession<string>();
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);

    void session.open('first');
    session.close();
    session.close();
    unsubscribe();
    void session.open('second');

    expect(listener).toHaveBeenCalledTimes(2);
  });

  test('keeps a returnFocusTo of null, which returns focus nowhere', async () => {
    const session = createDialogSession<string>();

    const opened = session.open('first', { returnFocusTo: null });

    expect(session.getSnapshot()?.returnFocusTo).toBeNull();
    session.close(true);
    await expect(opened).resolves.toBe(true);
  });

  test('returns focus nowhere without a document, such as on a server', async () => {
    const session = createDialogSession<string>();
    // an element from a page the server doesn't have
    const opened = session.open('first', { returnFocusTo: {} as HTMLElement });

    expect(session.close(true)).toBe(true);
    await expect(opened).resolves.toBe(true);
  });
});

describe('useDialogSession', () => {
  test('reads no open session on the server, even while one is open', () => {
    const session = createDialogSession<{ title: string }>();
    void session.open({ title: 'Delete?' });
    const Host = () => {
      const snapshot = useDialogSession(session);
      return snapshot === null ? 'closed' : snapshot.options.title;
    };

    expect(renderToString(createElement(Host))).toBe('closed');
  });
});
