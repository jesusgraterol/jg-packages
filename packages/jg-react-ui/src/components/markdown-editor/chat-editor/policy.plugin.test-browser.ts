import { act } from 'react';
import { Crepe, CrepeFeature } from '@milkdown/crepe';
import { editorViewCtx } from '@milkdown/kit/core';
import { Slice } from '@milkdown/kit/prose/model';
import { getByRole } from '@testing-library/dom';
import { afterEach, describe, expect, onTestFinished, test, vi } from 'vitest';

import { createChatPasteEvent } from './clipboard.test-utils.js';
import { CHAT_MARKDOWN_EDITOR_TOOLS } from './constants.js';
import type { IChatMarkdownEditorTool } from './types.js';
import {
  CHAT_MARKDOWN_POLICY_PLUGIN_KEY,
  createChatMarkdownPolicyPlugin,
} from './policy.plugin.js';

type IChatPolicySession = {
  crepe: Crepe;
  destroy: () => Promise<void>;
  onNormalization: ReturnType<typeof vi.fn>;
  onPasteRejected: ReturnType<typeof vi.fn>;
};

const createPolicySession = async (
  markdown: string,
  maxLength = 4096,
  supportedTools: ReadonlyArray<IChatMarkdownEditorTool> = CHAT_MARKDOWN_EDITOR_TOOLS,
): Promise<IChatPolicySession> => {
  const root = document.createElement('div');
  const crepe = new Crepe({
    defaultValue: markdown,
    features: {
      [CrepeFeature.ImageBlock]: false,
    },
    root,
  });
  const onNormalization = vi.fn();
  const onPasteRejected = vi.fn();
  let isDestroyed = false;
  const destroy = async (): Promise<void> => {
    if (isDestroyed) return;
    isDestroyed = true;
    try {
      await act(async () => {
        await crepe.destroy();
      });
    } finally {
      root.remove();
    }
  };
  onTestFinished(destroy);

  document.body.append(root);
  crepe.editor.use(
    createChatMarkdownPolicyPlugin({
      getMaxLength: () => maxLength,
      getSupportedTools: () => supportedTools,
      onNormalization,
      onPasteRejected,
    }),
  );

  await act(async () => {
    await crepe.create();
    await Promise.resolve();
    await Promise.resolve();
  });

  return {
    crepe,
    destroy,
    onNormalization,
    onPasteRejected,
  };
};

