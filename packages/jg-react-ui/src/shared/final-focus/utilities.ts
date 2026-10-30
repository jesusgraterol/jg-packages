import type { ICloseAutoFocusHandler, IFinalFocus } from './types.js';

/**
 * Converts a close-auto-focus handler into Base UI's final focus callback.
 * @param finalFocus The explicit Base UI final focus behavior.
 * @param onCloseAutoFocus The close-auto-focus event handler.
 * @returns The resolved final focus behavior for the popup.
 */
export const resolveFinalFocus = (
  finalFocus: IFinalFocus,
  onCloseAutoFocus?: ICloseAutoFocusHandler,
): IFinalFocus => {
  if (finalFocus !== undefined || !onCloseAutoFocus) {
    return finalFocus;
  }

  return () => {
    const event = new Event('closeAutoFocus', { cancelable: true });

    onCloseAutoFocus(event);

    return event.defaultPrevented ? false : true;
  };
};
