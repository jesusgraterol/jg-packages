/**
 * Adds keyboard activation support to Crepe controls that require native click or pointer activation.
 * @param element The element that should behave like a button.
 * @param ariaLabel The label announced to assistive technology.
 * @param activation The native event Crepe uses for this control.
 */
export const bindKeyboardButtonBehavior = (
  element: HTMLElement,
  ariaLabel: string,
  activation: 'click' | 'pointerdown' = 'click',
): void => {
  element.setAttribute('aria-label', ariaLabel);
  element.setAttribute('role', 'button');
  element.tabIndex = 0;

  if (element.dataset['editorKeyboardBinding'] === 'true') {
    return;
  }

  /**
   * Activates the non-button control when the user presses a button key.
   * @param event The keyboard event emitted by the interactive control.
   */
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    if (element.matches(':disabled, [aria-disabled="true"]')) return;
    if (activation === 'pointerdown') {
      element.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }),
      );
    } else {
      element.click();
    }
  };

  element.addEventListener('keydown', handleKeyDown);
  element.dataset['editorKeyboardBinding'] = 'true';
};
