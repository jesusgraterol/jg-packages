import type { Crepe } from '@milkdown/crepe';
import { editorViewCtx, EditorStatus } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';

// Crepe 7.20 registers its native insertion menu in Milkdown's named context.
type ICrepeInsertMenu = { show: (position: number) => void };

/**
 * Returns the live empty text block that can expose the wide editor's insertion control.
 * @param crepe The mounted editor instance.
 * @param container The editor wrapper carrying mode and responsive ownership.
 * @returns The editor view, or null outside an empty wide authoring document.
 */
const getEmptyMarkdownEditorView = (crepe: Crepe, container: HTMLElement): EditorView | null => {
  if (
    crepe.editor.status !== EditorStatus.Created ||
    container.dataset['editorMode'] === 'chat' ||
    container.closest('[data-markdown-editor-layout="compact"]')
  ) {
    return null;
  }

  const view = crepe.editor.action((ctx) => ctx.get(editorViewCtx));
  const { doc } = view.state;
  const firstBlock = doc.firstChild;

  return doc.childCount === 1 &&
    firstBlock?.isTextblock &&
    ['paragraph', 'heading'].includes(firstBlock.type.name) &&
    firstBlock.content.size === 0
    ? view
    : null;
};

/**
 * Positions and names Crepe's existing add control before any pointer hover.
 * @param crepe The mounted editor instance.
 * @param container The editor wrapper to synchronize.
 */
export const syncMarkdownEditorEmptyState = (crepe: Crepe, container: HTMLElement): void => {
  const view = getEmptyMarkdownEditorView(crepe, container);
  const addControl = container.querySelector<HTMLElement>(
    '.milkdown-block-handle > .operation-item:first-child',
  );
  const handle = addControl?.parentElement;
  const isEmptyControlVisible = Boolean(view?.editable && addControl);

  container.dataset['emptyBlockHandle'] = String(isEmptyControlVisible);

  if (!isEmptyControlVisible || !view || !handle || !addControl) {
    addControl?.removeAttribute('aria-label');
    addControl?.removeAttribute('role');
    addControl?.removeAttribute('tabindex');
    return;
  }

  addControl.setAttribute('aria-label', 'Insert block');
  addControl.setAttribute('role', 'button');
  addControl.tabIndex = 0;

  const firstBlock = view.nodeDOM(0);
  const handleParent = handle.offsetParent ?? handle.parentElement;

  if (!(firstBlock instanceof HTMLElement) || !(handleParent instanceof HTMLElement)) {
    return;
  }

  const blockRect = firstBlock.getBoundingClientRect();
  const parentRect = handleParent.getBoundingClientRect();
  const top = `${blockRect.top - parentRect.top + (blockRect.height - handle.offsetHeight) / 2}px`;

  if (handle.style.getPropertyValue('--markdown-editor-empty-handle-top') !== top) {
    handle.style.setProperty('--markdown-editor-empty-handle-top', top);
  }
};

/**
 * Opens Crepe's native menu on the existing empty block without inserting another paragraph.
 * @param crepe The mounted editor instance.
 * @param container The editor wrapper to check at activation time.
 * @returns True when the empty-state activation was handled, including read-only suppression.
 */
export const openEmptyMarkdownEditorInsertMenu = (
  crepe: Crepe,
  container: HTMLElement,
): boolean => {
  const view = getEmptyMarkdownEditorView(crepe, container);

  if (!view) {
    return false;
  }

  if (!view.editable) {
    return true;
  }

  view.dispatch(view.state.tr.setSelection(TextSelection.atStart(view.state.doc)));
  view.focus();
  crepe.editor.action((ctx) =>
    ctx.get<ICrepeInsertMenu, 'menuAPICtx'>('menuAPICtx').show(view.state.selection.from),
  );
  return true;
};
