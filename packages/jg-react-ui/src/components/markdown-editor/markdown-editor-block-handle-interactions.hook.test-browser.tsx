import { act } from 'react';
import { renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { useMarkdownEditorBlockHandleInteractions } from './markdown-editor-block-handle-interactions.hook.js';

afterEach(() => vi.restoreAllMocks());

test('touch and compatibility mouse events preserve selection without leaving input disabled', async () => {
  const container = document.createElement('div');
  const editor = document.createElement('div');
  editor.className = 'ProseMirror';
  editor.contentEditable = 'true';
  editor.setAttribute('inputmode', 'text');
  const handle = document.createElement('div');
  handle.className = 'milkdown-block-handle';
  const insert = document.createElement('button');
  const actions = document.createElement('button');
  const extra = document.createElement('button');
  for (const button of [insert, actions, extra]) button.className = 'operation-item';
  handle.append(insert, actions, extra);
  container.append(editor, handle);
  document.body.append(container);
  const onAdd = vi.fn();
  const onActions = vi.fn();
  const emptyAdd = vi.fn(() => false);
  const hook = renderHook(() =>
    useMarkdownEditorBlockHandleInteractions({
      container,
      onAddElementInteraction: onAdd,
      onBlockActions: onActions,
      onEmptyAddElementInteraction: emptyAdd,
    }),
  );
  try {
    act(() => {
      editor.focus();
      insert.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }),
      );
      insert.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      insert.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }));
      insert.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    await Promise.resolve();
    expect(editor.getAttribute('inputmode')).toBe('none');
    expect(document.activeElement).not.toBe(editor);
    act(() => insert.click());
    expect(onAdd).toHaveBeenCalledOnce();
    act(() => {
      container.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }));
    });
    expect(editor.getAttribute('inputmode')).toBe('text');

    act(() => {
      actions.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'pen' }));
      extra.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      actions.click();
    });
    expect(onActions).toHaveBeenCalledWith(actions);
    hook.unmount();
    expect(editor.getAttribute('inputmode')).toBe('text');
    act(() => actions.click());
    expect(onActions).toHaveBeenCalledOnce();
  } finally {
    hook.unmount();
    container.remove();
  }
});

test('empty insertion suppresses native duplication and the next editor tap restores input', () => {
  const container = document.createElement('div');
  container.innerHTML =
    '<div class="ProseMirror" contenteditable="true"></div><div class="milkdown-block-handle"><button class="operation-item active">Insert</button><button class="operation-item">Actions</button></div>';
  document.body.append(container);
  const editor = container.querySelector<HTMLElement>('.ProseMirror')!;
  const insert = container.querySelector<HTMLElement>('button')!;
  const onAdd = vi.fn();
  const hook = renderHook(() =>
    useMarkdownEditorBlockHandleInteractions({
      container,
      onAddElementInteraction: onAdd,
      onBlockActions: vi.fn(),
      onEmptyAddElementInteraction: () => true,
    }),
  );
  try {
    const pointerUp = new PointerEvent('pointerup', {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
    });
    act(() => {
      insert.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }),
      );
      insert.dispatchEvent(pointerUp);
    });
    expect(pointerUp.defaultPrevented).toBe(true);
    expect(insert.classList.contains('active')).toBe(false);
    expect(onAdd).toHaveBeenCalledOnce();
    act(() => insert.click());
    act(() => {
      editor.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }),
      );
    });
    expect(editor.hasAttribute('inputmode')).toBe(false);
    act(() => {
      insert.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }),
      );
      insert.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }),
      );
    });
    expect(editor.hasAttribute('inputmode')).toBe(false);
  } finally {
    hook.unmount();
    container.remove();
  }
});

test('detached or partially mounted controls do not invoke actions or retain listeners', () => {
  const container = document.createElement('div');
  container.innerHTML =
    '<div class="milkdown-block-handle"><button class="operation-item">Insert</button></div>';
  const insert = container.querySelector('button')!;
  const onAdd = vi.fn();
  const initialProps: { target: HTMLElement | null } = { target: container };
  const hook = renderHook(
    ({ target }: { target: HTMLElement | null }) =>
      useMarkdownEditorBlockHandleInteractions({
        container: target,
        onAddElementInteraction: onAdd,
        onBlockActions: vi.fn(),
        onEmptyAddElementInteraction: () => false,
      }),
    { initialProps },
  );
  try {
    act(() => {
      insert.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }),
      );
      insert.firstChild?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      insert.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    hook.rerender({ target: null });
    act(() => insert.click());
    expect(onAdd).not.toHaveBeenCalled();
  } finally {
    hook.unmount();
  }
});
