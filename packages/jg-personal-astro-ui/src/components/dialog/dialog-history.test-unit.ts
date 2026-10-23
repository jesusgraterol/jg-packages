import { describe, expect, test, vi } from 'vitest';

import { createDialogHistory } from './dialog-history.ts';
import { createDialogFixture } from './dialog.test-utils.ts';

const nativeDialog = (dialog: ReturnType<ReturnType<typeof createDialogFixture>['dialog']>) =>
  dialog as unknown as HTMLDialogElement;

describe('createDialogHistory', () => {
  test.each([null, 'primitive', 8, { index: 4, scrollY: 200 }, ['existing']])(
    'preserves %o through close and Forward without reopening',
    (base) => {
      const fixture = createDialogFixture();
      fixture.view.history.replaceState(base);
      const close = vi.fn();
      const history = createDialogHistory(fixture.window, close);
      const dialog = fixture.dialog();
      dialog.dataset['dialogMobilePresentation'] = 'fullscreen';
      history.add(nativeDialog(dialog));
      expect(fixture.historyEntries).toHaveLength(2);
      if (base !== null && !Array.isArray(base) && typeof base === 'object')
        expect(fixture.view.history.state).toMatchObject(base);
      history.remove(nativeDialog(dialog));
      expect(fixture.view.history.back).toHaveBeenCalledOnce();
      const nextOpening = vi.fn();
      history.whenReady(nextOpening);
      expect(nextOpening).not.toHaveBeenCalled();
      fixture.flushHistory();
      expect(fixture.view.history.state).toStrictEqual(base);
      expect(nextOpening).toHaveBeenCalledOnce();
      fixture.traverse(1);
      expect(fixture.view.history.state).toStrictEqual(base);
      expect(close).not.toHaveBeenCalled();
    },
  );

  test('Back closes the topmost owned dialog and preserves its parent opening', () => {
    const fixture = createDialogFixture();
    const close = vi.fn();
    const history = createDialogHistory(fixture.window, close);
    const first = fixture.dialog('first');
    const second = fixture.dialog('second');
    first.dataset['dialogMobilePresentation'] = 'fullscreen';
    second.dataset['dialogMobilePresentation'] = 'fullscreen';
    history.add(nativeDialog(first));
    history.add(nativeDialog(second));
    fixture.traverse(-1);
    expect(close).toHaveBeenCalledExactlyOnceWith(second);
    history.remove(nativeDialog(second));
    expect(fixture.view.history.back).not.toHaveBeenCalled();
    fixture.traverse(-1);
    expect(close).toHaveBeenLastCalledWith(first);
  });

  test('ignores default floating dialogs and fullscreen dialogs on a desktop', () => {
    const fixture = createDialogFixture();
    const history = createDialogHistory(fixture.window, vi.fn());
    const dialog = fixture.dialog();
    history.add(nativeDialog(dialog));
    dialog.dataset['dialogMobilePresentation'] = 'fullscreen';
    fixture.view.isPhone = false;
    history.add(nativeDialog(dialog));
    history.remove(nativeDialog(dialog));
    history.clear();
    const open = vi.fn();
    history.whenReady(open);
    expect(open).toHaveBeenCalledOnce();
    expect(fixture.view.history.pushState).not.toHaveBeenCalled();
  });

  test('never consumes a newer unrelated entry and clears resources without traversing', () => {
    const fixture = createDialogFixture();
    const close = vi.fn();
    const history = createDialogHistory(fixture.window, close);
    const dialog = fixture.dialog();
    dialog.dataset['dialogMobilePresentation'] = 'fullscreen';
    history.add(nativeDialog(dialog));
    fixture.view.history.pushState({ external: true }, '');
    history.remove(nativeDialog(dialog));
    history.clear();
    expect(fixture.view.history.back).not.toHaveBeenCalled();
    expect(fixture.view.history.state).toStrictEqual({ external: true });
    fixture.traverse(-1);
    expect(close).not.toHaveBeenCalled();
    expect(fixture.view.history.state).toBe(null);
  });

  test('navigation clears current markers, pending openings, and active ownership', () => {
    const fixture = createDialogFixture();
    const close = vi.fn();
    const history = createDialogHistory(fixture.window, close);
    const dialog = fixture.dialog();
    dialog.dataset['dialogMobilePresentation'] = 'fullscreen';
    history.add(nativeDialog(dialog));
    history.clear();
    expect(fixture.view.history.state).toBe(null);
    history.add(nativeDialog(dialog));
    history.remove(nativeDialog(dialog));
    const open = vi.fn();
    history.whenReady(open);
    history.clear();
    fixture.flushHistory();
    expect(open).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  test.each([
    {},
    { __jgPersonalAstroDialog: null },
    { __jgPersonalAstroDialog: 2 },
    { __jgPersonalAstroDialog: {} },
    { __jgPersonalAstroDialog: { token: 'x' } },
    { __jgPersonalAstroDialog: { token: 'x', url: 'url' } },
  ])('ignores malformed state %o', (state) => {
    const fixture = createDialogFixture();
    fixture.view.history.replaceState(state);
    const history = createDialogHistory(fixture.window, vi.fn());
    history.clear();
    expect(fixture.emitView('popstate').stopImmediatePropagation).not.toHaveBeenCalled();
    expect(fixture.view.history.state).toStrictEqual(state);
  });

  test('lets cross-page navigation propagate while closing owned dialogs', () => {
    const fixture = createDialogFixture();
    const close = vi.fn();
    const history = createDialogHistory(fixture.window, close);
    const dialog = fixture.dialog();
    dialog.dataset['dialogMobilePresentation'] = 'fullscreen';
    history.add(nativeDialog(dialog));
    fixture.view.location.href = 'https://example.com/another/';
    expect(fixture.emitView('popstate').stopImmediatePropagation).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledExactlyOnceWith(dialog);
    history.remove(nativeDialog(dialog));
    expect(fixture.view.history.back).not.toHaveBeenCalled();
  });
});
