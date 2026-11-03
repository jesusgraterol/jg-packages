import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Editor, EditorStatus, editorViewCtx } from '@milkdown/kit/core';
import { DOMParser as ProseMirrorDomParser } from '@milkdown/kit/prose/model';
import { getByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, test, vi, type MockInstance } from 'vitest';

import { createChatPasteEvent } from './clipboard.test-utils.js';
import { ChatMarkdownEditor } from './chat-editor.component.js';
import type { IChatMarkdownEditorControls } from './types.js';

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

describe('ChatMarkdownEditor', () => {
  let container: HTMLDivElement;
  let root: Root;
  let editors: Editor[];
  let makeEditorSpy: MockInstance<typeof Editor.make>;
  let originalActEnvironment: PropertyDescriptor | undefined;

  const flushEditor = async (): Promise<void> => {
    await act(async () => {
      await vi.waitFor(() => {
        expect(editors.at(-1)?.status).toBe(EditorStatus.Created);
        expect(container.querySelector('[role="textbox"]')).not.toBeNull();
      });
    });
  };

  beforeEach(() => {
    originalActEnvironment = Object.getOwnPropertyDescriptor(
      globalThis,
      'IS_REACT_ACT_ENVIRONMENT',
    );
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    editors = [];
    const makeEditor = Editor.make.bind(Editor);

    makeEditorSpy = vi.spyOn(Editor, 'make').mockImplementation(() => {
      const editor = makeEditor();

      editors.push(editor);
      return editor;
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    try {
      act(() => root.unmount());
      await vi.waitFor(() => {
        for (const editor of editors) {
          expect(editor.status).toBe(EditorStatus.Destroyed);
        }
      });
    } finally {
      container.remove();
      vi.restoreAllMocks();
      if (originalActEnvironment)
        Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', originalActEnvironment);
      else Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
    }
  });

  test('initial controls retain the draft and deny insertion until the real editor is ready', async () => {
    const makeEditor = makeEditorSpy.getMockImplementation()!;
    let releaseCreation: (() => void) | undefined;
    const creationGate = new Promise<void>((resolve) => {
      releaseCreation = resolve;
    });
    makeEditorSpy.mockImplementation(() => {
      const editor = makeEditor();
      const create = editor.create.bind(editor);
      vi.spyOn(editor, 'create').mockImplementation(async () => {
        await creationGate;
        return create();
      });
      return editor;
    });
    const controlsRef = createRef<IChatMarkdownEditorControls>();
    const onChange = vi.fn();
    try {
      await act(async () => {
        root.render(
          <ChatMarkdownEditor
            controlsRef={controlsRef}
            maxLength={256}
            onChange={onChange}
            value="Retained draft"
          />,
        );
        await Promise.resolve();
      });
      await act(async () => {
        await vi.waitFor(() => expect(editors).toHaveLength(1));
      });
      expect(controlsRef.current).not.toBeNull();
      expect(controlsRef.current?.getMarkdown()).toBe('Retained draft');
      expect(controlsRef.current?.appendLiteralText('Early insertion')).toBe(false);
      expect(() => controlsRef.current?.focus()).not.toThrow();
      await act(async () => {
        getByRole(container, 'button', { name: 'Format message' }).click();
        await Promise.resolve();
      });
      await act(async () => {
        getByRole(document.body, 'menuitem', { name: 'Heading 2' }).click();
        await Promise.resolve();
      });
      expect(controlsRef.current?.getMarkdown()).toBe('Retained draft');
      expect(onChange).not.toHaveBeenCalled();
    } finally {
      releaseCreation?.();
      await flushEditor();
    }
  });

  test('exposes a synchronous normalized snapshot and safely appends literal text', async () => {
    const controlsRef = createRef<IChatMarkdownEditorControls>();
    const onChange = vi.fn();

    await act(async () => {
      root.render(
        <ChatMarkdownEditor
          controlsRef={controlsRef}
          maxLength={256}
          value="Hello"
          onChange={onChange}
        />,
      );

      await Promise.resolve();
    });
    await flushEditor();

    expect(controlsRef.current?.getMarkdown().trim()).toBe('Hello');

    act(() => {
      expect(controlsRef.current?.appendLiteralText('# Not a heading')).toBe(true);
    });
    await flushEditor();

    expect(onChange.mock.calls.at(-1)?.[0]).toContain('\\# Not a heading');
    expect(controlsRef.current?.getMarkdown()).toContain('\\# Not a heading');
  });

  test('the first literal insertion into an empty chat starts at the first paragraph', async () => {
    const controlsRef = createRef<IChatMarkdownEditorControls>();
    const onChange = vi.fn();
    act(() => {
      root.render(
        <ChatMarkdownEditor
          controlsRef={controlsRef}
          maxLength={256}
          value=""
          onChange={onChange}
        />,
      );
    });
    await flushEditor();
    act(() => {
      expect(controlsRef.current!.appendLiteralText('# Heading text')).toBe(true);
    });
    expect(onChange.mock.calls.at(-1)?.[0]).toBe('\\# Heading text');
    expect(controlsRef.current!.getMarkdown().trim()).toBe('\\# Heading text');
  });

  test('emits serialized document changes while the editor is mounted', async () => {
    const onChange = vi.fn();

    await act(async () => {
      root.render(
        <ChatMarkdownEditor
          maxLength={256}
          value="Hello"
          onChange={onChange}
        />,
      );

      await Promise.resolve();
    });
    await flushEditor();

    const editor = editors[0];

    if (!editor) {
      throw new Error('The chat editor did not mount.');
    }

    await act(async () => {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);

        view.dispatch(view.state.tr.insertText(' world', view.state.doc.content.size - 1));
      });
      await vi.waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.stringContaining('Hello world'));
      });
    });
  });

  test(
    'moves the formatting trigger into an external container when requested',
    { tags: ['full'] },
    async () => {
      const formattingContainer = document.createElement('div');
      document.body.appendChild(formattingContainer);

      await act(async () => {
        root.render(
          <ChatMarkdownEditor
            formattingContainer={null}
            maxLength={256}
            value="Hello"
            onChange={vi.fn()}
          />,
        );

        await Promise.resolve();
      });

      expect(container.querySelector('[aria-label="Format message"]')).toBeNull();
      expect(formattingContainer.querySelector('[aria-label="Format message"]')).toBeNull();

      await act(async () => {
        root.render(
          <ChatMarkdownEditor
            formattingContainer={formattingContainer}
            maxLength={256}
            value="Hello"
            onChange={vi.fn()}
          />,
        );

        await Promise.resolve();
      });

      expect(container.querySelector('[aria-label="Format message"]')).toBeNull();
      expect(formattingContainer.querySelector('[aria-label="Format message"]')).not.toBeNull();

      formattingContainer.remove();
    },
  );

  test(
    'collapses inactive feedback space and reveals the character count near the limit',
    { tags: ['full'] },
    async () => {
      await act(async () => {
        root.render(
          <ChatMarkdownEditor
            maxLength={10}
            value="Short"
            onChange={vi.fn()}
          />,
        );

        await Promise.resolve();
      });

      const status = container.querySelector('[data-slot="chat-markdown-editor-status"]');

      expect(status?.classList.contains('sr-only')).toBe(true);

      await act(async () => {
        root.render(
          <ChatMarkdownEditor
            maxLength={10}
            value="12345678"
            onChange={vi.fn()}
          />,
        );

        await Promise.resolve();
      });

      expect(status?.classList.contains('sr-only')).toBe(false);
      expect(status?.textContent).toContain('8/10');
    },
  );

  test('requests submission for Ctrl+Enter but not during IME composition', async () => {
    const onSubmitRequest = vi.fn();

    await act(async () => {
      root.render(
        <ChatMarkdownEditor
          maxLength={256}
          value="Ready"
          onChange={vi.fn()}
          onSubmitRequest={onSubmitRequest}
        />,
      );

      await Promise.resolve();
    });
    await flushEditor();

    const editor = container.querySelector<HTMLElement>('.ProseMirror');

    if (!editor) {
      throw new Error('The chat editor did not mount.');
    }

    const composingEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      ctrlKey: true,
      key: 'Enter',
    });
    Object.defineProperty(composingEvent, 'isComposing', { value: true });

    act(() => {
      editor.dispatchEvent(composingEvent);
      editor.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, ctrlKey: true, key: 'Enter' }),
      );
    });

    act(() => {
      editor.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, metaKey: true, key: 'Enter' }),
      );
    });
    expect(onSubmitRequest).toHaveBeenCalledTimes(2);
    expect(onSubmitRequest).toHaveBeenCalledWith(expect.stringContaining('Ready'));
  });

  test('Tab and Shift+Tab leave a message for the controls around it, but stay in a list item', async () => {
    await act(async () => {
      root.render(
        <>
          <button type="button">Before</button>
          {/* without its formatting button, the controls around it come right before and after */}
          <ChatMarkdownEditor
            formattingContainer={null}
            maxLength={256}
            value="Ready"
            onChange={vi.fn()}
          />
          <button type="button">After</button>
        </>,
      );

      await Promise.resolve();
    });
    await flushEditor();

    const editor = container.querySelector<HTMLElement>('.ProseMirror');

    if (!editor) {
      throw new Error('The chat editor did not mount.');
    }

    const pressTab = (shiftKey: boolean): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'Tab',
        shiftKey,
      });
      act(() => {
        editor.dispatchEvent(event);
      });
      return event;
    };

    editor.focus();
    expect(pressTab(false).defaultPrevented).toBe(true);
    expect(document.activeElement?.textContent).toBe('After');
    editor.focus();
    pressTab(true);
    expect(document.activeElement?.textContent).toBe('Before');

    // in a list item, Tab nests the item, so the focus stays in the message
    await act(async () => {
      root.render(
        <>
          <button type="button">Before</button>
          <ChatMarkdownEditor
            formattingContainer={null}
            maxLength={256}
            value={'- First\n- Second'}
            onChange={vi.fn()}
          />
          <button type="button">After</button>
        </>,
      );

      await Promise.resolve();
    });
    await vi.waitFor(() => expect(editor.querySelector('li')).not.toBeNull());
    editor.focus();
    pressTab(false);
    expect(editor.contains(document.activeElement)).toBe(true);
  });

  test.each([
    [true, 1],
    [false, 0],
  ])(
    'with isShiftEnterSubmit %s, Shift+Enter requests submission %i times, never while composing',
    async (isShiftEnterSubmit, submissions) => {
      const onSubmitRequest = vi.fn();

      await act(async () => {
        root.render(
          <ChatMarkdownEditor
            isShiftEnterSubmit={isShiftEnterSubmit}
            maxLength={256}
            value="Ready"
            onChange={vi.fn()}
            onSubmitRequest={onSubmitRequest}
          />,
        );

        await Promise.resolve();
      });
      await flushEditor();

      const editor = container.querySelector<HTMLElement>('.ProseMirror');

      if (!editor) {
        throw new Error('The chat editor did not mount.');
      }

      const composingEvent = new KeyboardEvent('keydown', {
        bubbles: true,
        shiftKey: true,
        key: 'Enter',
      });
      Object.defineProperty(composingEvent, 'isComposing', { value: true });

      act(() => {
        editor.dispatchEvent(composingEvent);
        editor.dispatchEvent(
          new KeyboardEvent('keydown', {
            bubbles: true,
            altKey: true,
            shiftKey: true,
            key: 'Enter',
          }),
        );
        editor.dispatchEvent(
          new KeyboardEvent('keydown', { bubbles: true, shiftKey: true, key: 'Enter' }),
        );
      });
      expect(onSubmitRequest).toHaveBeenCalledTimes(submissions);
      if (submissions > 0)
        expect(onSubmitRequest).toHaveBeenCalledWith(expect.stringContaining('Ready'));
    },
  );

  test('normalizes a changed controlled value through the fixed chat policy', async () => {
    const controlsRef = createRef<IChatMarkdownEditorControls>();
    const onChange = vi.fn();

    await act(async () => {
      root.render(
        <ChatMarkdownEditor
          controlsRef={controlsRef}
          maxLength={512}
          value="Initial"
          onChange={onChange}
        />,
      );

      await Promise.resolve();
    });
    await flushEditor();

    await act(async () => {
      root.render(
        <ChatMarkdownEditor
          controlsRef={controlsRef}
          maxLength={512}
          value={'#### Deep heading\n\n> Quoted text\n\n<script>hidden</script>'}
          onChange={onChange}
        />,
      );

      await Promise.resolve();
    });
    await flushEditor();

    const markdown = controlsRef.current?.getMarkdown() ?? '';

    expect(markdown).toContain('### Deep heading');
    expect(markdown).toContain('Quoted text');
    expect(markdown).not.toContain('script');
    expect(markdown).not.toContain('hidden');
  });

  test('a changed controlled value keeps the focus and puts the caret at its end, unreported', async () => {
    const controlsRef = createRef<IChatMarkdownEditorControls>();
    const onChange = vi.fn<(markdown: string) => void>();
    const render = async (value: string): Promise<void> => {
      await act(async () => {
        root.render(
          <ChatMarkdownEditor
            controlsRef={controlsRef}
            maxLength={256}
            value={value}
            onChange={onChange}
          />,
        );
        await Promise.resolve();
      });
    };

    await render('First');
    await flushEditor();
    act(() => controlsRef.current?.focus());
    await vi.waitFor(() => {
      expect(document.activeElement?.getAttribute('role')).toBe('textbox');
    });

    await render('Second, recalled');
    await vi.waitFor(() => {
      expect(controlsRef.current?.getMarkdown().trim()).toBe('Second, recalled');
    });
    expect(document.activeElement?.getAttribute('role')).toBe('textbox');

    // what is typed next goes after the new text
    act(() => {
      editors.at(-1)?.action((ctx) => {
        const view = ctx.get(editorViewCtx);

        view.dispatch(view.state.tr.insertText('!'));
      });
    });
    expect(controlsRef.current?.getMarkdown().trim()).toBe('Second, recalled!');

    // the value the editor took is never reported back as an edit, while the typed one is
    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(expect.stringContaining('recalled!'));
    });
    expect(onChange.mock.calls.some(([markdown]) => markdown.trim() === 'Second, recalled')).toBe(
      false,
    );
  });

  test('appending literal text keeps the editor focused', async () => {
    const controlsRef = createRef<IChatMarkdownEditorControls>();

    await act(async () => {
      root.render(
        <ChatMarkdownEditor
          controlsRef={controlsRef}
          maxLength={256}
          value="Hello"
          onChange={vi.fn()}
        />,
      );
      await Promise.resolve();
    });
    await flushEditor();
    act(() => controlsRef.current?.focus());
    await vi.waitFor(() => {
      expect(document.activeElement?.getAttribute('role')).toBe('textbox');
    });

    act(() => {
      expect(controlsRef.current?.appendLiteralText('world')).toBe(true);
    });

    expect(controlsRef.current?.getMarkdown()).toContain('world');
    expect(document.activeElement?.getAttribute('role')).toBe('textbox');
  });

  test('counts a message at its limit without the line break its Markdown ends with', async () => {
    const render = async (value: string): Promise<void> => {
      await act(async () => {
        root.render(
          <ChatMarkdownEditor
            maxLength={5}
            value={value}
            onChange={vi.fn()}
          />,
        );
        await Promise.resolve();
      });
    };
    const status = (): string =>
      container.querySelector('[data-slot="chat-markdown-editor-status"]')?.textContent ?? '';

    await render('Hello\n');
    await flushEditor();
    expect(status()).toContain('5/5');
    expect(status()).not.toContain('The message is longer than the allowed limit.');

    await render('Hello!\n');
    expect(status()).toContain('6/5');
    expect(status()).toContain('The message is longer than the allowed limit.');
  });

  test('rejects literal insertion beyond the configured serialized limit', async () => {
    const controlsRef = createRef<IChatMarkdownEditorControls>();
    const onChange = vi.fn();

    await act(async () => {
      root.render(
        <ChatMarkdownEditor
          controlsRef={controlsRef}
          maxLength={8}
          value="Hello"
          onChange={onChange}
        />,
      );

      await Promise.resolve();
    });
    await flushEditor();

    act(() => {
      expect(controlsRef.current?.appendLiteralText('world')).toBe(false);
    });

    expect(controlsRef.current?.getMarkdown().trim()).toBe('Hello');
    expect(onChange).not.toHaveBeenCalled();
  });

  test.each([
    ['Text', 'p'],
    ['Heading 1', 'h1'],
    ['Heading 2', 'h2'],
    ['Heading 3', 'h3'],
    ['Bulleted list', 'ul'],
    ['Numbered list', 'ol'],
  ])(
    'applies %s from the actual formatting menu and returns focus to the editor',
    async (name, tag) => {
      const controlsRef = createRef<IChatMarkdownEditorControls>();
      await act(async () => {
        root.render(
          <ChatMarkdownEditor
            controlsRef={controlsRef}
            maxLength={512}
            onChange={vi.fn()}
            value="Draft"
          />,
        );
        await Promise.resolve();
      });
      await flushEditor();
      await act(async () => {
        controlsRef.current?.focus();
        getByRole(container, 'button', { name: 'Format message' }).click();
        await Promise.resolve();
      });
      await vi.waitFor(() => {
        expect(getByRole(document.body, 'menuitem', { name })).not.toBeNull();
      });
      await act(async () => {
        getByRole(document.body, 'menuitem', { name }).click();
        await Promise.resolve();
      });
      await vi.waitFor(() => {
        expect(
          container.querySelector(
            `[role="textbox"] ${tag}${tag === 'ul' || tag === 'ol' ? ' li p' : ''}`,
          )?.textContent,
        ).toBe('Draft');
        expect(document.activeElement?.getAttribute('role')).toBe('textbox');
      });
    },
  );

  test('canceling the formatting menu restores its trigger without changing the draft', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        <ChatMarkdownEditor
          maxLength={256}
          onChange={onChange}
          value="Draft"
        />,
      );
      await Promise.resolve();
    });
    await flushEditor();
    const trigger = getByRole(container, 'button', { name: 'Format message' });
    await act(async () => {
      trigger.focus();
      trigger.click();
      await Promise.resolve();
    });
    await act(async () => {
      await vi.waitFor(() =>
        expect(getByRole(document.body, 'menuitem', { name: 'Text' })).not.toBeNull(),
      );
    });
    const item = getByRole(document.body, 'menuitem', { name: 'Text' });
    await act(async () => {
      item.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });
    await act(async () => {
      await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  test('empty literal insertions preserve the draft and a rejected paste reports recoverable feedback', async () => {
    const controlsRef = createRef<IChatMarkdownEditorControls>();
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        <ChatMarkdownEditor
          controlsRef={controlsRef}
          maxLength={16}
          onChange={onChange}
          value="Draft"
        />,
      );
      await Promise.resolve();
    });
    await flushEditor();
    expect(controlsRef.current?.appendLiteralText('   ')).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
    const textbox = getByRole(container, 'textbox', { name: 'Message' });
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', 'oversized'.repeat(8));
    await act(async () => {
      textbox.dispatchEvent(createChatPasteEvent(clipboardData));
      await Promise.resolve();
    });
    expect(container.textContent).toContain(
      'The pasted content is longer than the message limit. Your draft was not changed.',
    );
    expect(controlsRef.current?.getMarkdown().trim()).toBe('Draft');
    await act(async () => {
      expect(controlsRef.current?.appendLiteralText('more')).toBe(true);
      await Promise.resolve();
    });
    expect(container.textContent).not.toContain('The pasted content is longer');
  });

  test('rejects oversized HTML before DOM parsing and normalizes a later rich paste', async () => {
    const controlsRef = createRef<IChatMarkdownEditorControls>();
    await act(async () => {
      root.render(
        <ChatMarkdownEditor
          controlsRef={controlsRef}
          maxLength={256}
          onChange={vi.fn()}
          value="Draft"
        />,
      );
      await Promise.resolve();
    });
    await flushEditor();
    const textbox = getByRole(container, 'textbox', { name: 'Message' });
    const parseSlice = vi.spyOn(ProseMirrorDomParser.prototype, 'parseSlice');
    const oversized = new DataTransfer();
    oversized.setData('text/html', `<strong>${'large'.repeat(128)}</strong>`);
    await act(async () => {
      textbox.dispatchEvent(createChatPasteEvent(oversized));
      await Promise.resolve();
    });
    expect(parseSlice).not.toHaveBeenCalled();
    expect(controlsRef.current?.getMarkdown().trim()).toBe('Draft');
    const richText = new DataTransfer();
    richText.setData('text/html', '<h6>Deep heading</h6><p>Readable <code>source</code></p>');
    await act(async () => {
      textbox.dispatchEvent(createChatPasteEvent(richText));
      await Promise.resolve();
    });
    expect(parseSlice).toHaveBeenCalled();
    expect(controlsRef.current?.getMarkdown()).toContain('### Deep heading');
    expect(controlsRef.current?.getMarkdown()).toContain('Readable source');
    expect(textbox.querySelector('h6')).toBeNull();
    expect(textbox.querySelector('code')).toBeNull();
    expect(container.textContent).toContain(
      'Some pasted formatting was simplified to keep this message safe and compatible.',
    );
  });
});
