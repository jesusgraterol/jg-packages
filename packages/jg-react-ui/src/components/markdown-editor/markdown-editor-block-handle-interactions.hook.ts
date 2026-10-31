import { useRef, useCallback, useEffect } from 'react';

// callbacks and mounted container consumed by the block-handle interaction adapter.
type IUseMarkdownEditorBlockHandleInteractionsOptions = {
  container: HTMLElement | null;
  onAddElementInteraction: () => void;
  onBlockActions: (triggerElement: HTMLElement) => void;
  onEmptyAddElementInteraction: () => boolean;
};

// touch interactions retain Crepe's selection while suppressing its virtual-keyboard focus.
type IMarkdownEditorTouchBlockHandleInteraction = {
  editorElement: HTMLElement;
  hasHandledEmptyAdd: boolean;
  inputMode: string | null;
  operationItem: HTMLElement;
};

/**
 * Returns the Crepe block-handle control targeted inside the mounted editor.
 * @param container The mounted markdown editor wrapper.
 * @param eventTarget The DOM event target to inspect.
 * @returns The matching block-handle control, or null for unrelated targets.
 */
const getBlockHandleOperationItem = (
  container: HTMLElement,
  eventTarget: EventTarget | null,
): HTMLElement | null => {
  if (!(eventTarget instanceof Element)) {
    return null;
  }

  const operationItem = eventTarget.closest<HTMLElement>(
    '.milkdown-block-handle > .operation-item',
  );

  return operationItem && container.contains(operationItem) ? operationItem : null;
};

/**
 * Returns true when a pointer can summon a software keyboard.
 * @param pointerType The pointer type reported by the browser.
 * @returns True for touch and pen input.
 */
const canPointerOpenVirtualKeyboard = (pointerType: string): boolean =>
  pointerType === 'touch' || pointerType === 'pen';

/**
 * Adapts Crepe block controls for touch, empty-state insertion, and block actions.
 * @param options The mounted editor and block-operation callbacks.
 */
export const useMarkdownEditorBlockHandleInteractions = ({
  container,
  onAddElementInteraction,
  onBlockActions,
  onEmptyAddElementInteraction,
}: IUseMarkdownEditorBlockHandleInteractionsOptions): void => {
  const touchInteractionRef = useRef<IMarkdownEditorTouchBlockHandleInteraction | null>(null);

  /** Restores normal editor input after a touch block-handle interaction. */
  const finishTouchInteraction = useCallback((): void => {
    const interaction = touchInteractionRef.current;

    if (!interaction) {
      return;
    }

    interaction.editorElement.blur();

    if (interaction.inputMode === null) {
      interaction.editorElement.removeAttribute('inputmode');
    } else {
      interaction.editorElement.setAttribute('inputmode', interaction.inputMode);
    }

    touchInteractionRef.current = null;
  }, []);

  /** Releases pointer-driven focus while leaving Crepe's block selection intact. */
  const blurTouchInteraction = useCallback((): void => {
    touchInteractionRef.current?.editorElement.blur();
  }, []);

  useEffect(() => {
    if (!container) {
      return;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      const operationItem = getBlockHandleOperationItem(container, event.target);

      if (!operationItem) {
        // this listener only receives pointer events dispatched through its container.
        finishTouchInteraction();

        return;
      }

      if (!canPointerOpenVirtualKeyboard(event.pointerType)) {
        finishTouchInteraction();
        return;
      }

      finishTouchInteraction();

      const editorElement = container.querySelector<HTMLElement>('.ProseMirror');

      if (!editorElement) {
        return;
      }

      touchInteractionRef.current = {
        editorElement,
        hasHandledEmptyAdd: false,
        inputMode: editorElement.getAttribute('inputmode'),
        operationItem,
      };
      editorElement.setAttribute('inputmode', 'none');
    };

    const handlePointerUp = (event: PointerEvent): void => {
      const operationItem = getBlockHandleOperationItem(container, event.target);

      if (
        operationItem?.matches('.milkdown-block-handle > .operation-item:first-child') &&
        onEmptyAddElementInteraction()
      ) {
        event.preventDefault();
        event.stopPropagation();
        // intercepting Crepe's pointer-up also replaces its pressed-state cleanup.
        operationItem.classList.remove('active');
        onAddElementInteraction();
        if (touchInteractionRef.current) {
          touchInteractionRef.current.hasHandledEmptyAdd = true;
        }
      }

      if (touchInteractionRef.current && !touchInteractionRef.current.hasHandledEmptyAdd) {
        queueMicrotask(blurTouchInteraction);
      }
    };

    const handlePointerCancel = (): void => {
      finishTouchInteraction();
    };

    const handleMouseDown = (event: MouseEvent): void => {
      const interaction = touchInteractionRef.current;

      if (interaction?.operationItem === getBlockHandleOperationItem(container, event.target)) {
        blurTouchInteraction();
      }
    };

    const handleMouseUp = (event: MouseEvent): void => {
      const interaction = touchInteractionRef.current;

      if (
        !interaction ||
        interaction.operationItem !== getBlockHandleOperationItem(container, event.target)
      ) {
        return;
      }

      event.stopPropagation();
      if (!interaction.hasHandledEmptyAdd) {
        blurTouchInteraction();
      }
    };

    const handleClick = (event: MouseEvent): void => {
      const operationItem = getBlockHandleOperationItem(container, event.target);
      const blockHandle = operationItem?.closest<HTMLElement>('.milkdown-block-handle');

      if (!operationItem || !blockHandle) {
        return;
      }

      const operationItems = Array.from(
        blockHandle.querySelectorAll<HTMLElement>(':scope > .operation-item'),
      );

      if (operationItems[1] !== operationItem) {
        if (event.detail === 0 && onEmptyAddElementInteraction()) {
          event.preventDefault();
          event.stopPropagation();
        }

        onAddElementInteraction();
        // Crepe positions this menu after pointer-up and still needs editor focus.
        // inputmode=none suppresses the touch keyboard until the next editor tap.
        if (!touchInteractionRef.current?.hasHandledEmptyAdd) {
          blurTouchInteraction();
        }
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onBlockActions(operationItem);
      blurTouchInteraction();
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      const operationItem = getBlockHandleOperationItem(container, event.target);

      if (
        (event.key === 'Enter' || event.key === ' ') &&
        operationItem?.matches('.milkdown-block-handle > .operation-item:first-child') &&
        onEmptyAddElementInteraction()
      ) {
        event.preventDefault();
        event.stopPropagation();
        onAddElementInteraction();
      }
    };

    container.addEventListener('pointerdown', handlePointerDown, true);
    container.addEventListener('pointerup', handlePointerUp, true);
    container.addEventListener('pointercancel', handlePointerCancel, true);
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mouseup', handleMouseUp, true);
    container.addEventListener('click', handleClick);
    container.addEventListener('keydown', handleKeyDown, true);

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown, true);
      container.removeEventListener('pointerup', handlePointerUp, true);
      container.removeEventListener('pointercancel', handlePointerCancel, true);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mouseup', handleMouseUp, true);
      container.removeEventListener('click', handleClick);
      container.removeEventListener('keydown', handleKeyDown, true);
      finishTouchInteraction();
    };
  }, [
    blurTouchInteraction,
    container,
    finishTouchInteraction,
    onAddElementInteraction,
    onBlockActions,
    onEmptyAddElementInteraction,
  ]);
};
