import { act } from 'react';
import { Crepe, CrepeFeature } from '@milkdown/crepe';
import { editorViewCtx, nodesCtx } from '@milkdown/kit/core';
import { DOMParser, DOMSerializer, type Node as ProseMirrorNode } from '@milkdown/kit/prose/model';
import { AllSelection, NodeSelection, TextSelection } from '@milkdown/kit/prose/state';
import { DecorationSet, type NodeView } from '@milkdown/kit/prose/view';
import { replaceAll } from '@milkdown/kit/utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { parseYouTubeVideoUrl } from '../../../shared/youtube-video/index.js';

import {
  configureMarkdownEditorYouTubeVideoAuthoring,
  createMarkdownEditorYouTubeVideoAuthoringController,
  createMarkdownEditorYouTubeVideoInsertionRequest,
  insertMarkdownEditorYouTubeVideo,
  markdownEditorYouTubeVideoPlugin,
  markdownEditorYouTubeVideoSchema,
  updateMarkdownEditorYouTubeVideo,
} from './markdown-editor-youtube-video.plugin.js';
import type {
  IMarkdownEditorYouTubeVideoAuthoringController,
  IMarkdownEditorYouTubeVideoEditRequest,
} from './types.js';

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

type IMarkdownEditorYouTubeVideoTestSession = {
  controller: IMarkdownEditorYouTubeVideoAuthoringController;
  crepe: Crepe;
  destroy: () => Promise<void>;
  root: HTMLDivElement;
};

/**
 * Mounts a real Crepe transformer and editor view with only the app-owned YouTube plugin added.
 * @param markdown The initial portable Markdown document.
 * @param isAuthoringEnabled Whether node-view authoring controls should be visible.
 * @returns The mounted editor session and deterministic cleanup function.
 */
const createYouTubeVideoTestSession = async (
  markdown: string,
  isAuthoringEnabled = true,
): Promise<IMarkdownEditorYouTubeVideoTestSession> => {
  const root = document.createElement('div');
  const controller = createMarkdownEditorYouTubeVideoAuthoringController({
    isAuthoringEnabled,
    onEditRequest: vi.fn(),
  });
  const crepe = new Crepe({
    defaultValue: markdown,
    features: {
      [CrepeFeature.BlockEdit]: false,
      [CrepeFeature.CodeMirror]: false,
      [CrepeFeature.Cursor]: false,
      [CrepeFeature.ImageBlock]: false,
      [CrepeFeature.Latex]: false,
      [CrepeFeature.LinkTooltip]: false,
      [CrepeFeature.ListItem]: false,
      [CrepeFeature.Placeholder]: false,
      [CrepeFeature.Table]: false,
      [CrepeFeature.Toolbar]: false,
      [CrepeFeature.TopBar]: false,
    },
    root,
  });

  document.body.append(root);
  crepe.editor.use(markdownEditorYouTubeVideoPlugin);
  crepe.editor.config((ctx) => {
    configureMarkdownEditorYouTubeVideoAuthoring(ctx, controller);
  });

  await act(async () => {
    await crepe.create();
    await Promise.resolve();
  });

  return {
    controller,
    crepe,
    destroy: async (): Promise<void> => {
      await act(async () => {
        await crepe.destroy();
      });
      controller.dispose();
      root.remove();
    },
    root,
  };
};

/**
 * Reads the first ProseMirror document child from a mounted Crepe editor.
 * @param crepe The mounted editor.
 * @returns The first document node.
 */
const getFirstEditorNode = (crepe: Crepe): ProseMirrorNode =>
  crepe.editor.action((ctx) => {
    const firstNode = ctx.get(editorViewCtx).state.doc.firstChild;

    if (!firstNode) {
      throw new Error('Expected the editor document to contain one node.');
    }

    return firstNode;
  });

