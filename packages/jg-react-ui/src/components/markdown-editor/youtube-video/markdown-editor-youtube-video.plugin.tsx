import type { Crepe } from '@milkdown/crepe';
import { EditorStatus, editorViewCtx, nodesCtx } from '@milkdown/kit/core';
import type { Ctx, MilkdownPlugin } from '@milkdown/kit/ctx';
import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';
import { NodeSelection, TextSelection } from '@milkdown/kit/prose/state';
import type { NodeView, NodeViewConstructor } from '@milkdown/kit/prose/view';
import type { MarkdownNode } from '@milkdown/kit/transformer';
import { $ctx, $nodeSchema, $view } from '@milkdown/kit/utils';
import { createRoot, type Root as ReactRoot } from 'react-dom/client';

import {
  parseYouTubeVideoUrl,
  type IYouTubeVideoDescriptor,
} from '../../../shared/youtube-video/index.js';

import {
  MARKDOWN_EDITOR_YOUTUBE_VIDEO_DATA_TYPE,
  MARKDOWN_EDITOR_YOUTUBE_VIDEO_NODE_NAME,
} from './constants.js';
import { MarkdownEditorYouTubeVideoNodeView } from './youtube-node-view.component.js';
import type {
  IMarkdownEditorYouTubeVideoAuthoringController,
  IMarkdownEditorYouTubeVideoAuthoringOptions,
  IMarkdownEditorYouTubeVideoEditRequest,
  IMarkdownEditorYouTubeVideoInsertionRequest,
  IMarkdownEditorYouTubeVideoNodeAttributes,
} from './types.js';

const MARKDOWN_EDITOR_YOUTUBE_VIDEO_NODE_PRIORITY = 100;

/**
 * Resolves a canonical descriptor from structurally unknown ProseMirror attributes.
 * @param attrs The node attributes to validate.
 * @returns The validated descriptor, or null when the node invariant is broken.
 */
const getMarkdownEditorYouTubeVideoDescriptorFromAttributes = (
  attrs: ProseMirrorNode['attrs'],
): IYouTubeVideoDescriptor | null => {
  const watchUrl: unknown = attrs['watchUrl'];
  const title: unknown = attrs['title'];

  return typeof watchUrl === 'string' && typeof title === 'string'
    ? parseYouTubeVideoUrl(watchUrl, title)
    : null;
};

/**
 * Extracts a standalone YouTube link descriptor from one Markdown paragraph node.
 * @param node The Milkdown Markdown AST node to inspect.
 * @returns The validated descriptor, or null when ordinary paragraph parsing should continue.
 */
const getMarkdownEditorYouTubeVideoDescriptorFromMarkdown = (
  node: MarkdownNode,
): IYouTubeVideoDescriptor | null => {
  if (node.type !== 'paragraph' || node.children?.length !== 1) {
    return null;
  }

  const [linkNode] = node.children;

  if (linkNode?.type !== 'link' || linkNode.children?.length !== 1) {
    return null;
  }

  const [labelNode] = linkNode.children;

  if (labelNode?.type !== 'text') {
    return null;
  }

  return parseYouTubeVideoUrl(linkNode['url'], labelNode['value']);
};

/**
 * Converts a validated descriptor into the atom node's persisted attributes.
 * @param descriptor The canonical YouTube video descriptor.
 * @returns The minimal validated node attributes.
 */
const createMarkdownEditorYouTubeVideoNodeAttributes = (
  descriptor: IYouTubeVideoDescriptor,
): IMarkdownEditorYouTubeVideoNodeAttributes => ({
  title: descriptor.title,
  watchUrl: descriptor.watchUrl,
});

/**
 * Compares canonical descriptors for guarded edits and render updates.
 * @param firstDescriptor The first descriptor.
 * @param secondDescriptor The second descriptor.
 * @returns True when both descriptors identify the same title and video.
 */
const areMarkdownEditorYouTubeVideoDescriptorsEqual = (
  firstDescriptor: IYouTubeVideoDescriptor | null,
  secondDescriptor: IYouTubeVideoDescriptor | null,
): boolean =>
  firstDescriptor?.videoId === secondDescriptor?.videoId &&
  firstDescriptor?.title === secondDescriptor?.title;