describe('chat Markdown policy plugin', () => {
  const sessions: IChatPolicySession[] = [];

  afterEach(async () => {
    for (const session of sessions.splice(0)) {
      await session.destroy();
    }
  });

  test('technical round trip', async () => {
    const tools = [...CHAT_MARKDOWN_EDITOR_TOOLS, 'inline-code', 'code-block', 'table'] as const;
    const code = '  {}\n\t&#x20; <tag> `value`\n  café 日本語';
    const source =
      '`{}` and [safe](https://example.com)\n\n```typescript\n' +
      code +
      '\n```\n\n| Name | Code |\n| :--- | ---: |\n| Example | `[]` |';
    const session = await createPolicySession(source, 4096, tools);
    sessions.push(session);
    const markdown = session.crepe.getMarkdown();

    expect(markdown).toContain('`{}`');
    expect(markdown).toContain('```typescript\n' + code + '\n```');
    expect(markdown).toContain('`[]`');
    expect(markdown).toContain('[safe](https://example.com)');
    const readCell = () =>
      session.crepe.editor.action((ctx) =>
        getByRole(ctx.get(editorViewCtx).dom, 'cell', { name: '[]' }),
      );
    await vi.waitFor(() => expect(readCell().textContent).toBe('[]'));
    const table = readCell().closest('table');
    expect(table?.rows).toHaveLength(2);
    expect(table?.rows[1]?.cells[1]?.textContent).toBe('[]');
    const replay = await createPolicySession(markdown, 4096, tools);
    sessions.push(replay);
    expect(replay.crepe.getMarkdown()).toBe(markdown);
    expect(session.onNormalization).not.toHaveBeenCalled();
  });

  test('inline-only policy', async () => {
    const session = await createPolicySession(
      '`{}`\n\n```ts\n  literal\n```\n\n| A |\n| - |\n| B |',
      4096,
      [...CHAT_MARKDOWN_EDITOR_TOOLS, 'inline-code'],
    );
    sessions.push(session);

    const markdown = session.crepe.getMarkdown();
    expect(markdown).toContain('`{}`');
    expect(markdown).not.toContain('```');
    expect(
      session.crepe.editor.action((ctx) => ctx.get(editorViewCtx).dom.querySelector('table')),
    ).toBeNull();
    expect(markdown).toContain('literal');
    expect(markdown).toContain('B');
  });

  test.each([
    ['text/plain', '```typescript\n  {} &#x20;\n\t<tag>\n```\n\n| A |\n| - |\n| `[]` |'],
    [
      'text/html',
      '<pre><code>  {} &amp;#x20;\n\t&lt;tag&gt;</code></pre><table><tr><th>A</th></tr><tr><td><code>[]</code></td></tr></table>',
    ],
  ])('technical paste %s', async (mimeType, source) => {
    const session = await createPolicySession('', 4096, [
      ...CHAT_MARKDOWN_EDITOR_TOOLS,
      'inline-code',
      'code-block',
      'table',
    ]);
    sessions.push(session);
    const clipboard = new DataTransfer();
    clipboard.setData(mimeType, source);
    act(() =>
      session.crepe.editor.action((ctx) => {
        ctx.get(editorViewCtx).dom.dispatchEvent(createChatPasteEvent(clipboard));
      }),
    );
    const markdown = session.crepe.getMarkdown();
    expect(markdown).toContain('  {} &#x20;\n\t<tag>');
    expect(markdown).toContain('`[]`');
    expect(session.onPasteRejected).not.toHaveBeenCalled();
    const cell = session.crepe.editor.action((ctx) =>
      getByRole(ctx.get(editorViewCtx).dom, 'cell', { name: '[]' }),
    );
    expect(cell.textContent).toBe('[]');
  });

  test('normalizes unsupported blocks, marks, headings, media, and unsafe links', async () => {
    const session = await createPolicySession(`#### Deep heading

> Quoted **content**

~~Removed mark~~ and [safe](https://example.com) and [unsafe](javascript:alert(1)).

![Readable alternative](https://example.com/image.png)

<script>alert('hidden')</script>`);

    sessions.push(session);

    const markdown = session.crepe.getMarkdown();

    expect(markdown).toContain('### Deep heading');
    expect(markdown).toContain('Quoted content');
    expect(markdown).toContain('Removed mark');
    expect(markdown).toContain('[safe](https://example.com)');
    expect(markdown).toContain('unsafe');
    expect(markdown).not.toContain('javascript:');
    expect(markdown).toContain('Readable alternative');
    expect(markdown).not.toContain('image.png');
    expect(markdown).not.toContain('script');
    expect(markdown).not.toContain('hidden');
  });

  test('round-trips every permitted structure, including nested lists and safe links', async () => {
    const session = await createPolicySession(`# Heading one

## Heading two

### Heading three

Plain **bold**, *italic*, and ***combined*** text with [web](https://example.com/help) and [email](mailto:support@example.com).

- First bullet
  - Nested bullet

1. First step
   1. Nested step`);

    sessions.push(session);

    const markdown = session.crepe.getMarkdown();

    expect(markdown).toContain('# Heading one');
    expect(markdown).toContain('## Heading two');
    expect(markdown).toContain('### Heading three');
    expect(markdown).toContain('**bold**');
    expect(markdown).toContain('*italic*');
    expect(markdown).toContain('[web](https://example.com/help)');
    expect(markdown).toContain('[email](mailto:support@example.com)');
    expect(markdown).toContain('  * Nested bullet');
    expect(markdown).toMatch(/\n\s+1\. Nested step/);
  });

  test('produces an idempotent normalized Markdown document', async () => {
    const firstSession = await createPolicySession('#### Deep\n\n> Quoted **copy**');

    sessions.push(firstSession);
    const normalizedMarkdown = firstSession.crepe.getMarkdown();
    const secondSession = await createPolicySession(normalizedMarkdown);

    sessions.push(secondSession);

    expect(secondSession.crepe.getMarkdown().trimEnd()).toBe(normalizedMarkdown.trimEnd());
    expect(secondSession.onNormalization).not.toHaveBeenCalled();
  });

  test('retains task state as literal list text', async () => {
    const session = await createPolicySession('- [x] Finished\n- [ ] Pending');

    sessions.push(session);

    expect(session.crepe.getMarkdown()).toContain('* \\[x] Finished');
    expect(session.crepe.getMarkdown()).toContain('* \\[ ] Pending');
  });

  test('normalizes a rich-paste transaction emitted by another plugin and reports the normalization', async () => {
    const session = await createPolicySession('Original');
    sessions.push(session);
    await act(async () => {
      session.crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const heading = view.state.schema.node(
          'heading',
          { level: 6 },
          view.state.schema.text('Pasted heading'),
        );
        view.dispatch(
          view.state.tr
            .replaceWith(0, view.state.doc.content.size, heading)
            .setMeta('uiEvent', 'paste'),
        );
      });
      await Promise.resolve();
    });
    expect(session.crepe.getMarkdown().trim()).toBe('### Pasted heading');
    expect(session.onNormalization).toHaveBeenCalledOnce();
    expect(session.onPasteRejected).not.toHaveBeenCalled();
  });

  test('an empty clipboard leaves the current selection and draft to the native editor', async () => {
    const session = await createPolicySession('Retained');
    sessions.push(session);
    const handled = session.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const plugin = CHAT_MARKDOWN_POLICY_PLUGIN_KEY.get(view.state)!;
      expect(
        plugin.props.handleDOMEvents?.paste?.call(plugin, view, new ClipboardEvent('paste')),
      ).toBe(false);
      return plugin.props.handlePaste?.call(plugin, view, new ClipboardEvent('paste'), Slice.empty);
    });
    expect(handled).toBe(false);
    expect(session.crepe.getMarkdown().trim()).toBe('Retained');
    expect(session.onPasteRejected).not.toHaveBeenCalled();
  });

  test('permitted plain text paste does not show a normalization warning', async () => {
    const session = await createPolicySession('');
    sessions.push(session);
    const paste = new DataTransfer();
    paste.setData('text/plain', 'Plain pasted text');
    await act(async () => {
      session.crepe.editor.action((ctx) =>
        ctx.get(editorViewCtx).dom.dispatchEvent(createChatPasteEvent(paste)),
      );
      await Promise.resolve();
    });
    expect(session.crepe.getMarkdown().trim()).toBe('Plain pasted text');
    expect(session.onNormalization).not.toHaveBeenCalled();
    expect(session.onPasteRejected).not.toHaveBeenCalled();
  });

  test('rejects oversized Markdown paste before parsing or replacing the selection', async () => {
    const session = await createPolicySession('Retained', 8);
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });

    sessions.push(session);
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        getData: (type: string) => (type === 'text/plain' ? 'This paste is too long' : ''),
      },
    });

    const handled = session.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const policyPlugin = CHAT_MARKDOWN_POLICY_PLUGIN_KEY.get(view.state);

      return policyPlugin?.props.handlePaste?.call(
        policyPlugin,
        view,
        pasteEvent as ClipboardEvent,
        Slice.empty,
      );
    });

    expect(handled).toBe(true);
    expect(session.onPasteRejected).toHaveBeenCalledTimes(1);
    expect(session.crepe.getMarkdown().trim()).toBe('Retained');
  });

  test('rejects a small paste when the resulting document exceeds the limit', async () => {
    const session = await createPolicySession('123456', 8);
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });

    sessions.push(session);
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        getData: (type: string) => (type === 'text/plain' ? 'abc' : ''),
      },
    });

    const handled = session.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const policyPlugin = CHAT_MARKDOWN_POLICY_PLUGIN_KEY.get(view.state);

      return policyPlugin?.props.handlePaste?.call(
        policyPlugin,
        view,
        pasteEvent as ClipboardEvent,
        Slice.empty,
      );
    });

    expect(handled).toBe(true);
    expect(session.onPasteRejected).toHaveBeenCalledTimes(1);
    expect(session.crepe.getMarkdown().trim()).toBe('123456');
  });

  test('accepts a paste that fills the message to exactly the limit', async () => {
    /*
     * The pasted text joins as its own paragraph, abc then 123456, which is eleven characters;
     * the serializer's closing line break isn't part of the message, so they fit a limit of eleven.
     */
    const session = await createPolicySession('123456', 11);
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });

    sessions.push(session);
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        getData: (type: string) => (type === 'text/plain' ? 'abc' : ''),
      },
    });

    const handled = session.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const policyPlugin = CHAT_MARKDOWN_POLICY_PLUGIN_KEY.get(view.state);

      return policyPlugin?.props.handlePaste?.call(
        policyPlugin,
        view,
        pasteEvent as ClipboardEvent,
        Slice.empty,
      );
    });

    expect(handled).toBe(true);
    expect(session.onPasteRejected).not.toHaveBeenCalled();
    expect(session.crepe.getMarkdown()).toBe('abc\n\n123456\n');
  });

  test('rejects oversized HTML paste before the default rich-paste parser runs', async () => {
    const session = await createPolicySession('Retained', 16);
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });

    sessions.push(session);
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        getData: (type: string) =>
          type === 'text/html' ? '<strong>This rich paste is too long</strong>' : 'This rich paste',
      },
    });

    const handled = session.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const policyPlugin = CHAT_MARKDOWN_POLICY_PLUGIN_KEY.get(view.state);

      return policyPlugin?.props.handlePaste?.call(
        policyPlugin,
        view,
        pasteEvent as ClipboardEvent,
        Slice.empty,
      );
    });

    expect(handled).toBe(true);
    expect(pasteEvent.defaultPrevented).toBe(true);
    expect(session.onPasteRejected).toHaveBeenCalledTimes(1);
    expect(session.crepe.getMarkdown().trim()).toBe('Retained');
  });

  test('filters a default rich-paste transaction when its serialized document exceeds the limit', async () => {
    const session = await createPolicySession('123456', 8);

    sessions.push(session);

    const accepted = session.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const policyPlugin = CHAT_MARKDOWN_POLICY_PLUGIN_KEY.get(view.state);
      const transaction = view.state.tr.insertText('abc').setMeta('uiEvent', 'paste');

      return policyPlugin?.spec.filterTransaction?.(transaction, view.state);
    });

    expect(accepted).toBe(false);
    expect(session.onPasteRejected).toHaveBeenCalledTimes(1);
    expect(session.crepe.getMarkdown().trim()).toBe('123456');
  });
});
