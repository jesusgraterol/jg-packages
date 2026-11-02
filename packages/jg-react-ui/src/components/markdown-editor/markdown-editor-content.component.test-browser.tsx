import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type * as MilkdownReact from '@milkdown/react';
import type { GetEditor } from '@milkdown/react';
import { listenerCtx } from '@milkdown/kit/plugin/listener';
import { Editor, EditorStatus, editorViewCtx, editorViewOptionsCtx } from '@milkdown/kit/core';
import { replaceAll } from '@milkdown/kit/utils';
import { TextSelection } from '@milkdown/kit/prose/state';
import { getByRole, getByText } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, test, vi, type MockInstance } from 'vitest';

import { useMarkdownEditorBlockHandleInteractions } from './markdown-editor-block-handle-interactions.hook.js';
import { MarkdownEditorBlockActionMenu } from './markdown-editor-block-action-menu.component.js';
import { configureMarkdownEditorSerialization, getMarkdownEditorCrepeConfig } from './utilities.js';
import {
  MarkdownEditorYouTubeVideoDialog,
  createMarkdownEditorYouTubeVideoAuthoringController,
} from './youtube-video/index.js';
import type * as EditorUtilities from './utilities.js';
import type * as YouTubeAuthoring from './youtube-video/index.js';
import { parseYouTubeVideoUrl } from '../../shared/youtube-video/index.js';
import {
  MARKDOWN_EDITOR_ALL_TOOLS,
  MARKDOWN_EDITOR_TOOLS,
  MARKDOWN_EDITOR_TURN_INTO_OPTIONS,
} from './constants.js';
import { MarkdownEditorContent } from './markdown-editor-content.component.js';
import type { IMarkdownEditorContentProps } from './types.js';

vi.mock('./markdown-editor-block-handle-interactions.hook.js', { spy: true });
vi.mock('./markdown-editor-block-action-menu.component.js', { spy: true });
vi.mock('./utilities.js', async (importOriginal) => {
  const actual = await importOriginal<typeof EditorUtilities>();
  return {
    ...actual,
    getMarkdownEditorCrepeConfig: vi.fn(actual.getMarkdownEditorCrepeConfig),
    configureMarkdownEditorSerialization: vi.fn(actual.configureMarkdownEditorSerialization),
  };
});
vi.mock('./youtube-video/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof YouTubeAuthoring>();
  return {
    ...actual,
    MarkdownEditorYouTubeVideoDialog: vi.fn(actual.MarkdownEditorYouTubeVideoDialog),
    createMarkdownEditorYouTubeVideoAuthoringController: vi.fn(
      actual.createMarkdownEditorYouTubeVideoAuthoringController,
    ),
  };
});

// retain the real SDK hook while observing its public editor-factory lifecycle.
const factoryCalls = vi.hoisted(() => ({ factories: [] as GetEditor[] }));
vi.mock('@milkdown/react', async (importOriginal) => {
  const actual = await importOriginal<typeof MilkdownReact>();
  const useTrackedEditor: typeof actual.useEditor = (factory, ...arguments_) => {
    factoryCalls.factories.push(factory);
    return actual.useEditor(factory, ...arguments_);
  };
  return { ...actual, useEditor: useTrackedEditor };
});

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean | undefined;
};

