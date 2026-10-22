import { createDialogHistory } from './dialog-history.ts';
import { lockDialogScroll } from './dialog-scroll.ts';

interface IOpening {
  releaseScroll: () => void;
  opener: HTMLElement | undefined;
  parent: HTMLElement | null;
}
interface IDialogDocument {
  openings: Map<HTMLDialogElement, IOpening>;
  history: ReturnType<typeof createDialogHistory> | undefined;
}

// document identity, rather than replaceable HTML attributes, owns delegated listeners
const documents = new WeakMap<Document, IDialogDocument>();
const registered = new WeakSet<Document>();

/** Checks the native dialog boundary without depending on the caller's window realm. */
const isDialog = (value: unknown): value is HTMLDialogElement =>
  typeof (value as Partial<HTMLDialogElement> | null)?.showModal === 'function';

/** Gives a stable fallback focus without changing its permanent tab order. */
const focusFallback = (element: HTMLElement): void => {
  const hadTabindex = element.hasAttribute('tabindex');
  if (!hadTabindex) element.setAttribute('tabindex', '-1');
  element.focus({ preventScroll: true });
  if (!hadTabindex) element.removeAttribute('tabindex');
};

/** Releases an opening synchronously; the later native close event is then harmless. */
const finishDialog = (dialog: HTMLDialogElement, restoreFocus = true): void => {
  const state = documents.get(dialog.ownerDocument);
  if (state === undefined) return;
  const opening = state.openings.get(dialog);
  if (opening === undefined) return;
  state.openings.delete(dialog);
  if (dialog.open) dialog.close();
  state.history?.remove(dialog);
  opening.releaseScroll();
  if (!restoreFocus) return;
  const opener = opening.opener;
  const parentDialog = [...state.openings.keys()].at(-1);
  if (
    opener?.isConnected === true &&
    !opener.hasAttribute('disabled') &&
    opener.getClientRects().length > 0 &&
    (parentDialog === undefined || parentDialog.contains(opener))
  ) {
    opener.focus({ preventScroll: true });
    return;
  }
  const parent = opening.parent;
  const nearby =
    parent?.isConnected === true
      ? parent.querySelector<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]',
        )
      : null;
  const fallback =
    parentDialog?.querySelector<HTMLElement>('[data-dialog-title]') ??
    (nearby !== null && nearby.getClientRects().length > 0 ? nearby : undefined) ??
    dialog.ownerDocument.querySelector<HTMLElement>('main') ??
    dialog.ownerDocument.body;
  focusFallback(fallback);
};

/** Creates the one resource owner for a document, including navigation teardown. */
const getDocument = (root: Document): IDialogDocument => {
  const existing = documents.get(root);
  if (existing !== undefined) return existing;
  const state: IDialogDocument = {
    openings: new Map(),
    history:
      root.defaultView === null ? undefined : createDialogHistory(root.defaultView, finishDialog),
  };
  documents.set(root, state);
  const clear = (): void => {
    state.history?.clear();
    for (const dialog of [...state.openings.keys()].reverse()) finishDialog(dialog, false);
  };
  root.addEventListener('astro:before-swap', clear);
  root.defaultView?.addEventListener('pagehide', clear);
  return state;
};

/** Resets the owned body and applies an explicitly selected, local initial-focus target. */
const focusOpening = (dialog: HTMLDialogElement): void => {
  const body = dialog.querySelector<HTMLElement>('[data-dialog-body]');
  const selector = dialog.dataset['dialogInitialFocus'];
  let target: HTMLElement | null = null;
  if (selector !== undefined) {
    try {
      target = dialog.querySelector<HTMLElement>(selector);
    } catch {
      /* an invalid selector keeps native initial focus */
    }
  }
  if (target !== null && target.closest('dialog') === dialog) target.focus();
  else if (body !== null && body.scrollTop > 0) {
    const title = dialog.querySelector<HTMLElement>('[data-dialog-title]');
    if (title !== null) title.focus({ preventScroll: true });
    body.scrollTop = 0;
  }
};

/**
 * Opens a native modal, resets its body, and owns background scroll, focus, and optional phone
 * fullscreen history until it closes. Repeated calls leave an already-open dialog unchanged.
 * @param dialog The dialog to open.
 * @param opener The control that should regain focus when the dialog closes.
 */
export const openDialog = (dialog: HTMLDialogElement, opener?: Element | null): void => {
  const state = getDocument(dialog.ownerDocument);
  const open = (): void => {
    if (dialog.open || !dialog.isConnected) return;
    const control =
      opener !== null && opener !== undefined && typeof (opener as HTMLElement).focus === 'function'
        ? (opener as HTMLElement)
        : undefined;
    const body = dialog.querySelector<HTMLElement>('[data-dialog-body]');
    if (body !== null) body.scrollTop = 0;
    state.openings.set(dialog, {
      releaseScroll: lockDialogScroll(dialog.ownerDocument),
      opener: control,
      parent: control?.parentElement ?? null,
    });
    try {
      dialog.showModal();
      state.history?.add(dialog);
      focusOpening(dialog);
    } catch (error) {
      finishDialog(dialog);
      throw error;
    }
  };
  if (state.history === undefined) open();
  else state.history.whenReady(open);
};

/** Opens named triggers and handles close buttons and the permitted backdrop dismissal. */
export const handleDialogClick = (event: MouseEvent): void => {
  const target = event.target as Partial<Element> | null;
  if (event.defaultPrevented || event.button !== 0 || typeof target?.closest !== 'function') return;
  const trigger = target.closest<HTMLElement>('[data-dialog-open]');
  if (trigger !== null) {
    const dialog = trigger.ownerDocument.getElementById(trigger.dataset['dialogOpen'] ?? '');
    if (isDialog(dialog)) {
      event.preventDefault();
      openDialog(dialog, trigger);
    }
    return;
  }
  const dialog = target.closest('dialog[data-dialog]');
  if (
    isDialog(dialog) &&
    (target.closest('[data-dialog-close]') !== null ||
      (target === dialog && dialog.dataset['dialogOverlayClose'] !== 'false'))
  ) {
    dialog.close();
    finishDialog(dialog);
  }
};

/** Finishes external close calls, form dismissal, and native Escape cancellation. */
export const handleDialogClose = (event: Event): void => {
  // a queued event from an earlier close must not finish a rapid new opening
  if (isDialog(event.target) && !event.target.open) finishDialog(event.target);
};

/**
 * Registers one document-level click and capturing close listener. Astro navigation and page
 * dismissal close owned dialogs and release their resources without restoring obsolete focus.
 * @param root The owning document. Defaults to the page's.
 */
export const registerDialogs = (root: Document = document): void => {
  if (registered.has(root)) return;
  registered.add(root);
  getDocument(root);
  root.addEventListener('click', handleDialogClick);
  root.addEventListener('close', handleDialogClose, true);
};
