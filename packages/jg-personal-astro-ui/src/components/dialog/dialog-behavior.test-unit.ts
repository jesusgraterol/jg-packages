import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  handleDialogClick,
  handleDialogClose,
  openDialog,
  registerDialogs,
} from './dialog-behavior.ts';
import { createDialogFixture } from './dialog.test-utils.ts';

const asDialog = (dialog: ReturnType<ReturnType<typeof createDialogFixture>['dialog']>) =>
  dialog as unknown as HTMLDialogElement;
const asElement = (element: unknown) => element as Element;
const click = (target: unknown, extra: object = {}) => {
  const event = { target, button: 0, defaultPrevented: false, preventDefault: vi.fn(), ...extra };
  handleDialogClick(event as unknown as MouseEvent);
  return event;
};
const close = (dialog: ReturnType<ReturnType<typeof createDialogFixture>['dialog']>) => {
  dialog.close();
  handleDialogClose({ target: dialog } as unknown as Event);
};

afterEach(() => vi.unstubAllGlobals());

describe('dialog behavior', () => {
  test('opens a named trigger as a native modal, locks the background, and returns focus once', () => {
    const fixture = createDialogFixture();
    const dialog = fixture.dialog();
    const trigger = fixture.trigger(dialog);
    expect(click(trigger).preventDefault).toHaveBeenCalledOnce();
    expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(fixture.body.style.getPropertyValue('position')).toBe('fixed');
    openDialog(asDialog(dialog), asElement(trigger));
    expect(dialog.showModal).toHaveBeenCalledOnce();
    close(dialog);
    handleDialogClose({ target: dialog } as unknown as Event);
    expect(trigger.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    expect(fixture.body.style.length).toBe(0);
  });

  test('leaves detached dialogs closed and already-open unmanaged dialogs unchanged', () => {
    const fixture = createDialogFixture();
    const dialog = fixture.dialog();
    dialog.isConnected = false;
    openDialog(asDialog(dialog));
    dialog.isConnected = true;
    dialog.open = true;
    openDialog(asDialog(dialog));
    expect(dialog.showModal).not.toHaveBeenCalled();
    expect(fixture.body.style.length).toBe(0);
    handleDialogClose({ target: dialog } as unknown as Event);
    handleDialogClose({ target: createDialogFixture().dialog() } as unknown as Event);
  });

  test('ignores an old queued close event after the same dialog has reopened', () => {
    const fixture = createDialogFixture();
    const dialog = fixture.dialog();
    openDialog(asDialog(dialog));
    close(dialog);
    openDialog(asDialog(dialog));
    handleDialogClose({ target: dialog } as unknown as Event);
    expect(dialog.open).toBe(true);
    expect(fixture.body.style.getPropertyValue('position')).toBe('fixed');
    close(dialog);
  });

  test.each(['undefined', 'null', 'non-focusable', 'removed', 'disabled', 'hidden'] as const)(
    'uses safe main focus when the opener is %s',
    (kind) => {
      const fixture = createDialogFixture();
      const dialog = fixture.dialog();
      const trigger = fixture.trigger(dialog);
      if (kind === 'removed') trigger.isConnected = false;
      if (kind === 'disabled') trigger.setAttribute('disabled', '');
      if (kind === 'hidden') trigger.getClientRects.mockReturnValue([]);
      const opener =
        kind === 'undefined'
          ? undefined
          : kind === 'null'
            ? null
            : kind === 'non-focusable'
              ? asElement({})
              : asElement(trigger);
      openDialog(asDialog(dialog), opener);
      close(dialog);
      expect(fixture.main.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
      expect(fixture.main.hasAttribute('tabindex')).toBe(false);
    },
  );

  test('falls back to a nearby control, preserves its tab order, and supports the body as a final fallback', () => {
    const fixture = createDialogFixture();
    const dialog = fixture.dialog();
    const trigger = fixture.trigger(dialog);
    const parent = fixture.element();
    const nearby = fixture.element();
    nearby.setAttribute('tabindex', '0');
    parent.queries.set(
      'button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]',
      nearby,
    );
    trigger.parentElement = parent;
    openDialog(asDialog(dialog), asElement(trigger));
    trigger.isConnected = false;
    close(dialog);
    expect(nearby.focus).toHaveBeenCalledOnce();
    expect(nearby.attributes.get('tabindex')).toBe('0');
    nearby.getClientRects.mockReturnValue([]);
    openDialog(asDialog(dialog), asElement(trigger));
    close(dialog);
    expect(fixture.main.focus).toHaveBeenCalledOnce();
    parent.isConnected = false;
    fixture.documentQueries.delete('main');
    openDialog(asDialog(dialog), asElement(trigger));
    close(dialog);
    expect(fixture.body.focus).toHaveBeenCalledOnce();
  });

  test('closing a child retains the parent scroll lock and gives fallback focus to its title', () => {
    const fixture = createDialogFixture();
    const first = fixture.dialog('parent');
    const title = fixture.element();
    first.queries.set('[data-dialog-title]', title);
    const second = fixture.dialog('child');
    openDialog(asDialog(first));
    openDialog(asDialog(second));
    close(second);
    expect(title.focus).toHaveBeenCalledOnce();
    expect(fixture.body.style.getPropertyValue('position')).toBe('fixed');
    close(first);
    expect(fixture.body.style.length).toBe(0);
  });

  test.each([true, false])(
    'returns child focus only to an opener inside the remaining modal: %s',
    (isInside) => {
      const fixture = createDialogFixture();
      const parent = fixture.dialog('parent');
      const title = fixture.element();
      parent.queries.set('[data-dialog-title]', title);
      const child = fixture.dialog('child');
      const trigger = fixture.trigger(child);
      if (isInside) parent.queries.set('#child-trigger', trigger);
      openDialog(asDialog(parent));
      openDialog(asDialog(child), asElement(trigger));
      close(child);
      expect(trigger.focus).toHaveBeenCalledTimes(isInside ? 1 : 0);
      expect(title.focus).toHaveBeenCalledTimes(isInside ? 0 : 1);
      close(parent);
    },
  );

  test('resets the owned body before opening and resets native focus that would hide its start', () => {
    const fixture = createDialogFixture();
    const dialog = fixture.dialog();
    const body = fixture.element();
    const title = fixture.element();
    body.scrollTop = 200;
    dialog.queries.set('[data-dialog-body]', body);
    dialog.queries.set('[data-dialog-title]', title);
    dialog.showModal.mockImplementation(() => {
      expect(body.scrollTop).toBe(0);
      dialog.open = true;
      body.scrollTop = 64;
    });
    openDialog(asDialog(dialog));
    expect(body.scrollTop).toBe(0);
    expect(title.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    close(dialog);
    dialog.queries.delete('[data-dialog-title]');
    openDialog(asDialog(dialog));
    expect(body.scrollTop).toBe(0);
    close(dialog);
  });

  test.each(['valid', 'invalid', 'missing', 'nested'] as const)(
    'keeps initial focus local when a selector is %s',
    (kind) => {
      const fixture = createDialogFixture();
      const dialog = fixture.dialog();
      const target = fixture.element();
      dialog.dataset['dialogInitialFocus'] = '#choice';
      if (kind === 'valid' || kind === 'nested') {
        dialog.queries.set('#choice', target);
        target.ancestors.set('dialog', kind === 'valid' ? dialog : fixture.dialog('nested'));
      }
      if (kind === 'invalid')
        dialog.querySelector = () => {
          throw new DOMException('Invalid selector', 'SyntaxError');
        };
      if (kind === 'invalid') {
        const query = dialog.querySelector;
        dialog.querySelector = (selector) => (selector === '#choice' ? query(selector) : null);
      }
      openDialog(asDialog(dialog));
      expect(target.focus).toHaveBeenCalledTimes(kind === 'valid' ? 1 : 0);
      close(dialog);
    },
  );

  test('cleans up a failed native opening and leaves its actual failure visible', () => {
    const fixture = createDialogFixture();
    const dialog = fixture.dialog();
    const failure = new DOMException('Cannot open', 'InvalidStateError');
    dialog.showModal.mockImplementation(() => {
      throw failure;
    });
    expect(() => openDialog(asDialog(dialog))).toThrow(failure);
    expect(fixture.body.style.length).toBe(0);
    expect(fixture.view.scrollTo).toHaveBeenCalledOnce();
  });

  test('supports a document without a browsing context', () => {
    const fixture = createDialogFixture();
    fixture.root.defaultView = null;
    const dialog = fixture.dialog();
    openDialog(asDialog(dialog), null);
    close(dialog);
    expect(dialog.showModal).toHaveBeenCalledOnce();
  });

  test('registers once per document even when HTML attributes change, and uses the global document by default', () => {
    const fixture = createDialogFixture();
    vi.stubGlobal('document', fixture.document);
    registerDialogs();
    registerDialogs(fixture.document);
    fixture.bootstrap();
    expect(
      fixture.root.addEventListener.mock.calls.map(([name, , capture]) => [name, capture]),
    ).toStrictEqual([
      ['jg:dialog-history-pop', undefined],
      ['astro:before-swap', undefined],
      ['click', undefined],
      ['close', true],
    ]);
    expect(fixture.viewListeners.get('popstate')).toHaveLength(1);
    expect(fixture.viewListeners.get('pagehide')).toHaveLength(1);
  });

  test.each(['astro:before-swap', 'pagehide'])(
    'navigation %s closes all owned dialogs and releases resources without old focus',
    (event) => {
      const fixture = createDialogFixture();
      registerDialogs(fixture.document);
      const first = fixture.dialog('first');
      const second = fixture.dialog('second');
      const trigger = fixture.trigger(first);
      openDialog(asDialog(first), asElement(trigger));
      openDialog(asDialog(second));
      if (event === 'pagehide') fixture.emitView(event);
      else fixture.emitRoot(event);
      expect(first.open).toBe(false);
      expect(second.open).toBe(false);
      expect(fixture.body.style.length).toBe(0);
      expect(trigger.focus).not.toHaveBeenCalled();
    },
  );

  test('Back closes an owned phone fullscreen dialog through the real document resource path', () => {
    const fixture = createDialogFixture();
    const dialog = fixture.dialog();
    dialog.dataset['dialogMobilePresentation'] = 'fullscreen';
    const trigger = fixture.trigger(dialog);
    openDialog(asDialog(dialog), asElement(trigger));
    fixture.traverse(-1);
    expect(dialog.open).toBe(false);
    expect(fixture.body.style.length).toBe(0);
    expect(trigger.focus).toHaveBeenCalledOnce();
  });

  test('close controls always work while content and disabled backdrop dismissal leave the dialog open', () => {
    const fixture = createDialogFixture();
    const dialog = fixture.dialog();
    openDialog(asDialog(dialog));
    const content = fixture.element();
    content.ancestors.set('dialog[data-dialog]', dialog);
    click(content);
    expect(dialog.close).not.toHaveBeenCalled();
    dialog.dataset['dialogOverlayClose'] = 'false';
    click(dialog);
    expect(dialog.close).not.toHaveBeenCalled();
    const button = fixture.element();
    button.ancestors.set('dialog[data-dialog]', dialog);
    button.ancestors.set('[data-dialog-close]', button);
    click(button);
    expect(dialog.close).toHaveBeenCalledOnce();
    dialog.dataset['dialogOverlayClose'] = 'true';
    openDialog(asDialog(dialog));
    click(dialog);
    expect(dialog.close).toHaveBeenCalledTimes(2);
  });

  test.each([null, {}, { closest: () => null }])(
    'ignores unrelated targets %o and non-dialog close events',
    (target) => {
      expect(click(target).preventDefault).not.toHaveBeenCalled();
      expect(() => handleDialogClose({ target } as unknown as Event)).not.toThrow();
    },
  );

  test('ignores missing and non-dialog trigger targets, inhibited clicks, and secondary clicks', () => {
    const fixture = createDialogFixture();
    const dialog = fixture.dialog();
    const trigger = fixture.trigger(dialog);
    trigger.dataset['dialogOpen'] = 'missing';
    click(trigger);
    delete trigger.dataset['dialogOpen'];
    click(trigger);
    trigger.dataset['dialogOpen'] = 'example';
    click(trigger, { defaultPrevented: true });
    click(trigger, { button: 1 });
    expect(dialog.showModal).not.toHaveBeenCalled();
    const nativeQuery = fixture.root.getElementById;
    fixture.root.getElementById = () => ({ tagName: 'NAV' });
    click(trigger);
    fixture.root.getElementById = nativeQuery;
  });
});