// custom atom schema for standalone YouTube links in portable Markdown.
export const markdownEditorYouTubeVideoSchema = $nodeSchema(
  MARKDOWN_EDITOR_YOUTUBE_VIDEO_NODE_NAME,
  () => ({
    atom: true,
    attrs: {
      title: { validate: 'string' },
      watchUrl: { validate: 'string' },
    },
    defining: true,
    draggable: true,
    group: 'block',
    isolating: true,
    marks: '',
    parseDOM: [
      {
        getAttrs: (dom) => {
          if (!(dom instanceof HTMLElement)) {
            return false;
          }

          const descriptor = parseYouTubeVideoUrl(
            dom.dataset['watchUrl'],
            dom.dataset['videoTitle'],
          );

          return descriptor ? createMarkdownEditorYouTubeVideoNodeAttributes(descriptor) : false;
        },
        tag: `[data-type="${MARKDOWN_EDITOR_YOUTUBE_VIDEO_DATA_TYPE}"]`,
      },
    ],
    parseMarkdown: {
      match: (node) => getMarkdownEditorYouTubeVideoDescriptorFromMarkdown(node) !== null,
      runner: (state, node, type) => {
        const descriptor = getMarkdownEditorYouTubeVideoDescriptorFromMarkdown(node);

        if (descriptor) {
          state.addNode(type, createMarkdownEditorYouTubeVideoNodeAttributes(descriptor));
        }
      },
    },
    priority: MARKDOWN_EDITOR_YOUTUBE_VIDEO_NODE_PRIORITY,
    selectable: true,
    toDOM: (node) => {
      const descriptor = getMarkdownEditorYouTubeVideoDescriptorFromAttributes(node.attrs);

      return [
        'div',
        {
          'data-type': MARKDOWN_EDITOR_YOUTUBE_VIDEO_DATA_TYPE,
          'data-video-title': descriptor?.title ?? '',
          'data-watch-url': descriptor?.watchUrl ?? '',
        },
      ];
    },
    toMarkdown: {
      match: (node) => node.type.name === MARKDOWN_EDITOR_YOUTUBE_VIDEO_NODE_NAME,
      runner: (state, node) => {
        const descriptor = getMarkdownEditorYouTubeVideoDescriptorFromAttributes(node.attrs);

        if (!descriptor) {
          state.addNode('paragraph', [
            {
              type: 'text',
              value: 'Unsupported YouTube video',
            },
          ]);
          return;
        }

        state.addNode('paragraph', [
          {
            children: [{ type: 'text', value: descriptor.title }],
            title: null,
            type: 'link',
            url: descriptor.watchUrl,
          },
        ]);
      },
    },
  }),
);

// authoring controller boundary configured independently for every editor instance.
const markdownEditorYouTubeVideoAuthoringControllerCtx = $ctx(
  null as IMarkdownEditorYouTubeVideoAuthoringController | null,
  'markdownEditorYouTubeVideoAuthoringController',
);

/**
 * Creates a per-editor authoring controller that updates mounted node views in place.
 * @param initialOptions The initial enabled state and edit callback.
 * @returns A controller with stable subscription methods.
 */
export const createMarkdownEditorYouTubeVideoAuthoringController = (
  initialOptions: IMarkdownEditorYouTubeVideoAuthoringOptions,
): IMarkdownEditorYouTubeVideoAuthoringController => {
  let currentOptions = initialOptions;
  const listeners = new Set<() => void>();

  return {
    dispose: (): void => {
      listeners.clear();
    },
    getOptions: (): IMarkdownEditorYouTubeVideoAuthoringOptions => currentOptions,
    subscribe: (listener): (() => void) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    update: (nextOptions): void => {
      if (
        currentOptions.isAuthoringEnabled === nextOptions.isAuthoringEnabled &&
        currentOptions.onEditRequest === nextOptions.onEditRequest
      ) {
        return;
      }

      currentOptions = nextOptions;
      listeners.forEach((listener) => {
        listener();
      });
    },
  };
};

