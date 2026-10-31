import type { Crepe } from '@milkdown/crepe';
import type { ImageBlockConfig } from '@milkdown/kit/component/image-block';
import { EditorStatus, editorViewCtx } from '@milkdown/kit/core';
import { generateUuid } from 'jg-utilities';

import { bindKeyboardButtonBehavior } from './keyboard.utilities.js';

// Milkdown's retained pointer handler clamps image height to 100 CSS pixels.
const MIN_IMAGE_HEIGHT = 100;

/** Reads the height maintained by Milkdown without forcing layout on every accessibility scan. */
const readImageHeight = (image: HTMLImageElement): number =>
  Math.round(Number.parseFloat(image.dataset['height'] ?? '') || MIN_IMAGE_HEIGHT);

/** Mirrors native height constraints into the field's retained inline feedback. */
const syncHeightValidation = (input: HTMLInputElement, error: HTMLElement): void => {
  const isInvalid = !input.checkValidity();
  error.hidden = !isInvalid;
  error.textContent = isInvalid ? `Height: ${input.validationMessage}` : '';
  input.setAttribute('aria-invalid', String(isInvalid));
};

/** Applies document revisions without resetting the DOM height during Milkdown's uncommitted drag. */
const syncImageHeight = (crepe: Crepe, image: HTMLImageElement): void => {
  if (crepe.editor.status !== EditorStatus.Created) return;
  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const position = view.posAtDOM(image.closest('.milkdown-image-block')!, 0, -1);
    const node = view.state.doc.nodeAt(position);
    if (node?.type.name !== 'image-block') return;
    const ratio = Number(node.attrs['ratio']);
    const previous = image.dataset['editorImageRatio'];
    image.dataset['editorImageRatio'] = String(ratio);
    const origin = Number.parseFloat(image.dataset['origin'] ?? '');
    const height = Number.parseFloat(image.dataset['height'] ?? '');
    if (
      previous !== undefined &&
      previous !== String(ratio) &&
      origin > 0 &&
      Number((height / origin).toFixed(2)) !== ratio
    ) {
      const resolvedHeight = origin * ratio;
      image.dataset['height'] = resolvedHeight.toFixed(2);
      image.style.height = `${resolvedHeight}px`;
    }
  });
};

/** Updates the live image through ProseMirror while preserving Milkdown's bounds and ratio format. */
const resizeImage = (crepe: Crepe, image: HTMLImageElement, height: number): void => {
  if (crepe.editor.status !== EditorStatus.Created) return;
  const origin = Number.parseFloat(image.dataset['origin'] ?? '');
  if (!(origin > 0)) return;
  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    if (!view.editable) return;
    const position = view.posAtDOM(image.closest('.milkdown-image-block')!, 0, -1);
    const node = view.state.doc.nodeAt(position);
    if (node?.type.name !== 'image-block') return;
    const maximum = ctx.get<ImageBlockConfig, 'imageBlockConfigCtx'>(
      'imageBlockConfigCtx',
    ).maxHeight;
    const minimumHeight = Math.max(MIN_IMAGE_HEIGHT, height);
    const resolvedHeight = Math.min(minimumHeight, maximum ?? minimumHeight);
    const ratio = Number((resolvedHeight / origin).toFixed(2));
    image.dataset['height'] = resolvedHeight.toFixed(2);
    image.dataset['editorImageRatio'] = String(ratio);
    image.style.height = `${resolvedHeight}px`;
    view.dispatch(view.state.tr.setNodeMarkup(position, undefined, { ...node.attrs, ratio }));
  });
};

/** Adds named, keyboard and single-pointer alternatives to the retained image controls. */
export const syncMarkdownEditorImageControls = (container: HTMLElement, crepe?: Crepe): void => {
  const isReadonly =
    container.dataset['disabled'] === 'true' ||
    container.querySelector('.ProseMirror')?.getAttribute('contenteditable') === 'false';

  for (const caption of container.querySelectorAll<HTMLInputElement>(
    '.milkdown-image-block > .caption-input',
  )) {
    caption.setAttribute('aria-label', 'Image caption');
    caption.readOnly = isReadonly;
  }
  for (const toggle of container.querySelectorAll<HTMLElement>(
    '.milkdown-image-block > .image-wrapper .operation-item',
  )) {
    bindKeyboardButtonBehavior(toggle, 'Toggle image caption', 'pointerdown');
    toggle.setAttribute('aria-disabled', String(isReadonly));
    toggle.tabIndex = isReadonly ? -1 : 0;
  }
  if (!crepe) return;
  for (const handle of container.querySelectorAll<HTMLElement>(
    '.milkdown-image-block > .image-wrapper > .image-resize-handle',
  )) {
    // the SDK commits the image and resize handle together in this wrapper.
    const wrapper = handle.parentElement!;
    const image = wrapper.querySelector('img')!;
    syncImageHeight(crepe, image);
    let field = wrapper.querySelector<HTMLInputElement>(
      '[data-slot="markdown-editor-image-height"]',
    );
    if (!field) {
      const label = wrapper.ownerDocument.createElement('label');
      label.className = 'markdown-editor-image-controls';
      label.textContent = 'Height (px)';
      const error = wrapper.ownerDocument.createElement('span');
      error.id = `markdown-image-height-${generateUuid(4)}`;
      error.className = 'markdown-editor-image-height-error';
      error.setAttribute('role', 'alert');
      error.hidden = true;
      field = wrapper.ownerDocument.createElement('input');
      field.type = 'number';
      field.min = String(MIN_IMAGE_HEIGHT);
      field.required = true;
      field.placeholder = 'e.g. 128';
      field.inputMode = 'numeric';
      field.enterKeyHint = 'done';
      field.setAttribute('form', '');
      field.dataset['slot'] = 'markdown-editor-image-height';
      field.setAttribute('aria-label', 'Image height in pixels');
      field.setAttribute('aria-describedby', error.id);
      field.value = String(readImageHeight(image));
      label.append(field, error);
      wrapper.append(label);
      const input = field;
      const showValidation = (): void => syncHeightValidation(input, error);
      input.addEventListener('input', () => {
        if (!input.isConnected || input.disabled) return;
        if (!input.checkValidity()) {
          if (!error.hidden) showValidation();
          return;
        }
        showValidation();
        resizeImage(crepe, image, input.valueAsNumber);
        const height = String(readImageHeight(image));
        input.value = height;
        input.dataset['editorHeight'] = height;
      });
      input.addEventListener('blur', showValidation);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          showValidation();
        }
      });
    }
    const wasFocused = field.ownerDocument.activeElement === field;
    field.disabled = isReadonly;
    if (isReadonly && wasFocused) {
      image.tabIndex = -1;
      image.focus({ preventScroll: true });
    }
    field.parentElement!.hidden = isReadonly;
    const height = String(readImageHeight(image));
    if (
      isReadonly ||
      field.dataset['editorHeight'] !== height ||
      (!wasFocused && field.validity.valid)
    ) {
      field.value = height;
      if (field.validity.valid)
        syncHeightValidation(
          field,
          field.parentElement!.querySelector<HTMLElement>('.markdown-editor-image-height-error')!,
        );
    }
    field.dataset['editorHeight'] = height;
    const imageHeight = `${height}px`;
    if (wrapper.style.getPropertyValue('--markdown-editor-image-height') !== imageHeight) {
      wrapper.style.setProperty('--markdown-editor-image-height', imageHeight);
    }
  }
};
