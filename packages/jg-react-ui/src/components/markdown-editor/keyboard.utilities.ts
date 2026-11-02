import type { EditorState } from '@milkdown/kit/prose/state';

// the elements a keyboard reaches with Tab, before the checks that rule some out
const TABBABLE_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'iframe',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(', ');

/**
 * Says whether the selection sits in a list item, where Tab and Shift+Tab nest and lift it.
 * @param state The editor's state.
 * @returns Whether a list item holds the selection.
 * @example
 * declare const state: import('@milkdown/kit/prose/state').EditorState;
 * const isNesting = isMarkdownEditorSelectionInListItem(state);
 */
export const isMarkdownEditorSelectionInListItem = (state: EditorState): boolean => {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1)
    if ($from.node(depth).type.name === 'list_item') return true;
  return false;
};

/**
 * Moves the keyboard focus out of an editor to the next control a keyboard reaches with Tab, or
 * the previous one, as the browser does from a text field: one that is enabled, shown and not
 * inert, outside the editor. A positive `tabindex` order isn't followed.
 * @param editor The element that holds the whole editor, its controls included.
 * @param direction 1 for the next control, -1 for the previous one.
 * @returns Whether a control took the focus.
 * @example
 * declare const editor: HTMLElement;
 * const isMoved = moveFocusFromMarkdownEditor(editor, 1);
 */
export const moveFocusFromMarkdownEditor = (editor: HTMLElement, direction: 1 | -1): boolean => {
  const candidates = [...editor.ownerDocument.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)];
  const isReachable = (element: HTMLElement): boolean =>
    !editor.contains(element) &&
    element.tabIndex >= 0 &&
    !element.matches(':disabled') &&
    element.closest('[inert]') === null &&
    element.getClientRects().length > 0;
  const position =
    direction === 1 ? Node.DOCUMENT_POSITION_FOLLOWING : Node.DOCUMENT_POSITION_PRECEDING;
  const ordered = direction === 1 ? candidates : candidates.reverse();
  const target = ordered.find(
    (element) => (editor.compareDocumentPosition(element) & position) !== 0 && isReachable(element),
  );
  target?.focus();
  return target !== undefined;
};

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