/**
 * Configures the node-view authoring controller before Milkdown creates its editor view.
 * @param ctx The Milkdown context for the current Crepe instance.
 * @param controller The per-editor authoring controller.
 */
export const configureMarkdownEditorYouTubeVideoAuthoring = (
  ctx: Ctx,
  controller: IMarkdownEditorYouTubeVideoAuthoringController,
): void => {
  ctx.set(markdownEditorYouTubeVideoAuthoringControllerCtx.key, controller);
};

/**
 * Renders the current atom state into one stable React root.
 * @param options The node-view DOM, React root, descriptor, and authoring state.
 */
const renderMarkdownEditorYouTubeVideoNodeView = ({
  controller,
  descriptor,
  isSelected,
  onEdit,
  reactRoot,
}: {
  controller: IMarkdownEditorYouTubeVideoAuthoringController | null;
  descriptor: IYouTubeVideoDescriptor | null;
  isSelected: boolean;
  onEdit: (triggerElement: HTMLButtonElement) => void;
  reactRoot: ReactRoot;
}): void => {
  if (!descriptor) {
    reactRoot.render(
      <p className="text-destructive p-3 text-sm font-medium">Unsupported YouTube video</p>,
    );
    return;
  }

  reactRoot.render(
    <MarkdownEditorYouTubeVideoNodeView
      descriptor={descriptor}
      isAuthoringEnabled={controller?.getOptions().isAuthoringEnabled === true}
      isSelected={isSelected}
      onEdit={onEdit}
    />,
  );
};

/**
 * Creates the stable React-backed ProseMirror node view for one YouTube atom.
 * @param controller The current editor authoring controller.
 * @param node The initial YouTube atom node.
 * @param view The owning ProseMirror editor view.
 * @param getPos The live node-position resolver.
 * @returns The complete ProseMirror node-view lifecycle.
 */
const createMarkdownEditorYouTubeVideoNodeView = (
  controller: IMarkdownEditorYouTubeVideoAuthoringController | null,
  node: ProseMirrorNode,
  view: Parameters<NodeViewConstructor>[1],
  getPos: Parameters<NodeViewConstructor>[2],
): NodeView => {
  const dom = view.dom.ownerDocument.createElement('div');
  const reactRoot = createRoot(dom);
  let currentNode = node;
  let isSelected = false;

  dom.contentEditable = 'false';
  dom.dataset['slot'] = 'markdown-editor-youtube-video-node';
  dom.draggable = true;

  /**
   * Renders only the current node attributes, selection, and authoring capability.
   */
  const render = (): void => {
    renderMarkdownEditorYouTubeVideoNodeView({
      controller,
      descriptor: getMarkdownEditorYouTubeVideoDescriptorFromAttributes(currentNode.attrs),
      isSelected,
      onEdit: handleEdit,
      reactRoot,
    });
  };

  /**
   * Opens an edit session only while this live position still owns the expected node.
   * @param triggerElement The keyboard-focusable edit button.
   */
  const handleEdit = (triggerElement: HTMLButtonElement): void => {
    const authoringOptions = controller?.getOptions();

    if (!authoringOptions?.isAuthoringEnabled) {
      return;
    }

    try {
      const position = getPos();

      if (typeof position !== 'number') {
        return;
      }

      const liveNode = view.state.doc.nodeAt(position);
      const descriptor = getMarkdownEditorYouTubeVideoDescriptorFromAttributes(currentNode.attrs);
      const doc = view.state.doc;

      if (liveNode?.type !== currentNode.type || !descriptor) {
        return;
      }

      authoringOptions.onEditRequest({
        descriptor,
        doc,
        getPos,
        position,
        resolveTriggerElement: (): HTMLButtonElement | null => {
          let currentPosition = position;

          try {
            const livePosition = getPos();

            if (typeof livePosition === 'number') {
              currentPosition = livePosition;
            }
          } catch {
            currentPosition = position;
          }

          const currentDom = view.nodeDOM(currentPosition);

          return currentDom instanceof HTMLElement
            ? currentDom.querySelector<HTMLButtonElement>('[aria-label="Edit YouTube video"]')
            : null;
        },
        triggerElement,
      });
    } catch {
      return;
    }
  };

  const unsubscribe = controller?.subscribe(render);

  render();

  return {
    deselectNode: (): void => {
      if (!isSelected) {
        return;
      }

      isSelected = false;
      dom.classList.remove('ProseMirror-selectednode');
      render();
    },
    destroy: (): void => {
      unsubscribe?.();
      reactRoot.unmount();
    },
    dom,
    ignoreMutation: (): boolean => true,
    selectNode: (): void => {
      if (isSelected) {
        return;
      }

      isSelected = true;
      dom.classList.add('ProseMirror-selectednode');
      render();
    },
    stopEvent: (event): boolean => {
      const eventTarget = event.target;

      return (
        eventTarget instanceof Element &&
        eventTarget.closest('[data-youtube-video-interactive="true"]') !== null
      );
    },
    update: (nextNode): boolean => {
      if (nextNode.type !== currentNode.type) {
        return false;
      }

      const currentDescriptor = getMarkdownEditorYouTubeVideoDescriptorFromAttributes(
        currentNode.attrs,
      );
      const nextDescriptor = getMarkdownEditorYouTubeVideoDescriptorFromAttributes(nextNode.attrs);

      currentNode = nextNode;

      if (!areMarkdownEditorYouTubeVideoDescriptorsEqual(currentDescriptor, nextDescriptor)) {
        render();
      }

      return true;
    },
  };
};