describe('markdown editor YouTube video plugin', () => {
  const sessions: IMarkdownEditorYouTubeVideoTestSession[] = [];
  const manualNodeViews: NodeView[] = [];

  let originalActEnvironment: PropertyDescriptor | undefined;
  beforeEach(() => {
    originalActEnvironment = Object.getOwnPropertyDescriptor(
      globalThis,
      'IS_REACT_ACT_ENVIRONMENT',
    );
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(async () => {
    await act(async () => {
      for (const nodeView of manualNodeViews.splice(0)) nodeView.destroy?.();
      await Promise.resolve();
    });
    for (const session of sessions.splice(0)) {
      await session.destroy();
    }
    if (originalActEnvironment)
      Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', originalActEnvironment);
    else Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  });

  test('node views retain their root across selection and attribute updates and reject stale edit positions', async () => {
    const session = await createYouTubeVideoTestSession(
      '[First title](https://youtu.be/M7lc1UVf-VE)',
    );
    sessions.push(session);
    const onEditRequest = vi.fn<(request: IMarkdownEditorYouTubeVideoEditRequest) => void>();
    session.controller.update({ isAuthoringEnabled: true, onEditRequest });
    let currentPosition: number | undefined = 0;
    let shouldThrowPosition = false;
    const nodeView = session.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const constructor = view.someProp('nodeViews')?.['youtube-video'];
      if (!constructor) throw new Error('Expected the registered YouTube node-view constructor.');
      return constructor(
        getFirstEditorNode(session.crepe),
        view,
        () => {
          if (shouldThrowPosition) throw new Error('The node view no longer has a position.');
          return currentPosition;
        },
        [],
        DecorationSet.empty,
      );
    });
    manualNodeViews.push(nodeView);
    session.root.append(nodeView.dom);
    await act(async () => {
      nodeView.selectNode?.();
      await Promise.resolve();
    });
    expect(nodeView.dom.querySelector('[data-selected="true"]')).not.toBeNull();
    await act(async () => {
      nodeView.selectNode?.();
      nodeView.deselectNode?.();
      nodeView.deselectNode?.();
      await Promise.resolve();
    });
    expect(nodeView.dom.querySelector('[data-selected="false"]')).not.toBeNull();
    const iframe = nodeView.dom.querySelector('iframe');
    const edit = nodeView.dom.querySelector<HTMLButtonElement>(
      '[aria-label="Edit YouTube video"]',
    )!;
    await act(async () => {
      edit.click();
      await Promise.resolve();
    });
    expect(onEditRequest).toHaveBeenCalledTimes(1);
    expect(
      onEditRequest.mock.calls[0]?.[0].resolveTriggerElement()?.getAttribute('aria-label'),
    ).toBe('Edit YouTube video');
    currentPosition = undefined;
    await act(async () => {
      edit.click();
      await Promise.resolve();
    });
    shouldThrowPosition = true;
    await act(async () => {
      edit.click();
      await Promise.resolve();
    });
    expect(onEditRequest).toHaveBeenCalledTimes(1);
    expect(
      onEditRequest.mock.calls[0]?.[0].resolveTriggerElement()?.getAttribute('aria-label'),
    ).toBe('Edit YouTube video');
    shouldThrowPosition = false;
    currentPosition = session.crepe.editor.action(
      (ctx) => ctx.get(editorViewCtx).state.doc.content.size,
    );
    await act(async () => {
      edit.click();
      await Promise.resolve();
    });
    expect(onEditRequest).toHaveBeenCalledTimes(1);
    currentPosition = 0;
    await act(async () => {
      session.controller.update({ isAuthoringEnabled: false, onEditRequest });
      edit.click();
      await Promise.resolve();
    });
    expect(onEditRequest).toHaveBeenCalledTimes(1);
    await act(async () => {
      session.controller.update({ isAuthoringEnabled: true, onEditRequest });
      await Promise.resolve();
    });
    await act(async () => {
      const node = getFirstEditorNode(session.crepe);
      expect(nodeView.update?.(node, [], DecorationSet.empty)).toBe(true);
      const nextNode = node.type.create({ ...node.attrs, title: 'Updated title' });
      expect(nodeView.update?.(nextNode, [], DecorationSet.empty)).toBe(true);
      await Promise.resolve();
    });
    expect(nodeView.dom.querySelector('iframe')).toBe(iframe);
    expect(iframe?.getAttribute('title')).toBe('Updated title');
    expect(nodeView.ignoreMutation?.({ type: 'selection', target: nodeView.dom })).toBe(true);
    expect(nodeView.stopEvent?.({ target: edit } as unknown as Event)).toBe(true);
    expect(nodeView.stopEvent?.({ target: nodeView.dom } as unknown as Event)).toBe(false);
    session.crepe.editor.action((ctx) => {
      const paragraph = ctx.get(editorViewCtx).state.schema.node('paragraph');
      expect(nodeView.update?.(paragraph, [], DecorationSet.empty)).toBe(false);
    });
  });

  test('invalid stored URLs render readable fallback text without creating a player', async () => {
    const session = await createYouTubeVideoTestSession('');
    sessions.push(session);
    await act(async () => {
      session.crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const node = markdownEditorYouTubeVideoSchema
          .type(ctx)
          .create({ title: 'Invalid video', watchUrl: 'https://example.com' });
        view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, node));
      });
      await Promise.resolve();
    });
    expect(session.root.textContent).toContain('Unsupported YouTube video');
    expect(session.root.querySelector('iframe')).toBeNull();
    expect(session.crepe.getMarkdown().trim()).toBe('Unsupported YouTube video');
  });

  test('the owned node schema rejects non-string persisted attributes before rendering', async () => {
    const session = await createYouTubeVideoTestSession('');
    sessions.push(session);
    session.crepe.editor.action((ctx) => {
      expect(() =>
        markdownEditorYouTubeVideoSchema.type(ctx).create({ title: 42, watchUrl: 42 }),
      ).toThrow(
        'Expected value of type string for attribute title on type youtube-video, got number',
      );
    });
  });

  test('controller subscriptions change only when authoring behavior changes and stop after disposal', () => {
    const onEditRequest = vi.fn();
    const options = { isAuthoringEnabled: true, onEditRequest };
    const controller = createMarkdownEditorYouTubeVideoAuthoringController(options);
    const notify = vi.fn();
    const unsubscribe = controller.subscribe(notify);
    controller.update(options);
    expect(notify).not.toHaveBeenCalled();
    controller.update({ ...options, isAuthoringEnabled: false });
    expect(notify).toHaveBeenCalledOnce();
    unsubscribe();
    controller.update(options);
    expect(notify).toHaveBeenCalledOnce();
    controller.subscribe(notify);
    controller.dispose();
    controller.update({ ...options, isAuthoringEnabled: false });
    expect(notify).toHaveBeenCalledOnce();
  });

  test('HTML copy and paste canonicalize valid videos and reject forged attributes', async () => {
    const session = await createYouTubeVideoTestSession('[Video](https://youtu.be/M7lc1UVf-VE)');
    sessions.push(session);
    session.crepe.editor.action((ctx) => {
      const { schema } = ctx.get(editorViewCtx).state;
      const original = getFirstEditorNode(session.crepe);
      const dom = DOMSerializer.fromSchema(schema).serializeNode(original);
      const wrapper = document.createElement('div');
      wrapper.append(dom);
      expect(wrapper.innerHTML).toContain(
        'data-watch-url="https://www.youtube.com/watch?v=M7lc1UVf-VE"',
      );
      expect(DOMParser.fromSchema(schema).parse(wrapper).firstChild?.eq(original)).toBe(true);
      const invalid = original.type.create({ title: 'Bad', watchUrl: 'javascript:alert(1)' });
      const invalidDom = DOMSerializer.fromSchema(schema).serializeNode(invalid);
      wrapper.replaceChildren(invalidDom);
      expect(DOMParser.fromSchema(schema).parse(wrapper).firstChild?.type.name).toBe('paragraph');
      const rule = original.type.spec.parseDOM?.[0];
      if (!rule || !('tag' in rule) || !rule.getAttrs)
        throw new Error('Expected the owned DOM parser rule.');
      const frame = document.createElement('iframe');
      session.root.append(frame);
      expect(rule.getAttrs(frame.contentDocument!.createElement('div'))).toBe(false);
    });
  });

  test('formatted link labels stay ordinary Markdown rather than becoming video atoms', async () => {
    const session = await createYouTubeVideoTestSession(
      '[**Bold label**](https://youtu.be/M7lc1UVf-VE)',
    );
    sessions.push(session);
    expect(getFirstEditorNode(session.crepe).type.name).toBe('paragraph');
    expect(session.root.querySelector('iframe')).toBeNull();
    const label = getFirstEditorNode(session.crepe).firstChild!;
    expect(label.textContent).toBe('Bold label');
    expect(label.marks.map((mark) => mark.type.name).sort()).toStrictEqual(['link', 'strong']);
  });

  test('insertion rejects selections, changed blocks, invalid bookmarks and disposed editors without losing text', async () => {
    const session = await createYouTubeVideoTestSession('/youtube');
    sessions.push(session);
    const descriptor = parseYouTubeVideoUrl('https://youtu.be/M7lc1UVf-VE', 'Video')!;
    const request = session.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));
      expect(createMarkdownEditorYouTubeVideoInsertionRequest(ctx)).toBeNull();
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2)));
      expect(createMarkdownEditorYouTubeVideoInsertionRequest(ctx)).toBeNull();
      view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)));
      return createMarkdownEditorYouTubeVideoInsertionRequest(ctx)!;
    });
    expect(
      insertMarkdownEditorYouTubeVideo(
        session.crepe,
        { ...request, blockText: '/other' },
        descriptor,
      ),
    ).toBe(false);
    expect(
      insertMarkdownEditorYouTubeVideo(
        session.crepe,
        {
          ...request,
          selectionBookmark: {
            map: request.selectionBookmark.map.bind(request.selectionBookmark),
            resolve: () => {
              throw new Error('The bookmark was invalidated.');
            },
          },
        },
        descriptor,
      ),
    ).toBe(false);
    expect(
      insertMarkdownEditorYouTubeVideo(
        session.crepe,
        {
          ...request,
          selectionBookmark: {
            map: request.selectionBookmark.map.bind(request.selectionBookmark),
            resolve: (doc) => NodeSelection.create(doc, 0),
          },
        },
        descriptor,
      ),
    ).toBe(false);
    expect(session.crepe.getMarkdown().trim()).toBe('/youtube');
    await session.destroy();
    expect(insertMarkdownEditorYouTubeVideo(session.crepe, request, descriptor)).toBe(false);
    expect(
      updateMarkdownEditorYouTubeVideo(
        session.crepe,
        {
          descriptor,
          doc: request.doc,
          getPos: () => 0,
          position: 0,
          resolveTriggerElement: () => null,
          triggerElement: document.createElement('button'),
        },
        descriptor,
      ),
    ).toBe(false);
  });

  test('edit requests with missing or invalid live nodes preserve the existing video', async () => {
    const session = await createYouTubeVideoTestSession('[Video](https://youtu.be/M7lc1UVf-VE)');
    sessions.push(session);
    const descriptor = parseYouTubeVideoUrl('https://youtu.be/M7lc1UVf-VE', 'Video')!;
    const next = parseYouTubeVideoUrl('https://youtu.be/dQw4w9WgXcQ', 'Changed')!;
    const doc = session.crepe.editor.action((ctx) => ctx.get(editorViewCtx).state.doc);
    const request = {
      descriptor,
      doc,
      position: 0,
      getPos: () => doc.content.size,
      resolveTriggerElement: () => null,
      triggerElement: document.createElement('button'),
    };
    expect(updateMarkdownEditorYouTubeVideo(session.crepe, request, next)).toBe(false);
    expect(
      updateMarkdownEditorYouTubeVideo(session.crepe, { ...request, getPos: () => 999 }, next),
    ).toBe(false);
    expect(session.crepe.getMarkdown()).toContain('[Video]');
  });

  test.each(['youtube-video', 'paragraph'])(
    'the schema-priority lifecycle preserves a partial registry missing %s',
    async (missingName) => {
      const session = await createYouTubeVideoTestSession('');
      sessions.push(session);
      // the priority lifecycle is the penultimate stage of the exported plugin bundle.
      const prioritizeSchema = markdownEditorYouTubeVideoPlugin.at(-2)!;
      await session.crepe.editor.action(async (ctx) => {
        const complete = ctx.get(nodesCtx);
        const partial = complete.filter(([name]) => name !== missingName);
        ctx.set(nodesCtx, partial);
        try {
          const lifecycle = prioritizeSchema(ctx);
          await lifecycle();
          expect(ctx.get(nodesCtx)).toBe(partial);
        } finally {
          ctx.set(nodesCtx, complete);
        }
      });
    },
  );

  test('keeps an empty document on the ordinary paragraph path', async () => {
    const session = await createYouTubeVideoTestSession('');

    sessions.push(session);

    expect(getFirstEditorNode(session.crepe).type.name).toBe('paragraph');
    expect(session.crepe.getMarkdown()).toBe('');
    expect(session.root.textContent).not.toContain('Unsupported YouTube video');
  });

  test.each([
    [
      '[Product walkthrough](https://youtu.be/M7lc1UVf-VE?t=15)',
      '[Product walkthrough](https://www.youtube.com/watch?v=M7lc1UVf-VE)',
      'Product walkthrough',
    ],
    [
      'https://www.youtube.com/watch?v=M7lc1UVf-VE&list=PL123',
      '[YouTube video](https://www.youtube.com/watch?v=M7lc1UVf-VE)',
      'YouTube video',
    ],
  ])('parses and canonically serializes %s', async (markdown, expectedMarkdown, expectedTitle) => {
    const session = await createYouTubeVideoTestSession(markdown);

    sessions.push(session);

    expect(getFirstEditorNode(session.crepe).type.name).toBe('youtube-video');
    expect(session.crepe.getMarkdown().trim()).toBe(expectedMarkdown);
    expect(session.root.querySelector<HTMLIFrameElement>('iframe')?.getAttribute('title')).toBe(
      expectedTitle,
    );
    expect(session.root.querySelector<HTMLIFrameElement>('iframe')?.src).toBe(
      'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE',
    );
  });

  test('leaves unsupported standalone links on Milkdown ordinary paragraph path', async () => {
    const markdown = '[Video](https://example.com/watch?v=M7lc1UVf-VE)';
    const session = await createYouTubeVideoTestSession(markdown);

    sessions.push(session);

    expect(getFirstEditorNode(session.crepe).type.name).toBe('paragraph');
    expect(session.crepe.getMarkdown().trim()).toBe(markdown);
    expect(session.root.querySelector('iframe')).toBeNull();
  });

  test('inserts only into the unchanged slash-command block', async () => {
    const session = await createYouTubeVideoTestSession('/youtube');
    const descriptor = parseYouTubeVideoUrl(
      'https://youtu.be/M7lc1UVf-VE?t=15',
      'Product walkthrough',
    );

    sessions.push(session);

    if (!descriptor) {
      throw new Error('Expected the YouTube fixture to be valid.');
    }

    const request = session.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const cursorPosition = 1 + view.state.doc.firstChild!.textContent.length;

      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(view.state.doc, cursorPosition)),
      );

      return createMarkdownEditorYouTubeVideoInsertionRequest(ctx);
    });

    expect(request).not.toBeNull();

    if (!request) {
      return;
    }

    await act(async () => {
      expect(insertMarkdownEditorYouTubeVideo(session.crepe, request, descriptor)).toBe(true);
      await Promise.resolve();
    });

    expect(getFirstEditorNode(session.crepe).type.name).toBe('youtube-video');
    expect(session.crepe.getMarkdown().trim()).toBe(
      '[Product walkthrough](https://www.youtube.com/watch?v=M7lc1UVf-VE)',
    );

    const staleSession = await createYouTubeVideoTestSession('/youtube');

    sessions.push(staleSession);

    const staleRequest = staleSession.crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const cursorPosition = 1 + view.state.doc.firstChild!.textContent.length;

      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(view.state.doc, cursorPosition)),
      );

      return createMarkdownEditorYouTubeVideoInsertionRequest(ctx);
    });

    if (!staleRequest) {
      throw new Error('Expected a valid stale insertion fixture.');
    }

    staleSession.crepe.editor.action(replaceAll('Externally replaced', true));

    expect(insertMarkdownEditorYouTubeVideo(staleSession.crepe, staleRequest, descriptor)).toBe(
      false,
    );
    expect(staleSession.crepe.getMarkdown().trim()).toBe('Externally replaced');
  });

  test('edits only the same live node and ignores controlled replacement', async () => {
    const firstDescriptor = parseYouTubeVideoUrl('https://youtu.be/M7lc1UVf-VE', 'First title');
    const nextDescriptor = parseYouTubeVideoUrl('https://youtu.be/dQw4w9WgXcQ', 'Next title');

    if (!firstDescriptor || !nextDescriptor) {
      throw new Error('Expected the YouTube fixtures to be valid.');
    }

    const session = await createYouTubeVideoTestSession(
      '[First title](https://youtu.be/M7lc1UVf-VE)',
    );

    sessions.push(session);

    const initialDoc = session.crepe.editor.action((ctx) => ctx.get(editorViewCtx).state.doc);

    const editRequest: IMarkdownEditorYouTubeVideoEditRequest = {
      descriptor: firstDescriptor,
      doc: initialDoc,
      getPos: () => {
        throw new Error('The original node view was replaced.');
      },
      position: 0,
      resolveTriggerElement: () => null,
      triggerElement: document.createElement('button'),
    };

    await act(async () => {
      expect(updateMarkdownEditorYouTubeVideo(session.crepe, editRequest, nextDescriptor)).toBe(
        true,
      );
      await Promise.resolve();
    });

    expect(session.crepe.getMarkdown().trim()).toBe(
      '[Next title](https://www.youtube.com/watch?v=dQw4w9WgXcQ)',
    );

    const updatedDoc = session.crepe.editor.action((ctx) => ctx.get(editorViewCtx).state.doc);

    const staleRequest: IMarkdownEditorYouTubeVideoEditRequest = {
      descriptor: nextDescriptor,
      doc: updatedDoc,
      getPos: () => 0,
      position: 0,
      resolveTriggerElement: () => null,
      triggerElement: document.createElement('button'),
    };

    await act(async () => {
      session.crepe.editor.action(replaceAll('[Replacement](https://youtu.be/M7lc1UVf-VE)', true));
      expect(updateMarkdownEditorYouTubeVideo(session.crepe, staleRequest, firstDescriptor)).toBe(
        false,
      );
      await Promise.resolve();
    });
    expect(session.crepe.getMarkdown().trim()).toBe(
      '[Replacement](https://www.youtube.com/watch?v=M7lc1UVf-VE)',
    );
  });

  test('keeps videos readable without authoring controls and cleans up deleted node views', async () => {
    const session = await createYouTubeVideoTestSession(
      '[Product walkthrough](https://youtu.be/M7lc1UVf-VE)',
      false,
    );

    sessions.push(session);

    const nodeView = session.root.querySelector<HTMLElement>(
      '[data-slot="markdown-editor-youtube-video-node"]',
    );

    expect(session.root.querySelector('iframe')).not.toBeNull();
    expect(session.root.querySelector('[aria-label="Edit YouTube video"]')).toBeNull();
    expect(
      session.root.querySelector('[aria-label="Open on YouTube (opens in a new tab)"]'),
    ).toBeNull();

    const onEditRequest = vi.fn();

    await act(async () => {
      session.controller.update({
        isAuthoringEnabled: true,
        onEditRequest,
      });
      await Promise.resolve();
    });

    const editButton = session.root.querySelector<HTMLButtonElement>(
      '[aria-label="Edit YouTube video"]',
    );

    await act(async () => {
      editButton?.click();
      await Promise.resolve();
    });

    const editRequest = onEditRequest.mock.calls[0]?.[0] as
      IMarkdownEditorYouTubeVideoEditRequest | undefined;

    expect(editRequest?.resolveTriggerElement()).toBe(editButton);

    await act(async () => {
      session.crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const firstNode = view.state.doc.firstChild;

        if (!firstNode) {
          throw new Error('Expected the YouTube node before deletion.');
        }

        view.dispatch(
          view.state.tr.replaceWith(0, firstNode.nodeSize, view.state.schema.node('paragraph')),
        );
      });
      await Promise.resolve();
    });

    expect(getFirstEditorNode(session.crepe).type.name).toBe('paragraph');
    expect(editRequest?.resolveTriggerElement()).toBeNull();
    expect(nodeView?.isConnected).toBe(false);
    expect(session.root.querySelector('iframe')).toBeNull();
  });
});
