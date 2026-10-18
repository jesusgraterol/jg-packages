// the element that opened each dialog, which gets focus back when the dialog closes
const openers = new WeakMap<HTMLDialogElement, HTMLElement>();

/**
 * Checks whether a value is a dialog element, by its showModal method, so the check also works on
 * dialogs from another document.
 * @param value The value.
 * @returns Whether it's a dialog.
 */
const isDialog = (value: unknown): value is HTMLDialogElement =>
  typeof (value as Partial<HTMLDialogElement> | null)?.showModal === 'function';

/**
 * Opens a dialog as a modal, which makes the rest of the page inert until it closes, and remembers
 * the element that opened it, which gets focus back when it closes.
 * @param dialog The dialog.
 * @param opener The element that opened it, such as its trigger button.
 */
export const openDialog = (dialog: HTMLDialogElement, opener?: Element | null): void => {
  if (dialog.open) {
    return;
  }
  if (
    opener !== null &&
    opener !== undefined &&
    typeof (opener as HTMLElement).focus === 'function'
  ) {
    openers.set(dialog, opener as HTMLElement);
  }
  dialog.showModal();
};

/**
 * Opens a dialog from its trigger, and closes one from its close button or a click on its
 * backdrop, which lands on the dialog element itself.
 * @param event The click.
 */
export const handleDialogClick = (event: MouseEvent): void => {
  const target = event.target as Partial<Element> | null;
  if (typeof target?.closest !== 'function') {
    return;
  }
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
  if (isDialog(dialog) && (target === dialog || target.closest('[data-dialog-close]') !== null)) {
    dialog.close();
  }
};

/**
 * Gives focus back to the element that opened a dialog once it closes, by its close button, a
 * backdrop click, or Escape.
 * @param event The dialog's close event.
 */
export const handleDialogClose = (event: Event): void => {
  const dialog = event.target;
  if (!isDialog(dialog)) {
    return;
  }
  const opener = openers.get(dialog);
  openers.delete(dialog);
  if (opener?.isConnected === true) {
    opener.focus();
  }
};

/**
 * Makes every dialog on the page work, through one click listener and one close listener on the
 * document, however many dialogs there are: triggers with `data-dialog-open` open them, close
 * buttons and backdrop clicks close them, and focus returns to the trigger. The attribute it sets on
 * the root element keeps a second call from adding second listeners.
 * @param root The document. Defaults to the page's.
 */
export const registerDialogs = (root: Document = document): void => {
  if (root.documentElement.hasAttribute('data-dialogs-ready')) {
    return;
  }
  root.documentElement.setAttribute('data-dialogs-ready', '');
  root.addEventListener('click', handleDialogClick);
  // close doesn't bubble, so the document hears it in the capture phase
  root.addEventListener('close', handleDialogClose, true);
};