const markdownEditorYouTubeVideoNodeView = $view(
  markdownEditorYouTubeVideoSchema.node,
  (ctx): NodeViewConstructor => {
    const controller = ctx.get(markdownEditorYouTubeVideoAuthoringControllerCtx.key);

    return (node, view, getPos) =>
      createMarkdownEditorYouTubeVideoNodeView(controller, node, view, getPos);
  },
);

/**
 * Moves the custom paragraph matcher immediately before Milkdown's ordinary paragraph schema.
 * @param ctx The Milkdown context that owns registered node schemas.
 * @returns A plugin lifecycle handler with no persistent cleanup.
 */
const prioritizeMarkdownEditorYouTubeVideoSchemaPlugin: MilkdownPlugin = (ctx) => () => {
  ctx.update(nodesCtx, (nodeSchemas) => {
    const youtubeVideoSchema = nodeSchemas.find(
      ([nodeName]) => nodeName === MARKDOWN_EDITOR_YOUTUBE_VIDEO_NODE_NAME,
    );

    if (!youtubeVideoSchema) {
      return nodeSchemas;
    }

    const remainingNodeSchemas = nodeSchemas.filter(
      ([nodeName]) => nodeName !== MARKDOWN_EDITOR_YOUTUBE_VIDEO_NODE_NAME,
    );
    const paragraphIndex = remainingNodeSchemas.findIndex(([nodeName]) => nodeName === 'paragraph');

    if (paragraphIndex < 0) {
      return nodeSchemas;
    }

    return [
      ...remainingNodeSchemas.slice(0, paragraphIndex),
      youtubeVideoSchema,
      ...remainingNodeSchemas.slice(paragraphIndex),
    ];
  });
};

// complete schema, context, priority, and node-view plugin bundle installed by every editor.
export const markdownEditorYouTubeVideoPlugin: Array<MilkdownPlugin> = [
  ...markdownEditorYouTubeVideoSchema,
  markdownEditorYouTubeVideoAuthoringControllerCtx,
  prioritizeMarkdownEditorYouTubeVideoSchemaPlugin,
  markdownEditorYouTubeVideoNodeView,
];

/**
 * Captures the exact empty slash-command block selected when the add dialog opens.
 * @param ctx The active Milkdown context from Crepe's slash menu.
 * @returns A guarded insertion request, or null when the selection is not safe to replace.
 */
