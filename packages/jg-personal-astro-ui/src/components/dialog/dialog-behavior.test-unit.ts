import { describe, expect, test, vi } from 'vitest';

import {
  handleDialogClick,
  handleDialogClose,
  openDialog,
  registerDialogs,
} from './dialog-behavior.ts';

/*
 * The dialogs' behavior against fake elements. The browser test runs it on real markup in
 * Chromium, Firefox, and WebKit, where the dialog element itself makes the page inert.
 */

// a fake dialog element, which records its showModal and close calls
type IFakeDialog = {
  open: boolean;
  showModal: () => void;
  close: () => void;
  closest: (selector: string) => unknown;
};

/**
 * Builds a fake dialog.
 * @param open Whether it starts open.
 * @returns The dialog.
 */
const createDialog = (open = false): IFakeDialog => {
  const dialog: IFakeDialog = {
    open,
    showModal: vi.fn(() => {
      dialog.open = true;
    }),
    close: vi.fn(() => {
      dialog.open = false;
    }),
    closest: (selector) => (selector === 'dialog[data-dialog]' ? dialog : null),
  };
  return dialog;
};

/**
 * Builds a fake element that sits inside the given ancestors, by the selectors that find them.
 * @param ancestors The element each selector's closest finds.
 * @param extra Properties of the element itself.
 * @returns The element.
 */
const createElement = (ancestors: Record<string, unknown>, extra: object = {}) => ({
  closest: (selector: string) => ancestors[selector] ?? null,
  ...extra,
});

/**
 * Builds a fake click on a target.
 * @param target The target.
 * @param preventDefault The click's preventDefault, such as a spy.
 * @returns The click.
 */
const createClick = (target: unknown, preventDefault: () => void = vi.fn()): MouseEvent =>
  ({ target, preventDefault }) as unknown as MouseEvent;

/**
 * Builds a trigger whose document holds the given elements by id.
 * @param dialogId The id it names in data-dialog-open, if any.
 * @param elements The document's elements by id.
 * @returns The trigger.
 */
const createTrigger = (dialogId: string | undefined, elements: Record<string, unknown>) => {
  const trigger: Record<string, unknown> = {
    dataset: dialogId === undefined ? {} : { dialogOpen: dialogId },
    focus: vi.fn(),
    isConnected: true,
    ownerDocument: { getElementById: (id: string) => elements[id] ?? null },
  };
  trigger['closest'] = (selector: string) => (selector === '[data-dialog-open]' ? trigger : null);
  return trigger;
};

describe('openDialog', () => {
  test('opens a dialog as a modal, and gives focus back to its opener when it closes', () => {
    const dialog = createDialog();
    const opener = { focus: vi.fn(), isConnected: true };

    openDialog(dialog as unknown as HTMLDialogElement, opener as unknown as Element);
    handleDialogClose({ target: dialog } as unknown as Event);

    expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(opener.focus).toHaveBeenCalledOnce();
  });

  test('leaves an open dialog as it is', () => {
    const dialog = createDialog(true);

    openDialog(dialog as unknown as HTMLDialogElement);

    expect(dialog.showModal).not.toHaveBeenCalled();
  });

  test('forgets an opener that cannot take focus, or that left the page', () => {
    const first = createDialog();
    const second = createDialog();
    const detached = { focus: vi.fn(), isConnected: false };

    openDialog(first as unknown as HTMLDialogElement, {} as Element);
    openDialog(second as unknown as HTMLDialogElement, detached as unknown as Element);
    openDialog(createDialog() as unknown as HTMLDialogElement, null);

    expect(() => handleDialogClose({ target: first } as unknown as Event)).not.toThrow();
    handleDialogClose({ target: second } as unknown as Event);
    expect(detached.focus).not.toHaveBeenCalled();
  });
});

describe('handleDialogClick', () => {
  test('opens the dialog a trigger names, and remembers the trigger', () => {
    const dialog = createDialog();
    const trigger = createTrigger('search', { search: dialog });
    const preventDefault = vi.fn();

    handleDialogClick(createClick(trigger, preventDefault));
    handleDialogClose({ target: dialog } as unknown as Event);

    expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(trigger['focus']).toHaveBeenCalledOnce();
  });

  test('ignores a trigger whose id names no dialog', () => {
    const preventDefault = vi.fn();

    handleDialogClick(createClick(createTrigger('missing', {}), preventDefault));
    handleDialogClick(
      createClick(createTrigger('menu', { menu: { tagName: 'NAV' } }), preventDefault),
    );
    handleDialogClick(createClick(createTrigger(undefined, {}), preventDefault));

    expect(preventDefault).not.toHaveBeenCalled();
  });

  test('closes a dialog from its close button, and from a click on its backdrop', () => {
    const dialog = createDialog(true);
    const closeButton = createElement({
      'dialog[data-dialog]': dialog,
      '[data-dialog-close]': {},
    });

    handleDialogClick(createClick(closeButton));
    expect(dialog.close).toHaveBeenCalledOnce();

    dialog.open = true;
    handleDialogClick(createClick(dialog));
    expect(dialog.close).toHaveBeenCalledTimes(2);
  });

  test('leaves a dialog open when its content is clicked', () => {
    const dialog = createDialog(true);

    handleDialogClick(createClick(createElement({ 'dialog[data-dialog]': dialog })));

    expect(dialog.close).not.toHaveBeenCalled();
  });

  test('ignores clicks outside dialogs, and targets that are no element', () => {
    expect(() => {
      handleDialogClick(createClick(createElement({})));
      handleDialogClick(createClick(null));
      handleDialogClick(createClick({}));
    }).not.toThrow();
  });
});

describe('handleDialogClose', () => {
  test('ignores a close event from anything but a dialog', () => {
    expect(() => handleDialogClose({ target: {} } as unknown as Event)).not.toThrow();
  });
});

describe('registerDialogs', () => {
  /**
   * Builds a fake document that records its listeners.
   * @returns The document and its listeners.
   */
  const createDocument = () => {
    const attributes = new Set<string>();
    const listeners: [string, unknown, unknown][] = [];
    const root = {
      documentElement: {
        hasAttribute: (name: string) => attributes.has(name),
        setAttribute: (name: string) => attributes.add(name),
      },
      addEventListener: (type: string, listener: unknown, options: unknown) => {
        listeners.push([type, listener, options]);
      },
    };
    return { root: root as unknown as Document, listeners };
  };

  test('adds one click listener and one capturing close listener, however many times it runs', () => {
    const { root, listeners } = createDocument();

    registerDialogs(root);
    registerDialogs(root);

    expect(listeners).toStrictEqual([
      ['click', handleDialogClick, undefined],
      ['close', handleDialogClose, true],
    ]);
  });

  test("registers on the page's document by default", () => {
    const { root, listeners } = createDocument();
    vi.stubGlobal('document', root);

    registerDialogs();

    expect(listeners).toHaveLength(2);
  });
});
