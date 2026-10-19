/*
 * The browser globals a session reads to return focus. Sessions are created at import time in
 * modules that a server also renders, so they're read from globalThis without assuming they exist.
 */
type IFocusGlobals = {
  document?: Document;
  requestAnimationFrame?: (callback: () => void) => number;
};

// the global object, typed with the browser globals that may be missing
const focusGlobals = globalThis as unknown as IFocusGlobals;

/**
 * Gives the element that has focus, the default element to return focus to.
 * @returns The focused element, or null without a document or a focused HTML element.
 */
export const readFocusedElement = (): HTMLElement | null => {
  // without a document, as on a server, HTMLElement doesn't exist either
  if (focusGlobals.document === undefined) {
    return null;
  }
  const focused = focusGlobals.document.activeElement;
  return focused instanceof HTMLElement ? focused : null;
};

/**
 * Checks whether focus can go back to an element: it's still in the page, not disabled, and not
 * inside an inert part of the page.
 * @param element The element.
 * @returns Whether it can take focus back.
 */
const canTakeFocus = (element: HTMLElement): boolean =>
  element.isConnected && !element.matches(':disabled') && element.closest('[inert]') === null;

/**
 * Checks whether focus is lost: on the body, or on an element no longer in the page, such as the
 * dialog that just closed. Focus the user moved anywhere else is left alone.
 * @param page The document.
 * @returns Whether focus is lost.
 */
const isFocusLost = (page: Document): boolean => {
  const focused = page.activeElement;
  return focused === null || focused === page.body || !focused.isConnected;
};

/**
 * Returns focus to an element one frame after a session closed, once the dialog has unmounted,
 * when the element can still take it, no session opened meanwhile, and focus is lost.
 * @param element The element to return focus to.
 * @param isSessionOpen Whether a session is open, read when the frame comes.
 */
export const scheduleFocusReturn = (element: HTMLElement, isSessionOpen: () => boolean): void => {
  const { document: page, requestAnimationFrame } = focusGlobals;
  if (page === undefined || requestAnimationFrame === undefined) {
    return;
  }
  requestAnimationFrame(() => {
    if (!isSessionOpen() && canTakeFocus(element) && isFocusLost(page)) {
      element.focus();
    }
  });
};
