import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Editor, EditorStatus, commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { DOMParser as ProseMirrorDomParser } from '@milkdown/kit/prose/model';
import { TextSelection } from '@milkdown/kit/prose/state';
import { undoCommand, redoCommand } from '@milkdown/kit/plugin/history';
import { getByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, test, vi, type MockInstance } from 'vitest';

import { createChatPasteEvent } from './clipboard.test-utils.js';
import { ChatMarkdownEditor } from './chat-editor.component.js';
import type { IChatMarkdownEditorControls } from './types.js';

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const TECHNICAL_TOOLS = [
  'text',
  'heading',
  'bold',
  'italic',
  'link',
  'bullet-list',
  'ordered-list',
  'inline-code',
  'code-block',
  'table',
] as const;

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

  test.each([
    ['prose', 'Base'],
    ['inline', '`Base`'],
    ['code', '```typescript\nBase\n```'],
    ['table', '| Name |\n| --- |\n| Base |'],
  ])('theme state %s', async (_kind, markdown) => {
    const controlsRef = createRef<IChatMarkdownEditorControls>();
    const onChange = vi.fn();
    const onSubmitRequest = vi.fn();
    const wasDark = document.documentElement.classList.contains('dark');
    try {
      await act(async () => {
        await Promise.resolve();
        root.render(
          <ChatMarkdownEditor
            controlsRef={controlsRef}
            maxLength={2048}
            value={markdown}
            onChange={onChange}
            onSubmitRequest={onSubmitRequest}
            supportedTools={TECHNICAL_TOOLS}
          />,
        );
      });
      await flushEditor();
      const initialSnapshot = controlsRef.current!.getMarkdown();
      const message = getByRole(container, 'textbox', { name: 'Message' });
      const editor = editors.at(-1)!;
      onChange.mockClear();

      act(() => {
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          let end = 0;
          view.state.doc.descendants((node, position) => {
            if (node.isText && node.text === 'Base') end = position + 4;
          });
          expect(end).toBeGreaterThan(0);
          view.focus();
          const transaction = view.state.tr.insert(
            end,
            view.state.schema.text(' latest', view.state.doc.resolve(end - 1).marks()),
          );
          view.dispatch(
            transaction.setSelection(TextSelection.create(transaction.doc, end - 2, end + 2)),
          );
        });
        expect(onChange).not.toHaveBeenCalled();
        const active = document.activeElement;
        const selection = document.getSelection();
        const anchor = selection?.anchorNode;
        const anchorOffset = selection?.anchorOffset;
        const focus = selection?.focusNode;
        const focusOffset = selection?.focusOffset;

        for (const isDark of [!wasDark, wasDark]) {
          document.documentElement.classList.toggle('dark', isDark);
          expect(getByRole(container, 'textbox', { name: 'Message' })).toBe(message);
          expect(document.activeElement).toBe(active);
          expect(document.getSelection()?.anchorNode).toBe(anchor);
          expect(document.getSelection()?.anchorOffset).toBe(anchorOffset);
          expect(document.getSelection()?.focusNode).toBe(focus);
          expect(document.getSelection()?.focusOffset).toBe(focusOffset);
          expect(controlsRef.current!.getMarkdown()).toContain('Base latest');
        }

        const updatedSnapshot = controlsRef.current!.getMarkdown();
        editor.action((ctx) => ctx.get(commandsCtx).call(undoCommand.key));
        expect(controlsRef.current!.getMarkdown()).toBe(initialSnapshot);
        editor.action((ctx) => ctx.get(commandsCtx).call(redoCommand.key));
        expect(controlsRef.current!.getMarkdown()).toBe(updatedSnapshot);
        expect(onSubmitRequest).not.toHaveBeenCalled();
        message.dispatchEvent(
          new KeyboardEvent('keydown', { bubbles: true, ctrlKey: true, key: 'Enter' }),
        );
        expect(onSubmitRequest).toHaveBeenCalledExactlyOnceWith(updatedSnapshot);
        message.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        document.documentElement.classList.toggle('dark');
        expect(editor.action((ctx) => ctx.get(editorViewCtx).composing)).toBe(true);
        expect(controlsRef.current!.getMarkdown()).toBe(updatedSnapshot);
        message.dispatchEvent(
          new KeyboardEvent('keydown', {
            bubbles: true,
            ctrlKey: true,
            key: 'Enter',
            isComposing: true,
          }),
        );
        expect(onSubmitRequest).toHaveBeenCalledTimes(1);
        message.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '' }));
      });
      expect(editors).toHaveLength(1);
    } finally {
      document.documentElement.classList.toggle('dark', wasDark);
    }
  });

  test.each([false, true])('nested code submission, disabled %s', async (disabled) => {
    const onSubmitRequest = vi.fn();
    await act(async () => {
      await Promise.resolve();
      root.render(
        <ChatMarkdownEditor
          maxLength={256}
          disabled={disabled}
          value={'```typescript\n{}\n```'}
          onChange={vi.fn()}
          onSubmitRequest={onSubmitRequest}
          supportedTools={TECHNICAL_TOOLS}
        />,
      );
    });
    await flushEditor();
    let code: HTMLElement;
    await vi.waitFor(() => {
      code = getByRole(container, 'textbox', { name: 'typescript code editor' });
    });
    act(() => {
      code.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          ctrlKey: true,
          key: 'Enter',
          isComposing: true,
        }),
      );
      code.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, shiftKey: true, key: 'Enter' }),
      );
    });
    expect(onSubmitRequest).not.toHaveBeenCalled();
    act(() => {
      code.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, ctrlKey: true, key: 'Enter' }),
      );
    });
    if (disabled) expect(onSubmitRequest).not.toHaveBeenCalled();
    else expect(onSubmitRequest).toHaveBeenCalledExactlyOnceWith('```typescript\n{}\n```\n');
  });

  test('technical controlled replacement', async () => {
    const controlsRef = createRef<IChatMarkdownEditorControls>();
    const onChange = vi.fn();
    const render = (value: string): void =>
      root.render(
        <ChatMarkdownEditor
          controlsRef={controlsRef}
          maxLength={2048}
          value={value}
          onChange={onChange}
          supportedTools={TECHNICAL_TOOLS}
        />,
      );
    act(() => render('Initial'));
    await flushEditor();
    onChange.mockClear();
    const source =
      '{{PROSE_NAME}} and `{{VAR\\_NAME}}`\n\n```ts\n  literal &#x20;\n\t<tag> {{VAR\\_NAME}}\n```\n\n| A |\n| - |\n| `[]` |';
    act(() => render(source));
    await flushEditor();
    const snapshot = controlsRef.current!.getMarkdown();
    expect(snapshot).toContain('{{PROSE_NAME}} and');
    expect(snapshot).toContain('`{{VAR\\_NAME}}`');
    expect(snapshot).toContain('```ts\n  literal &#x20;\n\t<tag> {{VAR\\_NAME}}\n```');
    expect(snapshot).toContain('`[]`');
    expect(getByRole(container, 'cell', { name: '[]' }).textContent).toBe('[]');
    expect(onChange).not.toHaveBeenCalled();
    expect(editors).toHaveLength(1);
  });

  test('pending destroy changes', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        <ChatMarkdownEditor
          maxLength={256}
          value="Old draft"
          onChange={onChange}
        />,
      );
      await Promise.resolve();
    });
    await flushEditor();
    const editor = editors.at(-1)!;
    const destroy = editor.destroy.bind(editor);
    let releaseDestroy!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseDestroy = resolve;
    });
    vi.spyOn(editor, 'destroy').mockImplementation(async (...args) => {
      await gate;
      return destroy(...args);
    });
    try {
      act(() => root.render(null));
      onChange.mockClear();
      act(() =>
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          view.dispatch(view.state.tr.insertText(' late', 10));
          view.dom.dispatchEvent(new FocusEvent('blur'));
        }),
      );
      expect(onChange).not.toHaveBeenCalled();
    } finally {
      releaseDestroy();
      await vi.waitFor(() => expect(editor.status).toBe(EditorStatus.Destroyed));
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
    const onChange = vi.fn((value: string) =>
      root.render(
        <ChatMarkdownEditor
          controlsRef={controlsRef}
          maxLength={256}
          onChange={onChange}
          value={value}
        />,
      ),
    );
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
      act(() => {
        expect(controlsRef.current?.appendLiteralText('END', { allowOverLimit: true })).toBe(true);
      });
      expect(controlsRef.current?.getMarkdown()).toBe('Retained draft\n\nEND');
      expect(onChange).toHaveBeenCalledWith('Retained draft\n\nEND');
    } finally {
      releaseCreation?.();
      await flushEditor();
    }
    expect(controlsRef.current?.getMarkdown()).toBe('Retained draft\n\nEND\n');
    expect(container.querySelector('[role="textbox"]')?.textContent).toContain('END');
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

  test('opted-in dictation retains 45000 characters and allows shortening the full draft', async () => {
    const controlsRef = createRef<IChatMarkdownEditorControls>();
    const transcript = 'BEGIN café\n\n' + 'MIDDLE 日本語 '.repeat(4096) + '\n\nEND';
    let value = 'Existing draft';
    const renderEditor = (disabled = false): void =>
      root.render(
        <ChatMarkdownEditor
          controlsRef={controlsRef}
          disabled={disabled}
          maxLength={32}
          value={value}
          onChange={(next) => {
            value = next;
            renderEditor();
          }}
        />,
      );
    act(() => renderEditor());
    await flushEditor();
    act(() => {
      expect(controlsRef.current?.appendLiteralText(transcript)).toBe(false);
      expect(controlsRef.current?.appendLiteralText(transcript, { allowOverLimit: true })).toBe(
        true,
      );
    });
    expect(controlsRef.current?.getMarkdown()).toContain('BEGIN café');
    expect(controlsRef.current?.getMarkdown()).toContain('END');
    expect(controlsRef.current?.getMarkdown().match(/MIDDLE 日本語/g)).toHaveLength(4096);
    expect(container.querySelector('[role="textbox"]')?.textContent).toContain('MIDDLE 日本語');
    expect(container.textContent).toContain('The message is longer than the allowed limit.');
    const editor = editors.at(-1)!;
    act(() =>
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        view.dispatch(
          view.state.tr.delete(1, view.state.doc.content.size - 1).insertText('Ready', 1),
        );
      }),
    );
    await act(async () => vi.waitFor(() => expect(value).toBe('Ready\n')));
    expect(container.textContent).not.toContain('The message is longer than the allowed limit.');
    act(() => renderEditor(true));
    act(() =>
      expect(controlsRef.current?.appendLiteralText('Late', { allowOverLimit: true })).toBe(false),
    );
    expect(controlsRef.current?.getMarkdown()).toBe('Ready\n');
    // a handle kept past unmount appends nothing and reports nothing to the unmounted owner
    const retainedControls = controlsRef.current;
    act(() => {
      root.unmount();
    });
    expect(retainedControls?.appendLiteralText('After', { allowOverLimit: true })).toBe(false);
    expect(value).toBe('Ready\n');
    root = createRoot(container);
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

  test('keeps dictated strikethrough, entities and tags as the literal text they are', async () => {
    const controlsRef = createRef<IChatMarkdownEditorControls>();
    await act(async () => {
      root.render(
        <ChatMarkdownEditor
          controlsRef={controlsRef}
          maxLength={256}
          value=""
          onChange={vi.fn()}
        />,
      );
      await Promise.resolve();
    });
    await flushEditor();

    act(() => {
      expect(controlsRef.current?.appendLiteralText('~~gone~~ &amp; <div>')).toBe(true);
    });

    expect(container.querySelector('[role="textbox"]')?.textContent).toBe('~~gone~~ &amp; <div>');
  });

  test('refuses an append that only the editor would lengthen past the limit, such as a link', async () => {
    const controlsRef = createRef<IChatMarkdownEditorControls>();
    const onChange = vi.fn();
    // the escaped source fits exactly; the editor writes the address as a longer autolink
    const text = 'Visit http://example.com';
    await act(async () => {
      root.render(
        <ChatMarkdownEditor
          controlsRef={controlsRef}
          maxLength={'Visit http://example\\.com'.length}
          value=""
          onChange={onChange}
        />,
      );
      await Promise.resolve();
    });
    await flushEditor();

    act(() => {
      expect(controlsRef.current?.appendLiteralText(text)).toBe(false);
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(controlsRef.current?.getMarkdown()).toBe('');
  });
});