export const createMarkdownEditorYouTubeVideoInsertionRequest = (
  ctx: Ctx,
): IMarkdownEditorYouTubeVideoInsertionRequest | null => {
  const view = ctx.get(editorViewCtx);
  const { selection } = view.state;

  if (!(selection instanceof TextSelection) || !selection.empty || selection.$from.depth < 1) {
    return null;
  }

  const blockDepth = selection.$from.depth;
  const blockNode = selection.$from.node(blockDepth);
  const blockText = blockNode.textContent;

  if (
    blockNode.type.name !== 'paragraph' ||
    selection.$from.parentOffset !== blockNode.content.size ||
    (blockText !== '' && !blockText.startsWith('/'))
  ) {
    return null;
  }

  return {
    blockDepth,
    blockPosition: selection.$from.before(blockDepth),
    blockText,
    doc: view.state.doc,
    editorElement: view.dom,
    selectionBookmark: selection.getBookmark(),
  };
};

/**
 * Replaces the unchanged originating slash block with a validated YouTube atom.
 * @param crepe The active Crepe editor.
 * @param request The insertion selection captured before the dialog opened.
 * @param descriptor The validated descriptor submitted by the dialog.
 * @returns True when the safe originating block was replaced.
 */
export const insertMarkdownEditorYouTubeVideo = (
  crepe: Crepe,
  request: IMarkdownEditorYouTubeVideoInsertionRequest,
  descriptor: IYouTubeVideoDescriptor,
): boolean => {
  if (crepe.editor.status !== EditorStatus.Created) {
    return false;
  }

  return crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);

    if (view.state.doc !== request.doc) {
      return false;
    }

    try {
      const resolvedSelection = request.selectionBookmark.resolve(view.state.doc);

      if (
        !(resolvedSelection instanceof TextSelection) ||
        resolvedSelection.$from.depth < request.blockDepth ||
        resolvedSelection.$from.before(request.blockDepth) !== request.blockPosition
      ) {
        return false;
      }

      const blockNode = view.state.doc.nodeAt(request.blockPosition);

      if (
        blockNode?.type.name !== 'paragraph' ||
        blockNode.textContent !== request.blockText ||
        (blockNode.textContent !== '' && !blockNode.textContent.startsWith('/'))
      ) {
        return false;
      }

      const replacementNode = markdownEditorYouTubeVideoSchema
        .type(ctx)
        .create(createMarkdownEditorYouTubeVideoNodeAttributes(descriptor));
      let transaction = view.state.tr.replaceWith(
        request.blockPosition,
        request.blockPosition + blockNode.nodeSize,
        replacementNode,
      );

      transaction = transaction.setSelection(
        NodeSelection.create(transaction.doc, request.blockPosition),
      );
      view.dispatch(transaction.scrollIntoView());

      return true;
    } catch {
      return false;
    }
  });
};

/**
 * Updates the same live YouTube atom that opened an edit session.
 * @param crepe The active Crepe editor.
 * @param request The live edit request captured by the node view.
 * @param descriptor The validated replacement descriptor.
 * @returns True when the expected node was updated.
 */
export const updateMarkdownEditorYouTubeVideo = (
  crepe: Crepe,
  request: IMarkdownEditorYouTubeVideoEditRequest,
  descriptor: IYouTubeVideoDescriptor,
): boolean => {
  if (crepe.editor.status !== EditorStatus.Created) {
    return false;
  }

  return crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);

    if (view.state.doc !== request.doc) {
      return false;
    }

    try {
      let position = request.position;

      try {
        const livePosition = request.getPos();

        if (typeof livePosition === 'number') {
          position = livePosition;
        }
      } catch {
        position = request.position;
      }

      const node = view.state.doc.nodeAt(position);
      const currentDescriptor = node
        ? getMarkdownEditorYouTubeVideoDescriptorFromAttributes(node.attrs)
        : null;

      if (
        node?.type !== markdownEditorYouTubeVideoSchema.type(ctx) ||
        !areMarkdownEditorYouTubeVideoDescriptorsEqual(currentDescriptor, request.descriptor) ||
        areMarkdownEditorYouTubeVideoDescriptorsEqual(currentDescriptor, descriptor)
      ) {
        return false;
      }

      let transaction = view.state.tr.setNodeMarkup(
        position,
        undefined,
        createMarkdownEditorYouTubeVideoNodeAttributes(descriptor),
      );

      transaction = transaction.setSelection(NodeSelection.create(transaction.doc, position));
      view.dispatch(transaction.scrollIntoView());

      return true;
    } catch {
      return false;
    }
  });
};