describe('MarkdownEditorContent with real Milkdown initialization and block controls', () => {
  let container: HTMLDivElement;
  let root: Root;
  let editors: Editor[];
  let makeEditorSpy: MockInstance<typeof Editor.make>;
  let previousActEnvironment: boolean | undefined;
  let releaseCreation: (() => void) | undefined;

  beforeEach(() => {
    previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    releaseCreation = undefined;
    editors = [];
    factoryCalls.factories.length = 0;
    vi.mocked(getMarkdownEditorCrepeConfig).mockClear();
    vi.mocked(MarkdownEditorYouTubeVideoDialog).mockClear();
    vi.mocked(createMarkdownEditorYouTubeVideoAuthoringController).mockClear();
    vi.mocked(MarkdownEditorBlockActionMenu).mockClear();
    vi.mocked(useMarkdownEditorBlockHandleInteractions).mockClear();
    const makeEditor = Editor.make.bind(Editor);

    makeEditorSpy = vi.spyOn(Editor, 'make').mockImplementation(() => {
      const editor = makeEditor();
      editors.push(editor);
      return editor;
    });

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    try {
      releaseCreation?.();
      await act(async () => {
        await vi.waitFor(() => {
          expect(
            editors.every(
              (editor) =>
                editor.status === EditorStatus.Created || editor.status === EditorStatus.Destroyed,
            ),
          ).toBe(true);
        });
      });
      act(() => root.unmount());
      await vi.waitFor(() => {
        expect(editors.every((editor) => editor.status === EditorStatus.Destroyed)).toBe(true);
      });
    } finally {
      container.remove();
      vi.restoreAllMocks();
      reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    }
  });

  const renderEditor = async (
    props: Partial<IMarkdownEditorContentProps> = {},
    layout = 'wide',
  ): Promise<void> => {
    await act(async () => {
      root.render(
        <div data-markdown-editor-layout={layout}>
          <MarkdownEditorContent
            aria-label="Test note"
            isDarkMode={false}
            onChange={vi.fn()}
            placeholder="e.g. ## Weekly update"
            supportedTools={[MARKDOWN_EDITOR_TOOLS.Text, MARKDOWN_EDITOR_TOOLS.Heading]}
            value=""
            {...props}
          />
        </div>,
      );

      await Promise.resolve();
    });
  };

  const waitForEditor = async (): Promise<HTMLElement> => {
    await act(async () => {
      await vi.waitFor(() => {
        expect(container.querySelector('[role="textbox"]')).not.toBeNull();
        expect(editors.at(-1)?.status).toBe(EditorStatus.Created);
        expect(
          editors.slice(0, -1).every((editor) => editor.status === EditorStatus.Destroyed),
        ).toBe(true);
      });
    });

    const surface = container.querySelector<HTMLElement>('[data-slot="markdown-editor"]')!;
    expect(surface.hasAttribute('aria-busy')).toBe(false);
    return surface;
  };

  const getAddControl = async (): Promise<HTMLElement> => {
    let control: HTMLElement | null = null;
    await act(async () => {
      await vi.waitFor(() => {
        control = container.querySelector<HTMLElement>(
          '[role="button"][aria-label="Insert block"]',
        );
        expect(control).not.toBeNull();
      });
    });
    return control!;
  };

  const changeInput = (name: string, text: string): void => {
    const input = getByRole<HTMLInputElement>(document.body, 'textbox', { name });
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set?.bind(input);
    setValue?.(text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  test('repeated factory requests reuse one editor and late SDK listeners ignore a destroyed view', async () => {
    const onChange = vi.fn();
    await renderEditor({ value: 'Original draft', onChange });
    await waitForEditor();
    const factory = factoryCalls.factories.at(-1)!;
    const editor = editors.at(-1)!;
    const reused = factory(document.createElement('div'));
    expect(reused).toBe(factory(document.createElement('div')));
    expect(makeEditorSpy).toHaveBeenCalledOnce();
    const lateCallbacks = editor.action((ctx) => {
      const listeners = ctx.get(listenerCtx).listeners;
      const doc = ctx.get(editorViewCtx).state.doc;
      return () => {
        for (const callback of listeners.updated) callback(ctx, doc, doc);
        for (const callback of listeners.blur) callback(ctx);
      };
    });
    await act(async () => {
      await editor.destroy();
    });
    expect(() => lateCallbacks()).not.toThrow();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('retained block callbacks safely ignore destroyed and unmounted editor instances', async () => {
    await renderEditor();
    await waitForEditor();
    const trigger = await getAddControl();
    const callbacks = vi.mocked(useMarkdownEditorBlockHandleInteractions).mock.calls.at(-1)![0];
    await act(async () => {
      await editors[0]!.destroy();
    });
    act(() => {
      callbacks.onBlockActions(trigger);
    });
    expect(document.querySelector('[role="menu"][aria-label="Block actions"]')).toBeNull();
    act(() => root.unmount());
    expect(() => callbacks.onBlockActions(trigger)).not.toThrow();
    expect(callbacks.onEmptyAddElementInteraction()).toBe(false);
  });

  test('serialized listener updates do not emit an unchanged canonical draft', async () => {
    const configure = vi.mocked(configureMarkdownEditorSerialization).getMockImplementation()!;
    const keydown = vi.fn(() => true);
    vi.mocked(configureMarkdownEditorSerialization).mockImplementationOnce((ctx) => {
      configure(ctx);
      ctx.update(editorViewOptionsCtx, (previous) => ({
        ...previous,
        attributes: { 'data-consumer-state': 'retained' },
        handleKeyDown: keydown,
      }));
    });
    const onChange = vi.fn();
    await renderEditor({ value: 'Canonical draft\n', onChange });
    await waitForEditor();
    const editor = editors.at(-1)!;
    const view = editor.action((ctx) => ctx.get(editorViewCtx));
    expect(view.dom.dataset['consumerState']).toBe('retained');
    act(() => {
      view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'F8', bubbles: true }));
      editor.action((ctx) => {
        for (const callback of ctx.get(listenerCtx).listeners.updated)
          callback(ctx, view.state.doc, view.state.doc);
      });
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(keydown).toHaveBeenCalled();
  });

  test('closing a stale insertion session ignores a vanished focus target and mutations after readonly', async () => {
    await renderEditor({ supportedTools: MARKDOWN_EDITOR_ALL_TOOLS, value: '/' });
    await waitForEditor();
    const insert = vi.mocked(getMarkdownEditorCrepeConfig).mock.calls.at(-1)![0]
      .onYouTubeVideoInsertRequest!;
    const view = editors.at(-1)!.action((ctx) => ctx.get(editorViewCtx));
    act(() =>
      insert({
        blockDepth: 1,
        blockPosition: 0,
        blockText: '/',
        doc: view.state.doc,
        editorElement: document.createElement('div'),
        selectionBookmark: view.state.selection.getBookmark(),
      }),
    );
    const props = vi.mocked(MarkdownEditorYouTubeVideoDialog).mock.calls.at(-1)![0];
    expect(props.resolveReturnFocusElement()).toBeNull();
    act(() => props.onOpenChange(true));
    await renderEditor({ supportedTools: MARKDOWN_EDITOR_ALL_TOOLS, value: '/', disabled: true });
    act(() => props.onSubmit(parseYouTubeVideoUrl('https://youtu.be/dQw4w9WgXcQ', 'Walkthrough')!));
    expect(view.state.doc.textContent).toBe('/');
  });

  test('deferred YouTube requests cannot reopen authoring after the editor becomes disabled', async () => {
    await renderEditor({ supportedTools: MARKDOWN_EDITOR_ALL_TOOLS, value: '/' });
    await waitForEditor();
    const insert = vi.mocked(getMarkdownEditorCrepeConfig).mock.calls.at(-1)![0]
      .onYouTubeVideoInsertRequest!;
    const controllerResult = vi
      .mocked(createMarkdownEditorYouTubeVideoAuthoringController)
      .mock.results.at(-1)!;
    if (controllerResult.type !== 'return')
      throw new Error('Expected a real authoring controller.');
    const controller = controllerResult.value;
    const onEdit = controller.getOptions().onEditRequest;
    const view = editors.at(-1)!.action((ctx) => ctx.get(editorViewCtx));
    const insertionRequest = {
      blockDepth: 1,
      blockPosition: 0,
      blockText: '/',
      doc: view.state.doc,
      editorElement: view.dom,
      selectionBookmark: view.state.selection.getBookmark(),
    };
    await renderEditor({ supportedTools: MARKDOWN_EDITOR_ALL_TOOLS, value: '/', disabled: true });
    await waitForEditor();
    act(() => {
      insert(insertionRequest);
      const trigger = document.createElement('button');
      onEdit({
        descriptor: parseYouTubeVideoUrl('https://youtu.be/dQw4w9WgXcQ', 'Walkthrough')!,
        doc: view.state.doc,
        getPos: () => 0,
        position: 0,
        resolveTriggerElement: () => null,
        triggerElement: trigger,
      });
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  test('delayed block menu callbacks after dismissal do not transform or delete the previous target', async () => {
    const matchMedia = window.matchMedia.bind(window);
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
      const result = matchMedia(query);
      if (query === '(prefers-reduced-motion: reduce)')
        Object.defineProperty(result, 'matches', { value: true });
      return result;
    });
    await renderEditor();
    await waitForEditor();
    const trigger = await getAddControl();
    await renderEditor({ value: 'Retained paragraph' });
    await waitForEditor();
    const view = editors.at(-1)!.action((ctx) => ctx.get(editorViewCtx));
    view.focus();
    const callbacks = vi.mocked(useMarkdownEditorBlockHandleInteractions).mock.calls.at(-1)![0];
    act(() => callbacks.onBlockActions(trigger));
    await act(async () => {
      await vi.waitFor(() =>
        expect(vi.mocked(MarkdownEditorBlockActionMenu).mock.calls.length).toBeGreaterThan(0),
      );
    });
    const props = vi.mocked(MarkdownEditorBlockActionMenu).mock.calls.at(-1)![0];
    act(() => props.onClose());
    act(() => {
      props.onDelete();
      props.onTurnInto(
        MARKDOWN_EDITOR_TURN_INTO_OPTIONS.find((option) => option.kind === 'paragraph')!,
      );
    });
    expect(view.state.doc.textContent).toBe('Retained paragraph');
    expect(document.querySelector('[role="menu"][aria-label="Block actions"]')).toBeNull();
  });

  test('placeholder prop changes update the live editor without replacing its view', async () => {
    await renderEditor({ placeholder: 'e.g. Original hint' });
    const surface = await waitForEditor();
    await renderEditor({ placeholder: 'e.g. Updated hint' });
    expect(container.querySelector('[data-slot="markdown-editor"]')).toBe(surface);
    await vi.waitFor(() =>
      expect(surface.querySelector('.crepe-placeholder')?.getAttribute('data-placeholder')).toBe(
        'e.g. Updated hint',
      ),
    );
  });

  test('keyboard navigation and scroll reset remain usable without Element.scrollTo', async () => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo');
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: undefined,
    });
    try {
      await renderEditor();
      await waitForEditor();
      await getAddControl();
      await act(async () => {
        getByRole(container, 'button', { name: 'Open block actions' }).click();
        await Promise.resolve();
      });
      const menu = getByRole(document.body, 'menu', { name: 'Block actions' });
      expect(menu.scrollTop).toBe(0);
      await act(async () => {
        menu.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }),
        );
        await Promise.resolve();
      });
      expect(document.activeElement).toBe(getByRole(menu, 'menuitem', { name: 'Delete row' }));
      await act(async () => {
        menu.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }),
        );
        await Promise.resolve();
      });
      expect(document.activeElement).toBe(getByRole(menu, 'menuitemradio', { name: 'Text' }));
    } finally {
      if (original) Object.defineProperty(HTMLElement.prototype, 'scrollTo', original);
      else Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo');
    }
  });

  test('keyboard block actions receive focus, navigate commands, and restore the trigger on Escape', async () => {
    await renderEditor();
    await waitForEditor();
    await getAddControl();
    const trigger = getByRole(container, 'button', { name: 'Open block actions' });
    await act(async () => {
      trigger.focus();
      trigger.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });
    const menu = getByRole(document.body, 'menu', { name: 'Block actions' });
    const first = getByRole(menu, 'menuitemradio', { name: 'Text' });
    expect(document.activeElement).toBe(first);
    await act(async () => {
      first.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(getByRole(menu, 'menuitemradio', { name: 'Heading 1' }));
    await act(async () => {
      menu.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(getByRole(menu, 'menuitem', { name: 'Delete row' }));
    await act(async () => {
      menu.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });
    expect(document.querySelector('[role="menu"][aria-label="Block actions"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  test('block menus stay open for internal interaction, track geometry, and dismiss outside the menu', async () => {
    await renderEditor();
    await waitForEditor();
    await getAddControl();
    const trigger = getByRole(container, 'button', { name: 'Open block actions' });
    let triggerLeft = 64;
    vi.spyOn(trigger, 'getBoundingClientRect').mockImplementation(
      () => new DOMRect(triggerLeft, 64, 32, 32),
    );
    await act(async () => {
      trigger.click();
      await Promise.resolve();
    });
    const menu = getByRole(document.body, 'menu', { name: 'Block actions' });
    const initialLeft = menu.style.left;
    await act(async () => {
      menu.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      menu.dispatchEvent(new Event('scroll', { bubbles: true }));
      menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      window.dispatchEvent(new Event('resize'));
      await Promise.resolve();
    });
    expect(getByRole(document.body, 'menu', { name: 'Block actions' })).toBe(menu);
    expect(menu.style.left).toBe(initialLeft);
    await act(async () => {
      document.dispatchEvent(new Event('scroll'));
      await Promise.resolve();
    });
    expect(getByRole(document.body, 'menu', { name: 'Block actions' })).toBe(menu);
    triggerLeft = 96;
    await act(async () => {
      window.dispatchEvent(new Event('resize'));
      await Promise.resolve();
    });
    expect(menu.style.left).not.toBe(initialLeft);
    await act(async () => {
      document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      window.dispatchEvent(new Event('resize'));
      await Promise.resolve();
    });
    expect(document.querySelector('[role="menu"][aria-label="Block actions"]')).toBeNull();
    await act(async () => {
      trigger.click();
      await Promise.resolve();
    });
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      await Promise.resolve();
    });
    expect(document.querySelector('[role="menu"][aria-label="Block actions"]')).toBeNull();
  });

  test('a disappearing block trigger dismisses its menu safely and image-only policy retains deletion', async () => {
    await renderEditor({ supportedTools: [MARKDOWN_EDITOR_TOOLS.Image] });
    await waitForEditor();
    await getAddControl();
    const trigger = getByRole(container, 'button', { name: 'Open block actions' });
    await act(async () => {
      trigger.click();
      await Promise.resolve();
    });
    const menu = getByRole(document.body, 'menu', { name: 'Block actions' });
    expect(menu.querySelector('[role="menuitemradio"]')).toBeNull();
    await act(async () => {
      getByRole(menu, 'menuitem', { name: 'Delete row' }).click();
      await Promise.resolve();
    });
    expect(document.querySelector('[role="menu"][aria-label="Block actions"]')).toBeNull();
    expect(editors[0]!.action((ctx) => ctx.get(editorViewCtx).state.doc.childCount)).toBe(1);
    await act(async () => {
      trigger.click();
      await Promise.resolve();
    });
    expect(getByRole(document.body, 'menu', { name: 'Block actions' })).not.toBeNull();
    await act(async () => {
      trigger.remove();
      window.dispatchEvent(new Event('resize'));
      await Promise.resolve();
    });
    expect(document.querySelector('[role="menu"][aria-label="Block actions"]')).toBeNull();
  });

  test('adds and edits a real YouTube atom through the retained authoring dialog', async () => {
    const onChange = vi.fn();
    await renderEditor({ supportedTools: MARKDOWN_EDITOR_ALL_TOOLS, value: '/youtube', onChange });
    await waitForEditor();
    await act(async () => {
      editors[0]!.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        view.focus();
        view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)));
      });
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(getByText(document.body, 'YouTube video', { exact: true })).not.toBeNull();
    });
    await act(async () => {
      getByText(document.body, 'YouTube video', { exact: true })
        .closest('li')!
        .dispatchEvent(new Event('pointerup', { bubbles: true }));
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(getByRole(document.body, 'dialog', { name: 'Add YouTube video' })).not.toBeNull();
    });
    await act(async () => {
      changeInput('YouTube URL', 'https://youtu.be/M7lc1UVf-VE');
      changeInput('Title (optional)', 'First walkthrough');
      getByRole(document.body, 'button', { name: 'Add video' }).click();
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('iframe')?.getAttribute('title')).toBe('First walkthrough');
      expect(onChange).toHaveBeenCalledWith(
        expect.stringContaining('[First walkthrough](https://www.youtube.com/watch?v=M7lc1UVf-VE)'),
      );
    });
    await vi.waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    });
    await act(async () => {
      getByRole(container, 'button', { name: 'Edit YouTube video' }).click();
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(getByRole(document.body, 'dialog', { name: 'Edit YouTube video' })).not.toBeNull();
    });
    await act(async () => {
      changeInput('Title (optional)', 'Revised walkthrough');
      getByRole(document.body, 'button', { name: 'Save' }).click();
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('iframe')?.getAttribute('title')).toBe('Revised walkthrough');
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    });
    expect(getByRole(container, 'button', { name: 'Edit YouTube video' })).toBe(
      document.activeElement,
    );
  });

  test('canceling video authoring closes the dialog without modifying the existing atom', async () => {
    await renderEditor({
      supportedTools: MARKDOWN_EDITOR_ALL_TOOLS,
      value: '[Original](https://youtu.be/M7lc1UVf-VE)',
    });
    await waitForEditor();
    await act(async () => {
      getByRole(container, 'button', { name: 'Edit YouTube video' }).click();
      await Promise.resolve();
    });
    await vi.waitFor(() =>
      expect(getByRole(document.body, 'dialog', { name: 'Edit YouTube video' })).not.toBeNull(),
    );
    await act(async () => {
      getByRole(document.body, 'button', { name: 'Close dialog' }).click();
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
    expect(container.querySelector('iframe')?.title).toBe('Original');
    expect(document.activeElement).toBe(
      getByRole(container, 'button', { name: 'Edit YouTube video' }),
    );
  });

  test.each([
    ['wide document', {}, 'wide'],
    ['compact document', {}, 'compact'],
    ['chat', { editorMode: 'chat' as const }, 'compact'],
  ])('synchronizes native and accessible readonly state in %s', async (_scenario, mode, layout) => {
    const onChange = vi.fn();
    const props = {
      ...mode,
      'aria-describedby': 'note-help note-error',
      'aria-invalid': true as const,
      'aria-required': true as const,
      disabled: true,
      onChange,
      value: 'Existing note',
    };
    await renderEditor(props, layout);
    await waitForEditor();
    const textbox = container.querySelector<HTMLElement>('[role="textbox"]')!;
    expect(textbox.getAttribute('contenteditable')).toBe('false');
    expect(textbox.getAttribute('aria-readonly')).toBe('true');

    await renderEditor({ ...props, disabled: false }, layout);
    expect(container.querySelector('[role="textbox"]')).toBe(textbox);
    expect(textbox.getAttribute('contenteditable')).toBe('true');
    expect(textbox.getAttribute('aria-readonly')).toBe('false');

    await renderEditor(props, layout);
    expect(textbox.getAttribute('contenteditable')).toBe('false');
    expect(textbox.getAttribute('aria-readonly')).toBe('true');
    expect(textbox.getAttribute('aria-label')).toBe('Test note');
    expect(textbox.getAttribute('aria-describedby')).toBe('note-help note-error');
    expect(textbox.getAttribute('aria-invalid')).toBe('true');
    expect(textbox.getAttribute('aria-required')).toBe('true');
    expect(textbox.textContent).toBe('Existing note');
    expect(onChange).not.toHaveBeenCalled();
    expect(editors).toHaveLength(1);
  });

  test.each([false, true])(
    'applies the latest disabled state after asynchronous creation starts from %s',
    async (initialDisabled) => {
      const makeEditor = makeEditorSpy.getMockImplementation()!;
      const creationGate = new Promise<void>((resolve) => {
        releaseCreation = resolve;
      });
      makeEditorSpy.mockImplementation(() => {
        const editor = makeEditor();
        const createEditor = editor.create.bind(editor);
        vi.spyOn(editor, 'create').mockImplementation(async () => {
          await creationGate;
          return createEditor();
        });
        return editor;
      });

      await renderEditor({ disabled: initialDisabled, value: 'Retained draft' });
      expect(container.querySelector('.ProseMirror')).toBeNull();
      await renderEditor({ disabled: !initialDisabled, value: 'Retained draft' });
      releaseCreation?.();
      await waitForEditor();
      const textbox = container.querySelector('[role="textbox"]')!;
      expect(textbox.getAttribute('aria-readonly')).toBe(String(!initialDisabled));
      expect(textbox.getAttribute('contenteditable')).toBe(String(initialDisabled));
      expect(textbox.textContent).toBe('Retained draft');
      expect(editors).toHaveLength(1);
    },
  );

  test('retains readonly semantics and the controlled draft across a theme remount', async () => {
    await renderEditor({ disabled: true, value: 'Retained draft' });
    await waitForEditor();
    const originalTextbox = container.querySelector('[role="textbox"]');
    await renderEditor({ disabled: true, isDarkMode: true, value: 'Retained draft' });
    await waitForEditor();
    const textbox = container.querySelector('[role="textbox"]')!;
    expect(textbox).not.toBe(originalTextbox);
    expect(textbox.getAttribute('contenteditable')).toBe('false');
    expect(textbox.getAttribute('aria-readonly')).toBe('true');
    expect(textbox.textContent).toBe('Retained draft');
    expect(editors).toHaveLength(2);
  });

  test('retains the busy authoring surface while the real editor creates asynchronously', async () => {
    const makeEditor = makeEditorSpy.getMockImplementation()!;
    const creationGate = new Promise<void>((resolve) => {
      releaseCreation = resolve;
    });

    makeEditorSpy.mockImplementation(() => {
      const editor = makeEditor();
      const createEditor = editor.create.bind(editor);
      vi.spyOn(editor, 'create').mockImplementation(async () => {
        await creationGate;
        return createEditor();
      });
      return editor;
    });

    await renderEditor();
    const surface = container.querySelector('[data-slot="markdown-editor"]');

    expect(surface?.getAttribute('aria-busy')).toBe('true');
    expect(surface?.getAttribute('data-editor-mode')).toBe('document');
    expect(container.querySelector('.ProseMirror')).toBeNull();

    releaseCreation?.();
    expect(await waitForEditor()).toBe(surface);
    expect(container.querySelector('.ProseMirror')).not.toBeNull();
  });

  test('keeps an already-mounted view readonly until the async editor handoff completes', async () => {
    const makeEditor = makeEditorSpy.getMockImplementation()!;
    const creationGate = new Promise<void>((resolve) => {
      releaseCreation = resolve;
    });
    makeEditorSpy.mockImplementation(() => {
      const editor = makeEditor();
      const createEditor = editor.create.bind(editor);
      vi.spyOn(editor, 'create').mockImplementation(async () => {
        const created = await createEditor();
        await creationGate;
        return created;
      });
      return editor;
    });
    await renderEditor({ value: 'Retained draft' });
    await vi.waitFor(() => {
      expect(container.querySelector('[role="textbox"]')).not.toBeNull();
    });
    const textbox = container.querySelector('[role="textbox"]')!;
    expect(
      container.querySelector('[data-slot="markdown-editor"]')?.getAttribute('aria-busy'),
    ).toBe('true');
    expect(textbox.getAttribute('contenteditable')).toBe('false');
    releaseCreation?.();
    await waitForEditor();
    expect(textbox.getAttribute('contenteditable')).toBe('true');
    expect(textbox.textContent).toBe('Retained draft');
  });

  test.each(['pointer', 'touch', 'Enter', ' '])(
    'opens the empty block insertion menu with %s before any hover, without changing the document',
    async (activation) => {
      const onChange = vi.fn();
      await renderEditor({ onChange });
      const surface = await waitForEditor();
      const addControl = await getAddControl();

      expect(surface.dataset['emptyBlockHandle']).toBe('true');
      expect(addControl.tabIndex).toBe(0);
      expect(addControl.closest('.milkdown-block-handle')?.getAttribute('data-show')).toBe('false');

      await act(async () => {
        addControl.focus();
        if (activation === 'pointer' || activation === 'touch') {
          for (const eventType of ['pointerdown', 'pointerup']) {
            const event = new Event(eventType, { bubbles: true, cancelable: true });
            Object.defineProperty(event, 'pointerType', {
              value: activation === 'touch' ? 'touch' : 'mouse',
            });
            addControl.dispatchEvent(event);
            if (eventType === 'pointerdown') {
              expect(addControl.classList.contains('active')).toBe(true);
            }
            addControl.dispatchEvent(
              new MouseEvent(eventType === 'pointerdown' ? 'mousedown' : 'mouseup', {
                bubbles: true,
                cancelable: true,
              }),
            );
          }
          addControl.dispatchEvent(
            new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }),
          );
        } else {
          addControl.dispatchEvent(
            new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: activation }),
          );
        }
        await vi.waitFor(() => {
          expect(
            document.querySelector('[data-slot="markdown-editor-slash-menu-portal"]'),
          ).not.toBeNull();
        });
      });

      const documentState = editors[0]!.action((ctx) => ctx.get(editorViewCtx).state.doc);
      expect(documentState.childCount).toBe(1);
      expect(documentState.firstChild?.textContent).toBe('');
      expect(onChange).not.toHaveBeenCalled();
      expect(addControl.classList.contains('active')).toBe(false);
      expect(document.activeElement?.getAttribute('role')).toBe('textbox');
      if (activation === 'touch') {
        const textbox = container.querySelector<HTMLElement>('[role="textbox"]')!;
        expect(textbox.getAttribute('inputmode')).toBe('none');
        textbox.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        expect(textbox.hasAttribute('inputmode')).toBe(false);
      }
    },
  );

  test.each(['pointer', 'Enter', ' '])(
    'opens empty block actions with %s before any hover and changes the existing block',
    async (activation) => {
      await renderEditor();
      const surface = await waitForEditor();
      await getAddControl();
      const blockActionsControl = surface.querySelector<HTMLElement>(
        '[role="button"][aria-label="Open block actions"]',
      )!;

      expect(blockActionsControl).not.toBeNull();
      expect(blockActionsControl.tabIndex).toBe(0);
      expect(blockActionsControl.closest('.milkdown-block-handle')?.getAttribute('data-show')).toBe(
        'false',
      );

      await act(async () => {
        blockActionsControl.focus();
        if (activation === 'pointer') {
          blockActionsControl.click();
        } else {
          blockActionsControl.dispatchEvent(
            new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: activation }),
          );
        }

        await Promise.resolve();
      });

      const menu = document.querySelector<HTMLElement>('[role="menu"][aria-label="Block actions"]');
      expect(menu).not.toBeNull();
      const headingAction = Array.from(menu!.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent?.includes('Heading 1'),
      );
      expect(headingAction).not.toBeUndefined();

      await act(async () => {
        headingAction!.click();
        await Promise.resolve();
      });
      const doc = editors[0]!.action((ctx) => ctx.get(editorViewCtx).state.doc);
      expect(doc.childCount).toBe(1);
      expect(doc.firstChild?.type.name).toBe('heading');
      expect(doc.firstChild?.content.size).toBe(0);
      expect(document.querySelector('[role="menu"][aria-label="Block actions"]')).toBeNull();
    },
  );

  test('uses the native menu to change the empty block and can reopen on the empty heading', async () => {
    await renderEditor();
    await waitForEditor();
    const addControl = await getAddControl();

    await act(async () => {
      addControl.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }),
      );
      await vi.waitFor(() => {
        expect(
          document.querySelector('[data-slot="markdown-editor-slash-menu-portal"]'),
        ).not.toBeNull();
      });
    });

    const headingLabel = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-slot="markdown-editor-slash-menu-portal"] span',
      ),
    ).find((label) => label.textContent === 'Heading 1');
    const headingOption = headingLabel?.closest('li');
    expect(headingOption).not.toBeNull();

    await act(async () => {
      headingOption!.dispatchEvent(new Event('pointerup', { bubbles: true, cancelable: true }));
      await vi.waitFor(() => {
        expect(container.querySelector('[role="textbox"] h1')).not.toBeNull();
        expect(
          document.querySelector('[data-slot="markdown-editor-slash-menu-portal"]'),
        ).toBeNull();
      });
    });

    const doc = editors[0]!.action((ctx) => ctx.get(editorViewCtx).state.doc);
    expect(doc.childCount).toBe(1);
    expect(doc.firstChild?.content.size).toBe(0);

    await act(async () => {
      addControl.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }),
      );
      await vi.waitFor(() => {
        expect(
          document.querySelector('[data-slot="markdown-editor-slash-menu-portal"]'),
        ).not.toBeNull();
      });
    });
    expect(
      editors[0]!.action((ctx) => ctx.get(editorViewCtx).state.doc.firstChild?.type.name),
    ).toBe('heading');
  });

  test('updates the empty control for typing and controlled replacement without recreating the editor', async () => {
    const onChange = vi.fn();
    await renderEditor({ onChange });
    const surface = await waitForEditor();
    const addControl = await getAddControl();
    const editor = editors[0]!;

    await act(async () => {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        view.dispatch(view.state.tr.insertText('New note'));
      });
      await vi.waitFor(() => {
        expect(surface.dataset['emptyBlockHandle']).toBe('false');
        expect(onChange).toHaveBeenCalledWith(expect.stringContaining('New note'));
      });
    });

    expect(container.querySelector('[aria-label="Insert block"]')).toBeNull();
    expect(addControl.hasAttribute('aria-label')).toBe(false);
    expect(addControl.hasAttribute('role')).toBe(false);
    expect(addControl.hasAttribute('tabindex')).toBe(false);
    await renderEditor({ onChange, value: 'Saved note' });
    expect(container.querySelector('[role="textbox"]')?.textContent).toBe('Saved note');
    expect(surface.dataset['emptyBlockHandle']).toBe('false');

    await renderEditor({ onChange, value: '' });
    await getAddControl();
    expect(surface.dataset['emptyBlockHandle']).toBe('true');
    expect(editors).toHaveLength(1);
  });

  test('reports typing as the editor loses focus, before the debounced update', async () => {
    const onChange = vi.fn();
    await renderEditor({ onChange });
    await waitForEditor();
    const editor = editors[0]!;

    act(() => {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        view.dispatch(view.state.tr.insertText('Quick note'));
        view.dom.dispatchEvent(new FocusEvent('blur'));
      });
    });

    expect(onChange).toHaveBeenCalledWith('Quick note\n');
  });

  test('suppresses the empty control and activation while disabled, then restores it when enabled', async () => {
    await renderEditor();
    const surface = await waitForEditor();
    const addControl = await getAddControl();
    await renderEditor({ disabled: true });

    expect(surface.dataset['emptyBlockHandle']).toBe('false');
    expect(addControl.hasAttribute('tabindex')).toBe(false);
    expect(addControl.hasAttribute('role')).toBe(false);
    expect(addControl.hasAttribute('aria-label')).toBe(false);

    await act(async () => {
      addControl.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }),
      );

      await Promise.resolve();
    });

    expect(document.querySelector('.milkdown-slash-menu[data-show="true"]')).toBeNull();
    await renderEditor();
    expect(await getAddControl()).toBe(addControl);
    expect(editors).toHaveLength(1);
  });

  test.each([
    ['compact layout', {}, 'compact'],
    ['chat mode', { editorMode: 'chat' as const }, 'wide'],
    ['no insertion tools', { supportedTools: [] }, 'wide'],
    ['populated document', { value: 'Existing note' }, 'wide'],
    ['multiple empty paragraphs', {}, 'wide'],
  ])(
    'keeps the existing control visibility for %s',
    { tags: ['full'] },
    async (scenario, props, layout) => {
      await renderEditor(props, layout);
      const surface = await waitForEditor();

      if (scenario === 'multiple empty paragraphs') {
        await act(async () => {
          editors[0]!.action(replaceAll('\n\n', true));
          const view = editors[0]!.action((ctx) => ctx.get(editorViewCtx));
          view.dispatch(view.state.tr.insert(0, view.state.schema.nodes['paragraph']!.create()));

          await Promise.resolve();
        });
      }

      await act(async () => {
        await vi.waitFor(() => {
          expect(surface.dataset['emptyBlockHandle']).toBe('false');
        });
      });
      expect(container.querySelector('[role="button"][aria-label="Insert block"]')).toBeNull();
      const addControl = container.querySelector<HTMLElement>(
        '.milkdown-block-handle > .operation-item:first-child',
      );
      if (addControl) {
        expect(addControl.hasAttribute('aria-label')).toBe(false);
        expect(addControl.hasAttribute('role')).toBe(false);
        expect(addControl.hasAttribute('tabindex')).toBe(false);
      }
    },
  );
});
