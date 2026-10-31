import type { AriaAttributes, RefObject } from 'react';
import { syntaxHighlighting } from '@codemirror/language';
import { EditorView as CodeMirrorView } from '@codemirror/view';
import { classHighlighter } from '@lezer/highlight';
import { CrepeFeature, type Crepe, type CrepeConfig } from '@milkdown/crepe';
import type { BlockEditFeatureConfig } from '@milkdown/crepe/feature/block-edit';
import type { ToolbarFeatureConfig } from '@milkdown/crepe/feature/toolbar';
import type { TopBarFeatureConfig } from '@milkdown/crepe/feature/top-bar';
import type { PlaceholderFeatureConfig } from '@milkdown/crepe/feature/placeholder';
import type { Ctx, MilkdownPlugin } from '@milkdown/kit/ctx';
import {
  commandsCtx,
  editorViewCtx,
  EditorStatus,
  nodesCtx,
  prosePluginsCtx,
  remarkStringifyOptionsCtx,
} from '@milkdown/kit/core';
import {
  blockquoteSchema,
  bulletListSchema,
  clearTextInCurrentBlockCommand,
  codeBlockSchema,
  headingSchema,
  listItemSchema,
  orderedListSchema,
  paragraphSchema,
} from '@milkdown/kit/preset/commonmark';
import { uploadConfig } from '@milkdown/kit/plugin/upload';
import { createTable } from '@milkdown/kit/preset/gfm';
import type {
  Attrs,
  DOMOutputSpec,
  Node as ProseMirrorNode,
  NodeType,
} from '@milkdown/kit/prose/model';
import { NodeSelection, Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet, type EditorView } from '@milkdown/kit/prose/view';
import type { NodeSchema } from '@milkdown/kit/transformer';
import { forceUpdate, replaceAll } from '@milkdown/kit/utils';
import { prefersReducedMotion } from 'jg-utilities';

import { bindKeyboardButtonBehavior } from './keyboard.utilities.js';
import { syncMarkdownEditorImageControls } from './image-controls.utilities.js';

import {
  MARKDOWN_VARIABLE_DATA_SLOT,
  MARKDOWN_VARIABLE_HIGHLIGHT_CLASS_NAMES,
  createMarkdownVariableToken,
  getEscapedMarkdownVariableMatches,
  getMarkdownVariableMatches,
  normalizeEscapedMarkdownVariableTokens,
  restoreMarkdownVariableText,
  restoreMarkdownVariableTokens,
} from '../../shared/markdown-variables/index.js';
import {
  MARKDOWN_EDITOR_YOUTUBE_VIDEO_ICON_NODE,
  MARKDOWN_EDITOR_YOUTUBE_VIDEO_MENU_KEY,
  MARKDOWN_EDITOR_YOUTUBE_VIDEO_MENU_LABEL,
  createMarkdownEditorYouTubeVideoInsertionRequest,
  type IMarkdownEditorYouTubeVideoInsertionRequest,
} from './youtube-video/index.js';
import {
  MARKDOWN_EDITOR_ALL_TOOLS,
  MARKDOWN_EDITOR_AUTHORING_HEADING_LEVELS,
  MARKDOWN_EDITOR_FLOATING_MENU_VIEWPORT_PADDING,
  MARKDOWN_EDITOR_HEADING_LEVELS,
  MARKDOWN_EDITOR_MOBILE_TURN_INTO_MENU_MAX_HEIGHT,
  MARKDOWN_EDITOR_TOOLBAR_ACTIONS,
  MARKDOWN_EDITOR_TOOLS,
  MARKDOWN_EDITOR_TURN_INTO_MENU_MAX_HEIGHT,
  MARKDOWN_EDITOR_TURN_INTO_MENU_TRIGGER_GAP,
  MARKDOWN_EDITOR_TURN_INTO_OPTION_ICON_NODES,
  MARKDOWN_EDITOR_TURN_INTO_MENU_WIDTH,
  MARKDOWN_EDITOR_WIDE_MIN_WIDTH_PX,
  TABLE_COLUMN_BUTTON_LABELS,
} from './constants.js';
import {
  getMarkdownEditorSupportedToolSet,
  getVisibleMarkdownEditorToolbarActionsFromSet,
  hasAnyMarkdownEditorTool,
  type IMarkdownEditorToolbarAction,
} from './tool-policy.utilities.js';
import type {
  IMarkdownEditorAuthoringHeadingLevel,
  IMarkdownEditorBlockActionTarget,
  IMarkdownEditorHeadingLevel,
  IMarkdownEditorTool,
  IMarkdownEditorTurnIntoOption,
  IMarkdownEditorTurnIntoOptionKind,
} from './types.js';

// default table dimensions match the Crepe add-menu table command.
const MARKDOWN_EDITOR_DEFAULT_TABLE_ROW_COUNT = 3;
const MARKDOWN_EDITOR_DEFAULT_TABLE_COLUMN_COUNT = 3;

// block edit tools are exposed through Crepe's slash menu and block handle controls.
const MARKDOWN_EDITOR_BLOCK_EDIT_TOOLS = [
  MARKDOWN_EDITOR_TOOLS.Text,
  MARKDOWN_EDITOR_TOOLS.Heading,
  MARKDOWN_EDITOR_TOOLS.Variable,
  MARKDOWN_EDITOR_TOOLS.Quote,
  MARKDOWN_EDITOR_TOOLS.Divider,
  MARKDOWN_EDITOR_TOOLS.BulletList,
  MARKDOWN_EDITOR_TOOLS.OrderedList,
  MARKDOWN_EDITOR_TOOLS.TaskList,
  MARKDOWN_EDITOR_TOOLS.CodeBlock,
  MARKDOWN_EDITOR_TOOLS.Table,
  MARKDOWN_EDITOR_TOOLS.Image,
  MARKDOWN_EDITOR_TOOLS.YouTube,
  MARKDOWN_EDITOR_TOOLS.Math,
] as const;

// list rendering tools share Crepe's list item component.
const MARKDOWN_EDITOR_LIST_ITEM_TOOLS = [
  MARKDOWN_EDITOR_TOOLS.BulletList,
  MARKDOWN_EDITOR_TOOLS.OrderedList,
  MARKDOWN_EDITOR_TOOLS.TaskList,
] as const;

// toolbar tools are shown only when Crepe renders the floating formatting toolbar.
const MARKDOWN_EDITOR_INLINE_TOOLBAR_TOOLS = [
  MARKDOWN_EDITOR_TOOLS.Bold,
  MARKDOWN_EDITOR_TOOLS.Italic,
  MARKDOWN_EDITOR_TOOLS.Strikethrough,
  MARKDOWN_EDITOR_TOOLS.InlineCode,
  MARKDOWN_EDITOR_TOOLS.Math,
  MARKDOWN_EDITOR_TOOLS.Link,
  MARKDOWN_EDITOR_TOOLS.Variable,
] as const;

// Crepe's inline math node id is used to patch a ProseMirror DOM spec compatibility issue.
const MARKDOWN_EDITOR_INLINE_MATH_NODE_NAME = 'math_inline';

// image insertion accepts URLs only, so file upload affordances use link-focused copy.
const MARKDOWN_EDITOR_IMAGE_LINK_PLACEHOLDER = 'e.g. https://example.com/image.png';

// Crepe 7.20's compiled image input references this Vue fragment symbol by a bare global name.
const MARKDOWN_EDITOR_VUE_FRAGMENT_SYMBOL = Symbol.for('v-fgt');

// global shape for the Crepe image input compatibility patch.
type IMarkdownEditorGlobalScope = typeof globalThis & {
  Fragment?: symbol;
};

// block text conversion options used by the turn-into menu.
type IMarkdownEditorTextBlockConversionOptions = {
  shouldRestoreVariables?: boolean;
};

// Crepe block-edit builder types inferred from the installed block-edit feature API.
type IMarkdownEditorBlockEditFeatureConfig = BlockEditFeatureConfig;
type IMarkdownEditorInsertMenuBuilder = Parameters<
  NonNullable<IMarkdownEditorBlockEditFeatureConfig['buildMenu']>
>[0];

// Crepe toolbar builder types inferred from the installed toolbar feature API.
type IMarkdownEditorToolbarBuilder = Parameters<
  NonNullable<ToolbarFeatureConfig['buildToolbar']>
>[0];
type IMarkdownEditorToolbarGroupBuilder = ReturnType<IMarkdownEditorToolbarBuilder['addGroup']>;
type IMarkdownEditorToolbarItem = ReturnType<
  IMarkdownEditorToolbarBuilder['build']
>[number]['items'][number];
type IMarkdownEditorTopBarHeadingOption = NonNullable<
  TopBarFeatureConfig['headingOptions']
>[number];
type IMarkdownEditorTopBarBuilder = Parameters<NonNullable<TopBarFeatureConfig['buildTopBar']>>[0];

// text serializer info mirrors the markdown stringifier safe-boundary contract.
type IMarkdownEditorTextSerializerInfo = {
  after: string;
  before: string;
};

// text serializer state only needs the stringifier's safe text helper.
type IMarkdownEditorTextSerializerState = {
  safe: (value: string, info: IMarkdownEditorTextSerializerInfo) => string;
};

// text serializer nodes are handled structurally to avoid leaking mdast details.
type IMarkdownEditorTextSerializerNode = {
  value: string;
};

// selected variable ranges include the full markdown token even when only its name is selected.
type IMarkdownEditorSelectedVariableRange = {
  from: number;
  to: number;
  token: string;
};

// replacement selection options support editable placeholder text after command insertion.
type IMarkdownEditorTextReplacementSelection = {
  fromOffset: number;
  toOffset: number;
};

// SVG nodes accepted by the shared Crepe icon serializer.
type IMarkdownEditorSvgIconNode = ReadonlyArray<
  readonly ['path' | 'rect', Readonly<Record<string, string>>]
>;

// editor decorations share the same visual treatment as rendered markdown variables.
const MARKDOWN_EDITOR_VARIABLE_DECORATION_CLASS_NAME =
  MARKDOWN_VARIABLE_HIGHLIGHT_CLASS_NAMES.join(' ');

// stable ProseMirror plugin key keeps variable decorations addressable by the editor state.
const MARKDOWN_EDITOR_VARIABLE_DECORATION_PLUGIN_KEY = new PluginKey<DecorationSet>(
  'markdown-editor-variable-highlights',
);

// Crepe toolbar item keys are used to preserve native commands while filtering visible tools.
const MARKDOWN_EDITOR_TOOLBAR_ITEM_KEYS = {
  [MARKDOWN_EDITOR_TOOLS.Bold]: 'bold',
  [MARKDOWN_EDITOR_TOOLS.InlineCode]: 'code',
  [MARKDOWN_EDITOR_TOOLS.Italic]: 'italic',
  [MARKDOWN_EDITOR_TOOLS.Link]: 'link',
  [MARKDOWN_EDITOR_TOOLS.Math]: 'latex',
  [MARKDOWN_EDITOR_TOOLS.Strikethrough]: 'strikethrough',
  [MARKDOWN_EDITOR_TOOLS.Variable]: 'variable',
} as const satisfies Record<IMarkdownEditorToolbarAction['tool'], string>;

/**
 * Converts a camel-case SVG attribute name into markup form.
 * @param attributeName The React-style SVG attribute name.
 * @returns The kebab-case SVG attribute name.
 */
const getMarkdownEditorSvgAttributeName = (attributeName: string): string =>
  attributeName.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);

/**
 * Escapes characters that cannot be safely embedded in an SVG attribute.
 * @param value The raw SVG attribute value.
 * @returns The escaped SVG attribute value.
 */
const escapeMarkdownEditorSvgAttributeValue = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

/**
 * Serializes one icon node into SVG markup.
 * @param elementName The SVG child element name.
 * @param attributes The SVG child element attributes.
 * @returns The serialized SVG child element.
 */
const createMarkdownEditorSvgIconElement = (
  elementName: string,
  attributes: Readonly<Record<string, string>>,
): string => {
  const serializedAttributes = Object.entries(attributes)
    .map(
      ([attributeName, attributeValue]) =>
        `${getMarkdownEditorSvgAttributeName(attributeName)}="${escapeMarkdownEditorSvgAttributeValue(
          attributeValue,
        )}"`,
    )
    .join(' ');

  return `<${elementName} ${serializedAttributes} />`;
};

/**
 * Serializes a shared Lucide-style icon node into Crepe's SVG-string format.
 * @param iconNode The compact icon node to serialize.
 * @returns The SVG string consumed by Crepe menu builders.
 */
const createMarkdownEditorSvgIcon = (iconNode: IMarkdownEditorSvgIconNode): string => `
  <svg
    xmlns="http://www.w3.org/2000/svg"
    data-editor-icon="outline"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    ${iconNode.map(([elementName, attributes]) => createMarkdownEditorSvgIconElement(elementName, attributes)).join('')}
  </svg>
`;

// Crepe menu icon strings are generated from the same nodes rendered by the custom menu.
const MARKDOWN_EDITOR_MENU_ICONS = {
  'bullet-list': createMarkdownEditorSvgIcon(
    MARKDOWN_EDITOR_TURN_INTO_OPTION_ICON_NODES['bullet-list'],
  ),
  'heading-1': createMarkdownEditorSvgIcon(
    MARKDOWN_EDITOR_TURN_INTO_OPTION_ICON_NODES['heading-1'],
  ),
  'heading-2': createMarkdownEditorSvgIcon(
    MARKDOWN_EDITOR_TURN_INTO_OPTION_ICON_NODES['heading-2'],
  ),
  'heading-3': createMarkdownEditorSvgIcon(
    MARKDOWN_EDITOR_TURN_INTO_OPTION_ICON_NODES['heading-3'],
  ),
  'ordered-list': createMarkdownEditorSvgIcon(
    MARKDOWN_EDITOR_TURN_INTO_OPTION_ICON_NODES['ordered-list'],
  ),
  code: createMarkdownEditorSvgIcon(MARKDOWN_EDITOR_TURN_INTO_OPTION_ICON_NODES.code),
  paragraph: createMarkdownEditorSvgIcon(MARKDOWN_EDITOR_TURN_INTO_OPTION_ICON_NODES.paragraph),
  quote: createMarkdownEditorSvgIcon(MARKDOWN_EDITOR_TURN_INTO_OPTION_ICON_NODES.quote),
  table: createMarkdownEditorSvgIcon(MARKDOWN_EDITOR_TURN_INTO_OPTION_ICON_NODES.table),
  variable: createMarkdownEditorSvgIcon(MARKDOWN_EDITOR_TURN_INTO_OPTION_ICON_NODES.variable),
  youtube: createMarkdownEditorSvgIcon(MARKDOWN_EDITOR_YOUTUBE_VIDEO_ICON_NODE),
} as const;

const ignoreMarkdownEditorYouTubeVideoInsertionRequest = (): undefined => undefined;

// top-bar paragraph option remains available alongside the authoring heading scale.
const MARKDOWN_EDITOR_TOP_BAR_PARAGRAPH_OPTION: IMarkdownEditorTopBarHeadingOption = {
  label: 'Paragraph',
  level: null,
};

/**
 * Returns true when a numeric value is a Markdown document heading level.
 * @param headingLevel The value to validate as a heading level.
 * @returns True when the value is one of the CommonMark heading levels.
 */
const isMarkdownEditorHeadingLevel = (
  headingLevel: number,
): headingLevel is IMarkdownEditorHeadingLevel =>
  MARKDOWN_EDITOR_HEADING_LEVELS.includes(headingLevel as IMarkdownEditorHeadingLevel);

/**
 * Returns true when a document heading level is offered by authoring controls.
 * @param headingLevel The document heading level to inspect.
 * @returns True when the level is available as an authoring action.
 */
const isMarkdownEditorAuthoringHeadingLevel = (
  headingLevel: IMarkdownEditorHeadingLevel,
): headingLevel is IMarkdownEditorAuthoringHeadingLevel =>
  MARKDOWN_EDITOR_AUTHORING_HEADING_LEVELS.includes(
    headingLevel as IMarkdownEditorAuthoringHeadingLevel,
  );

/**
 * Returns true when a ProseMirror node stores code-like content.
 * @param node The ProseMirror node to inspect.
 * @returns True when variable highlighting should skip the node and its descendants.
 */
const isMarkdownEditorCodeNode = (node: ProseMirrorNode): boolean => node.type.spec.code === true;

/**
 * Returns true when a text node is marked as inline code.
 * @param node The ProseMirror text node to inspect.
 * @returns True when the node should keep template placeholders as plain code text.
 */
const hasMarkdownEditorCodeMark = (node: ProseMirrorNode): boolean =>
  node.marks.some((mark) => mark.type.spec.code === true);

/**
 * Creates an inline editor decoration for one template variable.
 * @param from The inclusive ProseMirror position where the variable starts.
 * @param to The exclusive ProseMirror position where the variable ends.
 * @returns A ProseMirror decoration that highlights the variable text.
 */
const createMarkdownEditorVariableDecoration = (from: number, to: number): Decoration =>
  Decoration.inline(
    from,
    to,
    {
      class: MARKDOWN_EDITOR_VARIABLE_DECORATION_CLASS_NAME,
      'data-slot': MARKDOWN_VARIABLE_DATA_SLOT,
    },
    {
      inclusiveEnd: false,
      inclusiveStart: false,
    },
  );

/**
 * Adds variable decorations for a text node or skips code-like descendants.
 * @param decorations The mutable collection receiving new decorations.
 * @param node The current ProseMirror node from document traversal.
 * @param position The ProseMirror start position of the current node.
 * @returns False when descendants should be skipped, otherwise void.
 */
const addMarkdownEditorVariableDecorations = (
  decorations: Decoration[],
  node: ProseMirrorNode,
  position: number,
): false | void => {
  if (isMarkdownEditorCodeNode(node)) {
    return false;
  }

  const textContent = node.text;

  if (!node.isText || typeof textContent !== 'string' || hasMarkdownEditorCodeMark(node)) {
    return;
  }

  for (const match of getMarkdownVariableMatches(textContent)) {
    const from = position + match.index;

    decorations.push(createMarkdownEditorVariableDecoration(from, from + match.token.length));
  }
};

/**
 * Builds the complete decoration set for template variables in the editor document.
 * @param doc The ProseMirror document to scan.
 * @returns A decoration set containing all visible variable highlights.
 */
const createMarkdownEditorVariableDecorationSet = (doc: ProseMirrorNode): DecorationSet => {
  const decorations: Decoration[] = [];

  doc.descendants((node, position) =>
    addMarkdownEditorVariableDecorations(decorations, node, position),
  );

  return DecorationSet.create(doc, decorations);
};

/**
 * Creates the ProseMirror plugin that paints template variables without changing markdown content.
 * @returns A ProseMirror plugin that recomputes highlights when the document changes.
 */
const createMarkdownEditorVariableDecorationPlugin = (): Plugin<DecorationSet> =>
  new Plugin<DecorationSet>({
    key: MARKDOWN_EDITOR_VARIABLE_DECORATION_PLUGIN_KEY,
    props: {
      decorations: (state) => MARKDOWN_EDITOR_VARIABLE_DECORATION_PLUGIN_KEY.getState(state)!,
    },
    state: {
      apply: (transaction, previousDecorations, _oldState, newState) =>
        transaction.docChanged
          ? createMarkdownEditorVariableDecorationSet(newState.doc)
          : previousDecorations,
      init: (_config, state) => createMarkdownEditorVariableDecorationSet(state.doc),
    },
  });

/**
 * Returns true when the current selection is contained by a variable token.
 * @param from The inclusive start of the variable token.
 * @param to The exclusive end of the variable token.
 * @param selectionFrom The inclusive selection start.
 * @param selectionTo The exclusive selection end.
 * @returns True when the selection or cursor sits inside the variable token.
 */
const isMarkdownEditorSelectionInsideVariableRange = (
  from: number,
  to: number,
  selectionFrom: number,
  selectionTo: number,
): boolean => {
  if (selectionFrom === selectionTo) {
    return from < selectionFrom && selectionFrom < to;
  }

  return from <= selectionFrom && selectionTo <= to;
};

/**
 * Finds a template-variable token that contains the current selection.
 * @param doc The ProseMirror document to scan.
 * @param selectionFrom The inclusive selection start.
 * @param selectionTo The exclusive selection end.
 * @returns The full variable range when the selection is inside a variable token.
 */
const getMarkdownEditorSelectedVariableRange = (
  doc: ProseMirrorNode,
  selectionFrom: number,
  selectionTo: number,
): IMarkdownEditorSelectedVariableRange | null => {
  let selectedVariableRange: IMarkdownEditorSelectedVariableRange | null = null;

  doc.descendants((node, position) => {
    if (selectedVariableRange) {
      return false;
    }

    const textContent = node.text;

    if (!node.isText || typeof textContent !== 'string') {
      return true;
    }

    for (const match of getMarkdownVariableMatches(textContent)) {
      const from = position + match.index;
      const to = from + match.token.length;

      if (isMarkdownEditorSelectionInsideVariableRange(from, to, selectionFrom, selectionTo)) {
        selectedVariableRange = {
          from,
          to,
          token: match.token,
        };

        return false;
      }
    }

    return true;
  });

  return selectedVariableRange;
};

/**
 * Serializes a plain text span with markdown-safe surrounding context.
 * @param text The full text node value.
 * @param startIndex The inclusive span start.
 * @param endIndex The exclusive span end.
 * @param state The markdown serializer state.
 * @param info The boundary info from the current text node.
 * @returns The safe markdown text for the requested span.
 */
const serializeMarkdownEditorTextSpan = (
  text: string,
  startIndex: number,
  endIndex: number,
  state: IMarkdownEditorTextSerializerState,
  info: IMarkdownEditorTextSerializerInfo,
): string => {
  if (startIndex >= endIndex) {
    return '';
  }

  return state.safe(text.slice(startIndex, endIndex), {
    after: text[endIndex] ?? info.after,
    before: text[startIndex - 1] ?? info.before,
  });
};

/**
 * Serializes markdown text while preserving readable variable-token underscores.
 * @param node The mdast text node being serialized.
 * @param _parent The mdast parent node, unused for text serialization.
 * @param state The markdown serializer state.
 * @param info The boundary info from the current text node.
 * @returns Markdown-safe text with normalized variable tokens.
 */
const serializeMarkdownEditorText = (
  node: IMarkdownEditorTextSerializerNode,
  _parent: unknown,
  state: IMarkdownEditorTextSerializerState,
  info: IMarkdownEditorTextSerializerInfo,
): string => {
  let serializedText = '';
  let cursorIndex = 0;

  for (const match of getEscapedMarkdownVariableMatches(node.value)) {
    serializedText += serializeMarkdownEditorTextSpan(
      node.value,
      cursorIndex,
      match.index,
      state,
      info,
    );
    serializedText += normalizeEscapedMarkdownVariableTokens(match.token);
    cursorIndex = match.index + match.token.length;
  }

  serializedText += serializeMarkdownEditorTextSpan(
    node.value,
    cursorIndex,
    node.value.length,
    state,
    info,
  );

  return serializedText;
};

/**
 * Registers editor decorations that highlight `{{VARIABLE_NAME}}` placeholders.
 * @param ctx The Milkdown context that owns ProseMirror plugins.
 * @returns A Milkdown runner that installs the variable highlight plugin.
 */
export const highlightMarkdownEditorVariablesPlugin: MilkdownPlugin = (ctx) => {
  /**
   * Adds the variable highlight ProseMirror plugin during Milkdown setup.
   */
  const loadMarkdownEditorVariableDecorations = (): void => {
    ctx.update(prosePluginsCtx, (previousPlugins) => [
      ...previousPlugins,
      createMarkdownEditorVariableDecorationPlugin(),
    ]);
  };

  return loadMarkdownEditorVariableDecorations;
};

/**
 * Ignores files received through paste and drag/drop upload handlers.
 * @returns A promise that resolves to no nodes for the editor to insert.
 */
const resolveDisabledMarkdownEditorFileUpload = (): Promise<Array<ProseMirrorNode>> =>
  Promise.resolve([]);

/**
 * Defines the Vue fragment global expected by Crepe's image URL preview branch.
 */
export const ensureMarkdownEditorVueFragmentGlobal = (): void => {
  const globalScope = globalThis as IMarkdownEditorGlobalScope;

  globalScope.Fragment ??= MARKDOWN_EDITOR_VUE_FRAGMENT_SYMBOL;
};

/**
 * Returns the string value stored in a Crepe inline math node.
 * @param node The inline math ProseMirror node.
 * @returns The inline math expression text.
 */
const getMarkdownEditorInlineMathValue = (node: ProseMirrorNode): string =>
  typeof node.attrs['value'] === 'string' ? node.attrs['value'] : '';

/**
 * Builds a ProseMirror DOM output spec for Crepe inline math nodes.
 * @param node The inline math ProseMirror node.
 * @returns The DOM output spec accepted by the installed ProseMirror runtime.
 */
const getMarkdownEditorInlineMathDomSpec = (node: ProseMirrorNode): DOMOutputSpec => {
  const mathValue = getMarkdownEditorInlineMathValue(node);

  return [
    'span',
    {
      'data-type': MARKDOWN_EDITOR_INLINE_MATH_NODE_NAME,
      'data-value': mathValue,
    },
    `$${mathValue}$`,
  ];
};

/**
 * Replaces Crepe's inline math serializer with a valid ProseMirror DOM spec array.
 * @param nodeSchema The inline math node schema registered by Crepe.
 * @returns The node schema with a compatible DOM serializer.
 */
const patchMarkdownEditorInlineMathNodeSchema = (nodeSchema: NodeSchema): NodeSchema => ({
  ...nodeSchema,
  toDOM: getMarkdownEditorInlineMathDomSpec,
});

/**
 * Applies the inline math schema patch to the current Milkdown node registry.
 * @param ctx The Milkdown context that owns the node registry.
 */
const patchMarkdownEditorInlineMathSchema = (ctx: Ctx): void => {
  ctx.update(nodesCtx, (nodeSchemas) =>
    nodeSchemas.map(([nodeName, nodeSchema]): [string, NodeSchema] =>
      nodeName === MARKDOWN_EDITOR_INLINE_MATH_NODE_NAME
        ? [nodeName, patchMarkdownEditorInlineMathNodeSchema(nodeSchema)]
        : [nodeName, nodeSchema],
    ),
  );
};

/**
 * Patches Crepe inline math after the Latex feature has registered its node schema.
 * @param ctx The Milkdown context for the patch plugin.
 * @returns A Milkdown runner that applies the inline math schema patch.
 */
export const patchMarkdownEditorInlineMathSchemaPlugin: MilkdownPlugin = (ctx) => {
  /**
   * Applies the inline math schema patch during Milkdown plugin loading.
   */
  const loadMarkdownEditorInlineMathSchemaPatch = (): void => {
    patchMarkdownEditorInlineMathSchema(ctx);
  };

  return loadMarkdownEditorInlineMathSchemaPatch;
};

/**
 * Returns the Crepe toolbar item keys enabled by the normalized tool set.
 * @param supportedToolSet The enabled editor tools.
 * @returns The enabled Crepe toolbar item keys.
 */
const getSupportedMarkdownEditorToolbarItemKeys = (
  supportedToolSet: ReadonlySet<IMarkdownEditorTool>,
): ReadonlySet<string> =>
  new Set(
    getVisibleMarkdownEditorToolbarActionsFromSet(supportedToolSet).map(
      (action) => MARKDOWN_EDITOR_TOOLBAR_ITEM_KEYS[action.tool],
    ),
  );

/**
 * Returns null for unsupported Crepe menu items and undefined for default-enabled items.
 * @param supportedToolSet The enabled editor tools.
 * @param tool The tool controlled by the Crepe menu item.
 * @returns Null when the item should be removed from Crepe's menu.
 */
const getMarkdownEditorToolMenuItemConfig = (
  supportedToolSet: ReadonlySet<IMarkdownEditorTool>,
  tool: IMarkdownEditorTool,
  config?: { icon: string },
): null | { icon: string } | undefined => (supportedToolSet.has(tool) ? config : null);

/**
 * Returns the Crepe menu config for an authoring heading level.
 * @param hasHeadingTool Whether heading controls are enabled by the tool policy.
 * @param headingLevel The authoring heading level controlled by the menu item.
 * @returns The icon config when headings are supported, otherwise null.
 */
const getMarkdownEditorHeadingMenuItemConfig = (
  hasHeadingTool: boolean,
  headingLevel: IMarkdownEditorAuthoringHeadingLevel,
): null | { icon: string } =>
  hasHeadingTool ? { icon: MARKDOWN_EDITOR_MENU_ICONS[`heading-${headingLevel}`] } : null;

/**
 * Creates the Crepe block edit configuration for the enabled tool set.
 * @param supportedToolSet The enabled editor tools.
 * @returns The Crepe block edit feature configuration.
 */
const getMarkdownEditorBlockEditFeatureConfig = (
  supportedToolSet: ReadonlySet<IMarkdownEditorTool>,
  onYouTubeVideoInsertRequest: (request: IMarkdownEditorYouTubeVideoInsertionRequest) => void,
): IMarkdownEditorBlockEditFeatureConfig => {
  const hasHeadingTool = supportedToolSet.has(MARKDOWN_EDITOR_TOOLS.Heading);
  const hasTextGroup =
    hasAnyMarkdownEditorTool(supportedToolSet, [
      MARKDOWN_EDITOR_TOOLS.Text,
      MARKDOWN_EDITOR_TOOLS.Variable,
      MARKDOWN_EDITOR_TOOLS.Quote,
      MARKDOWN_EDITOR_TOOLS.Divider,
    ]) || hasHeadingTool;
  const hasListGroup = hasAnyMarkdownEditorTool(supportedToolSet, MARKDOWN_EDITOR_LIST_ITEM_TOOLS);
  const hasAdvancedGroup = hasAnyMarkdownEditorTool(supportedToolSet, [
    MARKDOWN_EDITOR_TOOLS.Image,
    MARKDOWN_EDITOR_TOOLS.CodeBlock,
    MARKDOWN_EDITOR_TOOLS.Table,
    MARKDOWN_EDITOR_TOOLS.Math,
    MARKDOWN_EDITOR_TOOLS.YouTube,
  ]);

  return {
    advancedGroup: hasAdvancedGroup
      ? {
          codeBlock: getMarkdownEditorToolMenuItemConfig(
            supportedToolSet,
            MARKDOWN_EDITOR_TOOLS.CodeBlock,
            { icon: MARKDOWN_EDITOR_MENU_ICONS.code },
          ),
          image: getMarkdownEditorToolMenuItemConfig(supportedToolSet, MARKDOWN_EDITOR_TOOLS.Image),
          math: getMarkdownEditorToolMenuItemConfig(supportedToolSet, MARKDOWN_EDITOR_TOOLS.Math),
          table: getMarkdownEditorToolMenuItemConfig(
            supportedToolSet,
            MARKDOWN_EDITOR_TOOLS.Table,
            {
              icon: MARKDOWN_EDITOR_MENU_ICONS.table,
            },
          ),
        }
      : null,
    ...(supportedToolSet.has(MARKDOWN_EDITOR_TOOLS.Variable) ||
    supportedToolSet.has(MARKDOWN_EDITOR_TOOLS.YouTube)
      ? {
          buildMenu: (builder) => {
            if (supportedToolSet.has(MARKDOWN_EDITOR_TOOLS.Variable)) {
              addMarkdownEditorVariableInsertMenuItem(builder);
            }

            if (supportedToolSet.has(MARKDOWN_EDITOR_TOOLS.YouTube)) {
              addMarkdownEditorYouTubeVideoInsertMenuItem(builder, onYouTubeVideoInsertRequest);
            }
          },
        }
      : {}),
    blockHandle: {
      floatingUIOptions: {
        middleware: [],
      },
    },
    listGroup: hasListGroup
      ? {
          bulletList: getMarkdownEditorToolMenuItemConfig(
            supportedToolSet,
            MARKDOWN_EDITOR_TOOLS.BulletList,
            { icon: MARKDOWN_EDITOR_MENU_ICONS['bullet-list'] },
          ),
          orderedList: getMarkdownEditorToolMenuItemConfig(
            supportedToolSet,
            MARKDOWN_EDITOR_TOOLS.OrderedList,
            { icon: MARKDOWN_EDITOR_MENU_ICONS['ordered-list'] },
          ),
          taskList: getMarkdownEditorToolMenuItemConfig(
            supportedToolSet,
            MARKDOWN_EDITOR_TOOLS.TaskList,
          ),
        }
      : null,
    textGroup: hasTextGroup
      ? {
          divider: getMarkdownEditorToolMenuItemConfig(
            supportedToolSet,
            MARKDOWN_EDITOR_TOOLS.Divider,
          ),
          h1: getMarkdownEditorHeadingMenuItemConfig(hasHeadingTool, 1),
          h2: getMarkdownEditorHeadingMenuItemConfig(hasHeadingTool, 2),
          h3: getMarkdownEditorHeadingMenuItemConfig(hasHeadingTool, 3),
          h4: null,
          h5: null,
          h6: null,
          quote: getMarkdownEditorToolMenuItemConfig(
            supportedToolSet,
            MARKDOWN_EDITOR_TOOLS.Quote,
            { icon: MARKDOWN_EDITOR_MENU_ICONS.quote },
          ),
          text: getMarkdownEditorToolMenuItemConfig(supportedToolSet, MARKDOWN_EDITOR_TOOLS.Text, {
            icon: MARKDOWN_EDITOR_MENU_ICONS.paragraph,
          }),
        }
      : null,
  };
};

/**
 * Creates the image feature configuration that keeps image insertion link-only.
 * @returns The Crepe image feature configuration for link-only image insertion.
 */
const getMarkdownEditorImageBlockFeatureConfig = (): NonNullable<
  NonNullable<CrepeConfig['featureConfigs']>[CrepeFeature.ImageBlock]
> => ({
  blockUploadPlaceholderText: MARKDOWN_EDITOR_IMAGE_LINK_PLACEHOLDER,
  inlineUploadPlaceholderText: MARKDOWN_EDITOR_IMAGE_LINK_PLACEHOLDER,
});

/**
 * Adds the app-ui variable command to Crepe's insert menu.
 * @param builder The Crepe slash-menu builder.
 */
const addMarkdownEditorVariableInsertMenuItem = (
  builder: IMarkdownEditorInsertMenuBuilder,
): void => {
  builder.getGroup('text').addItem('variable', {
    icon: MARKDOWN_EDITOR_MENU_ICONS.variable,
    label: 'Variable',
    onRun: (ctx) => {
      const commands = ctx.get(commandsCtx);

      commands.call(clearTextInCurrentBlockCommand.key);
      insertMarkdownEditorVariableFromCtx(ctx);
    },
  });
};

/**
 * Adds the validated YouTube authoring flow to Crepe's Advanced insert group.
 * @param builder The Crepe slash-menu builder.
 * @param onInsertRequest The parent callback that opens the add dialog.
 */
const addMarkdownEditorYouTubeVideoInsertMenuItem = (
  builder: IMarkdownEditorInsertMenuBuilder,
  onInsertRequest: (request: IMarkdownEditorYouTubeVideoInsertionRequest) => void,
): void => {
  builder.getGroup('advanced').addItem(MARKDOWN_EDITOR_YOUTUBE_VIDEO_MENU_KEY, {
    icon: MARKDOWN_EDITOR_MENU_ICONS.youtube,
    label: MARKDOWN_EDITOR_YOUTUBE_VIDEO_MENU_LABEL,
    onRun: (ctx) => {
      const request = createMarkdownEditorYouTubeVideoInsertionRequest(ctx);

      if (request) {
        onInsertRequest(request);
      }
    },
  });
};

/**
 * Creates the app-ui variable toolbar item for Crepe's native selection menu.
 * @returns The toolbar item that inserts or wraps template variables.
 */
const createMarkdownEditorVariableToolbarItem = (): IMarkdownEditorToolbarItem => ({
  active: (ctx) => {
    const view = ctx.get(editorViewCtx);
    const { selection } = view.state;

    return (
      getMarkdownEditorSelectedVariableRange(view.state.doc, selection.from, selection.to) !== null
    );
  },
  icon: MARKDOWN_EDITOR_MENU_ICONS.variable,
  key: MARKDOWN_EDITOR_TOOLBAR_ITEM_KEYS[MARKDOWN_EDITOR_TOOLS.Variable],
  label: MARKDOWN_EDITOR_TOOLBAR_ACTIONS[6].ariaLabel,
  onRun: (ctx) => {
    insertMarkdownEditorVariableFromCtx(ctx);
  },
});

/**
 * Filters Crepe toolbar items by enabled native toolbar item keys.
 * @param items The native Crepe toolbar items from a group.
 * @param supportedToolbarItemKeys The toolbar item keys allowed by the editor policy.
 * @returns The toolbar items that should remain visible.
 */
const getSupportedMarkdownEditorToolbarItems = (
  items: ReadonlyArray<IMarkdownEditorToolbarItem>,
  supportedToolbarItemKeys: ReadonlySet<string>,
): ReadonlyArray<IMarkdownEditorToolbarItem> =>
  items.filter((item) => supportedToolbarItemKeys.has(item.key));

/**
 * Adds existing Crepe toolbar items into a rebuilt toolbar group.
 * @param groupBuilder The target toolbar group builder.
 * @param items The toolbar items to add in rendered order.
 */
const addMarkdownEditorToolbarItems = (
  groupBuilder: IMarkdownEditorToolbarGroupBuilder,
  items: ReadonlyArray<IMarkdownEditorToolbarItem>,
): void => {
  for (const item of items) {
    const { key, ...toolbarItem } = item;

    groupBuilder.addItem(key, toolbarItem);
  }
};

/**
 * Creates the native Crepe toolbar configuration for app-ui inline tools.
 * @param supportedToolSet The enabled editor tools.
 * @returns The Crepe toolbar configuration.
 */
const getMarkdownEditorToolbarFeatureConfig = (
  supportedToolSet: ReadonlySet<IMarkdownEditorTool>,
): ToolbarFeatureConfig => ({
  // Crepe titles and names its own buttons; keep both equal to the names the editor applies
  boldLabel: MARKDOWN_EDITOR_TOOLBAR_ACTIONS[0].ariaLabel,
  italicLabel: MARKDOWN_EDITOR_TOOLBAR_ACTIONS[1].ariaLabel,
  strikethroughLabel: MARKDOWN_EDITOR_TOOLBAR_ACTIONS[2].ariaLabel,
  codeLabel: MARKDOWN_EDITOR_TOOLBAR_ACTIONS[3].ariaLabel,
  latexLabel: MARKDOWN_EDITOR_TOOLBAR_ACTIONS[4].ariaLabel,
  linkLabel: MARKDOWN_EDITOR_TOOLBAR_ACTIONS[5].ariaLabel,
  buildToolbar: (builder) => {
    const supportedToolbarItemKeys = getSupportedMarkdownEditorToolbarItemKeys(supportedToolSet);
    const formattingItems = getSupportedMarkdownEditorToolbarItems(
      builder.getGroup('formatting').group.items,
      supportedToolbarItemKeys,
    );
    const functionItems = [
      ...getSupportedMarkdownEditorToolbarItems(
        builder.getGroup('function').group.items,
        supportedToolbarItemKeys,
      ),
      ...(supportedToolbarItemKeys.has(
        MARKDOWN_EDITOR_TOOLBAR_ITEM_KEYS[MARKDOWN_EDITOR_TOOLS.Variable],
      )
        ? [createMarkdownEditorVariableToolbarItem()]
        : []),
    ];

    builder.clear();

    if (formattingItems.length > 0) {
      addMarkdownEditorToolbarItems(builder.addGroup('formatting', 'Formatting'), formattingItems);
    }

    if (functionItems.length > 0) {
      addMarkdownEditorToolbarItems(builder.addGroup('function', 'Function'), functionItems);
    }
  },
});

/**
 * Creates the heading options used by Crepe's top-bar selector.
 * @param hasHeadingTool Whether heading controls are enabled by the tool policy.
 * @returns The heading options visible in Crepe's top-bar selector.
 */
const getMarkdownEditorTopBarHeadingOptions = (
  hasHeadingTool: boolean,
): Array<IMarkdownEditorTopBarHeadingOption> => {
  if (!hasHeadingTool) {
    return [MARKDOWN_EDITOR_TOP_BAR_PARAGRAPH_OPTION];
  }

  return [
    MARKDOWN_EDITOR_TOP_BAR_PARAGRAPH_OPTION,
    ...MARKDOWN_EDITOR_AUTHORING_HEADING_LEVELS.map((headingLevel) => ({
      label: `Heading ${headingLevel}`,
      level: headingLevel,
    })),
  ];
};

/**
 * Returns the text style of the active document block.
 * @param ctx The Milkdown context containing the active editor selection.
 * @returns The paragraph or full Markdown heading label for the active block.
 */
const getMarkdownEditorActiveTextStyleLabel = (ctx: Ctx): string => {
  const activeNode = ctx.get(editorViewCtx).state.selection.$from.parent;

  if (
    activeNode.type !== headingSchema.type(ctx) ||
    typeof activeNode.attrs['level'] !== 'number'
  ) {
    return MARKDOWN_EDITOR_TOP_BAR_PARAGRAPH_OPTION.label;
  }

  return isMarkdownEditorHeadingLevel(activeNode.attrs['level'])
    ? `Heading ${activeNode.attrs['level']}`
    : MARKDOWN_EDITOR_TOP_BAR_PARAGRAPH_OPTION.label;
};

/**
 * Keeps the top-bar active label accurate for document headings outside the authoring scale.
 * @param builder The Crepe top-bar builder containing the configured heading selector.
 */
const configureMarkdownEditorTopBarActiveLabel = (builder: IMarkdownEditorTopBarBuilder): void => {
  const [headingSelectorItem] = builder.getGroup('heading').group.items;

  if (headingSelectorItem?.selector) {
    headingSelectorItem.selector.activeLabel = getMarkdownEditorActiveTextStyleLabel;
  }
};

/**
 * Builds the Crepe feature settings for the current markdown editor tool policy.
 * @param options The active theme, placeholder, and tool policy.
 * @returns Crepe feature flags and feature-specific configuration.
 */
export const getMarkdownEditorCrepeConfig = ({
  isDarkMode,
  onYouTubeVideoInsertRequest = ignoreMarkdownEditorYouTubeVideoInsertionRequest,
  placeholder,
  supportedTools,
}: {
  isDarkMode: boolean;
  onYouTubeVideoInsertRequest?: (request: IMarkdownEditorYouTubeVideoInsertionRequest) => void;
  placeholder: string;
  supportedTools?: ReadonlyArray<IMarkdownEditorTool>;
}): Pick<CrepeConfig, 'featureConfigs' | 'features'> => {
  const supportedToolSet = getMarkdownEditorSupportedToolSet(supportedTools);
  const hasHeadingTool = supportedToolSet.has(MARKDOWN_EDITOR_TOOLS.Heading);
  const hasBlockEdit = hasAnyMarkdownEditorTool(supportedToolSet, MARKDOWN_EDITOR_BLOCK_EDIT_TOOLS);
  const hasCodeMirror = hasAnyMarkdownEditorTool(supportedToolSet, [
    MARKDOWN_EDITOR_TOOLS.CodeBlock,
    MARKDOWN_EDITOR_TOOLS.Math,
  ]);
  const hasInlineToolbar = hasAnyMarkdownEditorTool(
    supportedToolSet,
    MARKDOWN_EDITOR_INLINE_TOOLBAR_TOOLS,
  );
  const hasListItem = hasAnyMarkdownEditorTool(supportedToolSet, MARKDOWN_EDITOR_LIST_ITEM_TOOLS);
  const hasTable =
    supportedToolSet.has(MARKDOWN_EDITOR_TOOLS.Table) ||
    supportedToolSet.has(MARKDOWN_EDITOR_TOOLS.TableAlignment);
  const hasImage = supportedToolSet.has(MARKDOWN_EDITOR_TOOLS.Image);

  return {
    featureConfigs: {
      ...(hasBlockEdit
        ? {
            [CrepeFeature.BlockEdit]: getMarkdownEditorBlockEditFeatureConfig(
              supportedToolSet,
              onYouTubeVideoInsertRequest,
            ),
          }
        : {}),
      ...(hasCodeMirror
        ? {
            [CrepeFeature.CodeMirror]: {
              theme: {
                extension: [
                  CodeMirrorView.theme({}, { dark: isDarkMode }),
                  syntaxHighlighting(classHighlighter),
                ],
              },
            },
          }
        : {}),
      ...(hasImage
        ? {
            [CrepeFeature.ImageBlock]: getMarkdownEditorImageBlockFeatureConfig(),
          }
        : {}),
      ...(hasInlineToolbar
        ? {
            [CrepeFeature.Toolbar]: getMarkdownEditorToolbarFeatureConfig(supportedToolSet),
          }
        : {}),
      [CrepeFeature.Placeholder]: {
        mode: 'block',
        text: placeholder,
      },
      [CrepeFeature.TopBar]: {
        buildTopBar: configureMarkdownEditorTopBarActiveLabel,
        headingOptions: getMarkdownEditorTopBarHeadingOptions(hasHeadingTool),
      },
    },
    features: {
      [CrepeFeature.BlockEdit]: hasBlockEdit,
      [CrepeFeature.CodeMirror]: hasCodeMirror,
      [CrepeFeature.ImageBlock]: hasImage,
      [CrepeFeature.Latex]: supportedToolSet.has(MARKDOWN_EDITOR_TOOLS.Math),
      [CrepeFeature.LinkTooltip]: supportedToolSet.has(MARKDOWN_EDITOR_TOOLS.Link),
      [CrepeFeature.ListItem]: hasListItem,
      [CrepeFeature.Table]: hasTable,
      [CrepeFeature.Toolbar]: hasInlineToolbar,
    },
  };
};

/**
 * Disables Crepe's file-based paste and drag/drop upload behavior for this editor.
 * @param ctx The Milkdown context that owns the upload plugin configuration.
 */
export const disableMarkdownEditorFileUploads = (ctx: Ctx): void => {
  ctx.update(uploadConfig.key, (previousConfig) => ({
    ...previousConfig,
    enableHtmlFileUploader: false,
    uploader: resolveDisabledMarkdownEditorFileUpload,
  }));
};

/**
 * Configures markdown serialization for app-ui editor output.
 * @param ctx The Milkdown context that owns remark stringifier options.
 */
export const configureMarkdownEditorSerialization = (ctx: Ctx): void => {
  ctx.update(remarkStringifyOptionsCtx, (previousOptions) => ({
    ...previousOptions,
    handlers: {
      ...previousOptions.handlers,
      text: serializeMarkdownEditorText,
    },
  }));
};

/**
 * Normalizes markdown emitted by the editor before it leaves app-ui.
 * @param markdown The markdown string produced by Milkdown.
 * @returns Markdown with readable template-variable underscores.
 */
export const normalizeMarkdownEditorMarkdown = (markdown: string): string =>
  normalizeEscapedMarkdownVariableTokens(markdown);

/**
 * Reads markdown from Crepe using the app-ui output contract.
 * @param crepe The current Crepe editor instance.
 * @returns Normalized markdown suitable for controlled editor values.
 */
export const getMarkdownEditorMarkdown = (crepe: Crepe): string =>
  normalizeMarkdownEditorMarkdown(crepe.getMarkdown());

/**
 * Converts a heading level into the matching turn-into option kind.
 * @param headingLevel The authoring heading level.
 * @returns The option kind used by the block action menu.
 */
const getMarkdownEditorHeadingOptionKind = (
  headingLevel: IMarkdownEditorAuthoringHeadingLevel,
): IMarkdownEditorTurnIntoOptionKind => `heading-${headingLevel}`;

/**
 * Returns the menu position clamped to the visible viewport.
 * @param triggerRect The block handle button rectangle.
 * @returns Fixed viewport geometry for the floating menu.
 */
export const getMarkdownEditorTurnIntoMenuPosition = (
  triggerRect: DOMRect,
): { left: number; maxHeight: number; top: number } => {
  const menuMaxHeight =
    window.innerWidth < MARKDOWN_EDITOR_WIDE_MIN_WIDTH_PX
      ? MARKDOWN_EDITOR_MOBILE_TURN_INTO_MENU_MAX_HEIGHT
      : MARKDOWN_EDITOR_TURN_INTO_MENU_MAX_HEIGHT;
  const maxHeight = Math.min(
    menuMaxHeight,
    Math.max(0, window.innerHeight - MARKDOWN_EDITOR_FLOATING_MENU_VIEWPORT_PADDING * 2),
  );
  const maxTop = Math.max(
    MARKDOWN_EDITOR_FLOATING_MENU_VIEWPORT_PADDING,
    window.innerHeight - maxHeight - MARKDOWN_EDITOR_FLOATING_MENU_VIEWPORT_PADDING,
  );
  const left = Math.min(
    Math.max(
      triggerRect.right + MARKDOWN_EDITOR_TURN_INTO_MENU_TRIGGER_GAP,
      MARKDOWN_EDITOR_FLOATING_MENU_VIEWPORT_PADDING,
    ),
    window.innerWidth -
      MARKDOWN_EDITOR_TURN_INTO_MENU_WIDTH -
      MARKDOWN_EDITOR_FLOATING_MENU_VIEWPORT_PADDING,
  );
  const top = Math.min(
    Math.max(triggerRect.top, MARKDOWN_EDITOR_FLOATING_MENU_VIEWPORT_PADDING),
    maxTop,
  );

  return { left, maxHeight, top };
};

/**
 * Assigns ordered accessibility labels to a button list.
 * @param buttons The buttons to label.
 * @param labels The ordered labels to apply.
 */
const applyOrderedButtonLabels = (
  buttons: Array<HTMLButtonElement>,
  labels: ReadonlyArray<string>,
): void => {
  buttons.forEach((button, index) => {
    const label = labels[index];

    if (!label) {
      return;
    }

    button.setAttribute('aria-label', label);
  });
};

/**
 * Scrolls a menu area to its first option with the preferred motion behavior.
 * @param scrollArea The scrollable menu area.
 */
const scrollMarkdownEditorMenuToTop = (scrollArea: HTMLElement): void => {
  if (typeof scrollArea.scrollTo !== 'function') {
    scrollArea.scrollTop = 0;
    return;
  }

  scrollArea.scrollTo({
    behavior: prefersReducedMotion(scrollArea.ownerDocument.defaultView) ? 'auto' : 'smooth',
    top: 0,
  });
};

/**
 * Resets a scrollable menu area when its owning menu transitions from closed to open.
 * @param menu The menu element that tracks the open transition.
 * @param scrollArea The scrollable area that should start at the first option.
 * @param isOpen Whether the menu is currently open.
 */
const syncMenuScrollState = (menu: HTMLElement, scrollArea: HTMLElement, isOpen: boolean): void => {
  const wasOpen = menu.dataset['editorMenuWasOpen'] === 'true';

  if (isOpen && !wasOpen) {
    scrollMarkdownEditorMenuToTop(scrollArea);
  }

  menu.dataset['editorMenuWasOpen'] = isOpen ? 'true' : 'false';
};

/**
 * Resets Crepe menu scroll positions when they transition from closed to open.
 * @param container The editor wrapper element.
 */
const syncCrepeMenuState = (container: HTMLElement): void => {
  const slashMenus = Array.from(container.querySelectorAll<HTMLElement>('.milkdown-slash-menu'));

  slashMenus.forEach((slashMenu) => {
    const isOpen = slashMenu.dataset['show'] === 'true';
    const menuGroups = slashMenu.querySelector<HTMLElement>('.menu-groups');

    if (menuGroups) {
      syncMenuScrollState(slashMenu, menuGroups, isOpen);
      return;
    }

    slashMenu.dataset['editorMenuWasOpen'] = isOpen ? 'true' : 'false';
  });

  const topBarHeadingSelectors = Array.from(
    container.querySelectorAll<HTMLElement>('.milkdown-top-bar .top-bar-heading-selector'),
  );

  topBarHeadingSelectors.forEach((selector) => {
    const dropdown = selector.querySelector<HTMLElement>('.top-bar-heading-dropdown');

    if (!dropdown) {
      selector.dataset['editorMenuWasOpen'] = 'false';
      return;
    }

    syncMenuScrollState(selector, dropdown, true);
  });
};

/**
 * Returns true when a text value is exactly one template variable.
 * @param text The text content to inspect.
 * @returns True when the trimmed text is a complete template-variable token.
 */
const isMarkdownEditorVariableOnlyText = (text: string): boolean => {
  const plainTextContent = text.trim();
  const [variableMatch] = getMarkdownVariableMatches(plainTextContent);

  return (
    variableMatch !== undefined &&
    variableMatch.index === 0 &&
    variableMatch.token.length === plainTextContent.length
  );
};

/**
 * Reads the currently selected block target from the Milkdown editor.
 * @param crepe The current Crepe editor instance.
 * @returns The selected block target, or null when no block can be addressed.
 */
export const getMarkdownEditorBlockActionTarget = (
  crepe: Crepe,
): IMarkdownEditorBlockActionTarget | null => {
  if (crepe.editor.status !== EditorStatus.Created) {
    return null;
  }

  return crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { selection } = view.state;
    const selectedNode =
      selection instanceof NodeSelection ? selection.node : selection.$from.parent;

    if (!selectedNode || selectedNode.type.name === 'doc') {
      return null;
    }

    const headingLevel =
      selectedNode.type.name === 'heading' && typeof selectedNode.attrs['level'] === 'number'
        ? selectedNode.attrs['level']
        : null;

    return {
      from:
        selection instanceof NodeSelection
          ? selection.from
          : selection.$from.before(selection.$from.depth),
      headingLevel:
        headingLevel !== null && isMarkdownEditorHeadingLevel(headingLevel) ? headingLevel : null,
      isTextBlock: selectedNode.isTextblock,
      nodeTypeName: selectedNode.type.name,
      plainTextContent: selectedNode.textBetween(0, selectedNode.content.size, '\n'),
      to:
        selection instanceof NodeSelection
          ? selection.to
          : selection.$from.after(selection.$from.depth),
    };
  });
};

/**
 * Gets the active turn-into kind for the selected block target.
 * @param target The selected block target.
 * @returns The active option kind, or null when the block type is not represented by the menu.
 */
export const getMarkdownEditorActiveTurnIntoOptionKind = (
  target: IMarkdownEditorBlockActionTarget,
): IMarkdownEditorTurnIntoOptionKind | null => {
  if (isMarkdownEditorVariableOnlyText(target.plainTextContent)) {
    return 'variable';
  }

  if (target.nodeTypeName === 'paragraph') {
    return 'paragraph';
  }

  if (
    target.nodeTypeName === 'heading' &&
    target.headingLevel !== null &&
    isMarkdownEditorAuthoringHeadingLevel(target.headingLevel)
  ) {
    return getMarkdownEditorHeadingOptionKind(target.headingLevel);
  }

  if (target.nodeTypeName === 'blockquote') {
    return 'quote';
  }

  if (target.nodeTypeName === 'bullet_list') {
    return 'bullet-list';
  }

  if (target.nodeTypeName === 'ordered_list') {
    return 'ordered-list';
  }

  if (target.nodeTypeName === 'code_block') {
    return 'code';
  }

  if (target.nodeTypeName === 'table') {
    return 'table';
  }

  return null;
};

/**
 * Applies accessibility and whole-tool visibility to the top-bar heading control.
 * @param container The editor wrapper element.
 * @param supportedToolSet The enabled editor tools.
 */
const syncHeadingControlAccessibility = (
  container: HTMLElement,
  supportedToolSet: ReadonlySet<IMarkdownEditorTool>,
): void => {
  const hasHeadingTool = supportedToolSet.has(MARKDOWN_EDITOR_TOOLS.Heading);
  const headingButton = container.querySelector<HTMLButtonElement>(
    '.milkdown-top-bar .top-bar-heading-button',
  );

  if (headingButton) {
    bindKeyboardButtonBehavior(headingButton, 'Text style', 'pointerdown');
    headingButton.hidden = !hasHeadingTool;
  }

  for (const option of container.querySelectorAll<HTMLButtonElement>('.top-bar-heading-option')) {
    bindKeyboardButtonBehavior(option, option.textContent.trim(), 'pointerdown');
  }
};

/**
 * Hides and disables Crepe's file upload controls while preserving image link entry.
 * @param container The editor wrapper element.
 */
const syncImageUploadControlVisibility = (container: HTMLElement): void => {
  const imageUploadInputs = Array.from(
    container.querySelectorAll<HTMLInputElement>(
      ".image-edit .link-importer .placeholder input[type='file']",
    ),
  );
  const imageUploadLabels = Array.from(
    container.querySelectorAll<HTMLElement>('.image-edit .link-importer .placeholder .uploader'),
  );

  imageUploadInputs.forEach((imageUploadInput) => {
    imageUploadInput.disabled = true;
    imageUploadInput.hidden = true;
    imageUploadInput.setAttribute('aria-hidden', 'true');
  });

  imageUploadLabels.forEach((imageUploadLabel) => {
    imageUploadLabel.hidden = true;
    imageUploadLabel.setAttribute('aria-hidden', 'true');
  });
};

/** Names embedded editors and gives Safari a keyboard target for horizontal code scrolling. */
const syncMarkdownEditorCodeBlockAccessibility = (container: HTMLElement): void => {
  for (const content of container.querySelectorAll<HTMLElement>(
    '.milkdown-code-block .cm-content',
  )) {
    const language = content.dataset['language'] ?? '';
    content.setAttribute('aria-label', language ? `${language} code editor` : 'Code editor');
  }
  for (const scroller of container.querySelectorAll<HTMLElement>(
    '.milkdown-code-block .cm-scroller',
  )) {
    scroller.tabIndex = 0;
    scroller.setAttribute('role', 'group');
    scroller.setAttribute('aria-label', 'Scrollable code block');
  }
};

/**
 * Applies accessibility labels and DOM visibility fixes inside the editor.
 * @param container The editor wrapper element.
 * @param supportedTools The enabled editor tools.
 * @param crepe The live editor for image-height mutations.
 */
export const applyMarkdownEditorAccessibility = (
  container: HTMLElement,
  supportedTools: ReadonlyArray<IMarkdownEditorTool> = MARKDOWN_EDITOR_ALL_TOOLS,
  crepe?: Crepe,
): void => {
  const supportedToolSet = getMarkdownEditorSupportedToolSet(supportedTools);
  const toolbarActions = getVisibleMarkdownEditorToolbarActionsFromSet(supportedToolSet);

  syncHeadingControlAccessibility(container, supportedToolSet);
  syncCrepeMenuState(container);
  syncImageUploadControlVisibility(container);
  syncMarkdownEditorCodeBlockAccessibility(container);
  syncMarkdownEditorImageControls(container, crepe);

  const toolbarButtons = Array.from(
    container.querySelectorAll<HTMLButtonElement>('.milkdown-toolbar .toolbar-item'),
  );

  toolbarButtons.forEach((button, index) => {
    const action = toolbarActions[index];

    if (!action) {
      return;
    }

    bindKeyboardButtonBehavior(button, action.ariaLabel, 'pointerdown');
  });

  const blockHandleButtons = Array.from(
    container.querySelectorAll<HTMLElement>('.milkdown-block-handle > .operation-item'),
  );
  const blockActionsButton = blockHandleButtons[1];

  if (blockActionsButton) {
    bindKeyboardButtonBehavior(blockActionsButton, 'Open block actions');
  }

  const addRowButton = container.querySelector<HTMLButtonElement>(
    ".milkdown-table-block [data-role='x-line-drag-handle'] .add-button",
  );
  const addColumnButton = container.querySelector<HTMLButtonElement>(
    ".milkdown-table-block [data-role='y-line-drag-handle'] .add-button",
  );

  addRowButton?.setAttribute('aria-label', 'Add row');
  addColumnButton?.setAttribute('aria-label', 'Add column');

  const columnHandle = container.querySelector<HTMLElement>(
    ".milkdown-table-block [data-role='col-drag-handle']",
  );
  const rowHandle = container.querySelector<HTMLElement>(
    ".milkdown-table-block [data-role='row-drag-handle']",
  );

  if (columnHandle) {
    bindKeyboardButtonBehavior(columnHandle, 'Open column actions');
  }

  if (rowHandle) {
    bindKeyboardButtonBehavior(rowHandle, 'Open row actions');
  }

  const columnActionButtons = Array.from(
    container.querySelectorAll<HTMLButtonElement>(
      ".milkdown-table-block [data-role='col-drag-handle'] .button-group > button",
    ),
  );

  applyOrderedButtonLabels(columnActionButtons, TABLE_COLUMN_BUTTON_LABELS);

  columnActionButtons.forEach((button, index) => {
    button.hidden = index < 3 && !supportedToolSet.has(MARKDOWN_EDITOR_TOOLS.TableAlignment);
  });

  const rowActionButtons = Array.from(
    container.querySelectorAll<HTMLButtonElement>(
      ".milkdown-table-block [data-role='row-drag-handle'] .button-group > button",
    ),
  );

  applyOrderedButtonLabels(rowActionButtons, ['Delete row']);
};

/**
 * Synchronizes readonly and validation semantics without recreating the editor instance.
 * @param crepe The current Crepe editor instance.
 * @param ariaLabel The accessible editor label.
 * @param ariaDescribedBy The optional accessible description id.
 * @param ariaInvalid Whether the editor contains an invalid value.
 * @param ariaRequired Whether the editor is required before submission.
 */
export const syncEditorAttributes = (
  crepe: Crepe,
  ariaLabel?: string,
  ariaDescribedBy?: string,
  ariaInvalid?: AriaAttributes['aria-invalid'],
  ariaRequired?: AriaAttributes['aria-required'],
): void => {
  if (crepe.editor.status !== EditorStatus.Created) {
    return;
  }

  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const currentAttributes =
      typeof view.props.attributes === 'function'
        ? view.props.attributes(view.state)
        : view.props.attributes;
    const nextAttributes: Record<string, string> = {
      ...currentAttributes,
      'aria-label': ariaLabel ?? 'Markdown editor',
      'aria-multiline': 'true',
      'aria-readonly': String(crepe.readonly),
      role: 'textbox',
    };

    if (ariaDescribedBy) {
      nextAttributes['aria-describedby'] = ariaDescribedBy;
    } else {
      delete nextAttributes['aria-describedby'];
    }

    if (ariaInvalid !== undefined && ariaInvalid !== false) {
      nextAttributes['aria-invalid'] = String(ariaInvalid);
    } else {
      delete nextAttributes['aria-invalid'];
    }

    if (ariaRequired !== undefined && ariaRequired !== false) {
      nextAttributes['aria-required'] = String(ariaRequired);
    } else {
      delete nextAttributes['aria-required'];
    }

    view.setProps({
      ...view.props,
      attributes: nextAttributes,
    });
  });
};

/**
 * Updates the placeholder text in place and forces a view refresh.
 * @param crepe The current Crepe editor instance.
 * @param placeholder The latest placeholder text.
 */
export const syncEditorPlaceholder = (crepe: Crepe, placeholder: string): void => {
  if (crepe.editor.status !== EditorStatus.Created) {
    return;
  }

  crepe.editor.action((ctx) => {
    // Crepe's main and feature bundles create separate slice keys for this named context.
    ctx.update<Required<PlaceholderFeatureConfig>, 'placeholderConfigCtx'>(
      'placeholderConfigCtx',
      (previousConfig) => ({
        ...previousConfig,
        mode: 'block' as const,
        text: placeholder,
      }),
    );
  });

  crepe.editor.action(forceUpdate());
};

/**
 * Replaces editor markdown only when the external value diverges from the current document.
 * @param crepe The current Crepe editor instance.
 * @param nextValue The controlled markdown value.
 * @param currentMarkdownRef The latest editor markdown ref.
 */
export const syncEditorValue = (
  crepe: Crepe,
  nextValue: string,
  currentMarkdownRef: RefObject<string>,
): void => {
  if (crepe.editor.status !== EditorStatus.Created || nextValue === currentMarkdownRef.current) {
    return;
  }

  crepe.editor.action(replaceAll(nextValue, true));
  currentMarkdownRef.current = nextValue;
};

/**
 * Replaces editor text and selects either the configured inserted range or the end cursor.
 * @param view The ProseMirror editor view to update.
 * @param from The inclusive replacement start.
 * @param to The exclusive replacement end.
 * @param text The text to insert.
 * @param selection The optional inserted-text range to select after replacement.
 * @returns True when the editor document was updated.
 */
const replaceMarkdownEditorText = (
  view: EditorView,
  from: number,
  to: number,
  text: string,
  selection?: IMarkdownEditorTextReplacementSelection,
): boolean => {
  try {
    let transaction = view.state.tr.insertText(text, from, to);
    const textSelection = selection
      ? TextSelection.create(
          transaction.doc,
          from + selection.fromOffset,
          from + selection.toOffset,
        )
      : TextSelection.create(transaction.doc, from + text.length);

    transaction = transaction.setSelection(textSelection);

    view.dispatch(transaction.scrollIntoView());
    view.focus();

    return true;
  } catch {
    return false;
  }
};

/**
 * Toggles the selected variable back to plain text when the selection is inside a variable.
 * @param view The ProseMirror editor view to update.
 * @param variableRange The containing variable token range.
 * @returns True when the editor document was updated.
 */
const restoreMarkdownEditorVariable = (
  view: EditorView,
  variableRange: IMarkdownEditorSelectedVariableRange,
): boolean =>
  replaceMarkdownEditorText(
    view,
    variableRange.from,
    variableRange.to,
    restoreMarkdownVariableText(variableRange.token),
  );

/**
 * Inserts a template variable through the active Milkdown context.
 * @param ctx The Milkdown context that owns the active editor view.
 * @returns True when the editor document was updated.
 */
const insertMarkdownEditorVariableFromCtx = (ctx: Ctx): boolean => {
  const view = ctx.get(editorViewCtx);
  const { selection } = view.state;
  const variableRange = getMarkdownEditorSelectedVariableRange(
    view.state.doc,
    selection.from,
    selection.to,
  );

  if (variableRange) {
    return restoreMarkdownEditorVariable(view, variableRange);
  }

  const selectedText = selection.empty
    ? ''
    : view.state.doc.textBetween(selection.from, selection.to, ' ');
  const variableToken = createMarkdownVariableToken(selectedText);

  return replaceMarkdownEditorText(view, selection.from, selection.to, variableToken, {
    fromOffset: 2,
    toOffset: variableToken.length - 2,
  });
};

/**
 * Toggles template-variable formatting for the current cursor or selection.
 * @param crepe The current Crepe editor instance.
 * @returns True when the editor document was updated.
 */
export const insertMarkdownEditorVariable = (crepe: Crepe): boolean => {
  if (crepe.editor.status !== EditorStatus.Created) {
    return false;
  }

  return crepe.editor.action((ctx) => insertMarkdownEditorVariableFromCtx(ctx));
};

/**
 * Extracts text for conversions that cannot preserve nested block structure.
 * @param node The ProseMirror node selected by the block action menu.
 * @returns The selected node's plain text content.
 */
const getMarkdownEditorPlainTextContent = (node: ProseMirrorNode): string =>
  node.textBetween(0, node.content.size, '\n');

/**
 * Returns true when flattened block text contains one or more variables.
 * @param node The ProseMirror node selected by the block action menu.
 * @returns True when the node text contains a template-variable token.
 */
const hasMarkdownEditorVariableTextContent = (node: ProseMirrorNode): boolean =>
  getMarkdownVariableMatches(getMarkdownEditorPlainTextContent(node)).length > 0;

/**
 * Restores variables only when a turn-into conversion needs plain text output.
 * @param text The text content from the selected block.
 * @param options The conversion behavior requested by the target option.
 * @returns Text with variables restored when requested.
 */
const getMarkdownEditorTextBlockContent = (
  text: string,
  options: IMarkdownEditorTextBlockConversionOptions,
): string => (options.shouldRestoreVariables ? restoreMarkdownVariableTokens(text) : text);

/**
 * Creates a text block from either inline content or flattened block text.
 * @param nodeType The target text block node type.
 * @param selectedNode The node being transformed.
 * @param attrs The attributes to apply to the new text block.
 * @param options The conversion behavior requested by the target option.
 * @returns A text block node that can replace the selected target.
 */
const createMarkdownEditorTextBlockNode = (
  nodeType: NodeType,
  selectedNode: ProseMirrorNode,
  attrs: Attrs | null,
  options: IMarkdownEditorTextBlockConversionOptions = {},
): ProseMirrorNode => {
  const plainTextContent = getMarkdownEditorPlainTextContent(selectedNode);
  const shouldUsePlainTextContent =
    !selectedNode.isTextblock ||
    (options.shouldRestoreVariables && hasMarkdownEditorVariableTextContent(selectedNode));
  const restoredTextContent = getMarkdownEditorTextBlockContent(plainTextContent, options);
  const content = !shouldUsePlainTextContent
    ? selectedNode.content
    : restoredTextContent.length > 0
      ? nodeType.schema.text(restoredTextContent)
      : null;

  return nodeType.create(attrs, content);
};

/**
 * Creates a paragraph node from the selected block content.
 * @param ctx The Milkdown context that owns the active schema.
 * @param selectedNode The node being transformed.
 * @param options The conversion behavior requested by the target option.
 * @returns A paragraph node suitable for nesting in list items.
 */
const createMarkdownEditorParagraphNode = (
  ctx: Ctx,
  selectedNode: ProseMirrorNode,
  options: IMarkdownEditorTextBlockConversionOptions = {},
): ProseMirrorNode =>
  createMarkdownEditorTextBlockNode(paragraphSchema.type(ctx), selectedNode, null, options);

/**
 * Creates a list node containing the selected block as a single list item.
 * @param ctx The Milkdown context that owns the active schema.
 * @param selectedNode The node being transformed.
 * @param listKind The markdown list family to create.
 * @param options The conversion behavior requested by the target option.
 * @returns A bullet or ordered list node containing one item.
 */
const createMarkdownEditorListNode = (
  ctx: Ctx,
  selectedNode: ProseMirrorNode,
  listKind: 'bullet' | 'ordered',
  options: IMarkdownEditorTextBlockConversionOptions = {},
): ProseMirrorNode => {
  const listType = listKind === 'bullet' ? bulletListSchema.type(ctx) : orderedListSchema.type(ctx);
  const listAttrs = listKind === 'bullet' ? { spread: false } : { order: 1, spread: false };
  const listItemAttrs =
    listKind === 'bullet'
      ? { listType: 'bullet', spread: true }
      : { label: '1.', listType: 'ordered', spread: true };
  const listItem = listItemSchema
    .type(ctx)
    .create(listItemAttrs, createMarkdownEditorParagraphNode(ctx, selectedNode, options));

  return listType.create(listAttrs, listItem);
};

/**
 * Creates a code block from the selected block's plain text content.
 * @param ctx The Milkdown context that owns the active schema.
 * @param selectedNode The node being transformed.
 * @param options The conversion behavior requested by the target option.
 * @returns A code block node preserving the selected text.
 */
const createMarkdownEditorCodeBlockNode = (
  ctx: Ctx,
  selectedNode: ProseMirrorNode,
  options: IMarkdownEditorTextBlockConversionOptions = {},
): ProseMirrorNode => {
  const codeBlockType = codeBlockSchema.type(ctx);
  const plainTextContent = getMarkdownEditorTextBlockContent(
    getMarkdownEditorPlainTextContent(selectedNode),
    options,
  );
  const content = plainTextContent.length > 0 ? codeBlockType.schema.text(plainTextContent) : null;

  return codeBlockType.create(null, content);
};

/**
 * Returns the text used when turning a block into a variable command.
 * @param selectedNode The node being transformed.
 * @returns A new variable token or restored lowercase text when already variable-shaped.
 */
const getMarkdownEditorVariableReplacementText = (selectedNode: ProseMirrorNode): string => {
  const plainTextContent = getMarkdownEditorPlainTextContent(selectedNode).trim();

  if (isMarkdownEditorVariableOnlyText(plainTextContent)) {
    return restoreMarkdownVariableText(plainTextContent);
  }

  return createMarkdownVariableToken(plainTextContent);
};

/**
 * Creates a paragraph containing a variable token derived from the selected block.
 * @param ctx The Milkdown context that owns the active schema.
 * @param selectedNode The node being transformed.
 * @returns A paragraph node containing the variable command result.
 */
const createMarkdownEditorVariableNode = (
  ctx: Ctx,
  selectedNode: ProseMirrorNode,
): ProseMirrorNode => {
  const paragraph = paragraphSchema.type(ctx);

  return paragraph.create(
    null,
    paragraph.schema.text(getMarkdownEditorVariableReplacementText(selectedNode)),
  );
};

/**
 * Creates a blockquote wrapping the selected block node.
 * @param ctx The Milkdown context that owns the active schema.
 * @param selectedNode The node being transformed.
 * @param options The conversion behavior requested by the target option.
 * @returns A blockquote node containing the selected block.
 */
const createMarkdownEditorBlockquoteNode = (
  ctx: Ctx,
  selectedNode: ProseMirrorNode,
  options: IMarkdownEditorTextBlockConversionOptions = {},
): ProseMirrorNode => {
  const shouldRestoreVariables =
    options.shouldRestoreVariables && hasMarkdownEditorVariableTextContent(selectedNode);

  if (shouldRestoreVariables) {
    return blockquoteSchema
      .type(ctx)
      .create(null, createMarkdownEditorParagraphNode(ctx, selectedNode, options));
  }

  const quoteChild = selectedNode.type.isInGroup('block')
    ? selectedNode
    : createMarkdownEditorParagraphNode(ctx, selectedNode);

  return blockquoteSchema.type(ctx).create(null, quoteChild);
};

/**
 * Creates the replacement node requested by a turn-into menu option.
 * @param ctx The Milkdown context that owns the active schema.
 * @param selectedNode The node being transformed.
 * @param option The target markdown block type option.
 * @returns The node that should replace the selected block target.
 */
const createMarkdownEditorTurnIntoReplacementNode = (
  ctx: Ctx,
  selectedNode: ProseMirrorNode,
  option: IMarkdownEditorTurnIntoOption,
): ProseMirrorNode => {
  const conversionOptions = {
    shouldRestoreVariables: option.kind !== 'variable',
  };

  switch (option.kind) {
    case 'paragraph':
      return createMarkdownEditorTextBlockNode(
        paragraphSchema.type(ctx),
        selectedNode,
        null,
        conversionOptions,
      );

    case 'variable':
      return createMarkdownEditorVariableNode(ctx, selectedNode);

    case 'heading-1':
    case 'heading-2':
    case 'heading-3':
      return createMarkdownEditorTextBlockNode(
        headingSchema.type(ctx),
        selectedNode,
        {
          level: option.headingLevel,
        },
        conversionOptions,
      );

    case 'quote':
      return createMarkdownEditorBlockquoteNode(ctx, selectedNode, conversionOptions);

    case 'bullet-list':
      return createMarkdownEditorListNode(ctx, selectedNode, 'bullet', conversionOptions);

    case 'ordered-list':
      return createMarkdownEditorListNode(ctx, selectedNode, 'ordered', conversionOptions);

    case 'code':
      return createMarkdownEditorCodeBlockNode(ctx, selectedNode, conversionOptions);

    case 'table':
      return createTable(
        ctx,
        MARKDOWN_EDITOR_DEFAULT_TABLE_ROW_COUNT,
        MARKDOWN_EDITOR_DEFAULT_TABLE_COLUMN_COUNT,
      );
  }
};

/**
 * Replaces a block action target and moves the cursor near the new block.
 * @param view The active editor view.
 * @param target The selected block target to replace.
 * @param replacementNode The node that should replace the selected target.
 * @returns True when the editor document was transformed.
 */
const replaceMarkdownEditorBlockTarget = (
  view: EditorView,
  target: IMarkdownEditorBlockActionTarget,
  replacementNode: ProseMirrorNode,
): boolean => {
  try {
    let transaction = view.state.tr.replaceWith(target.from, target.to, replacementNode);
    const selectionPosition = Math.min(target.from + 1, transaction.doc.content.size);

    transaction = transaction.setSelection(
      TextSelection.near(transaction.doc.resolve(selectionPosition)),
    );

    view.dispatch(transaction.scrollIntoView());
    view.focus();

    return true;
  } catch {
    return false;
  }
};

/**
 * Changes the selected block target to a supported markdown block type.
 * @param crepe The current Crepe editor instance.
 * @param target The selected block target to transform.
 * @param option The target markdown block type option.
 * @returns True when the editor document was transformed.
 */
export const turnMarkdownEditorBlockInto = (
  crepe: Crepe,
  target: IMarkdownEditorBlockActionTarget,
  option: IMarkdownEditorTurnIntoOption,
): boolean => {
  if (crepe.editor.status !== EditorStatus.Created) {
    return false;
  }

  return crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const selectedNode = view.state.doc.nodeAt(target.from);

    if (!selectedNode) {
      return false;
    }

    const shouldRestoreVariables =
      option.kind !== 'variable' && hasMarkdownEditorVariableTextContent(selectedNode);

    if (
      getMarkdownEditorActiveTurnIntoOptionKind(target) === option.kind &&
      !shouldRestoreVariables
    ) {
      return false;
    }

    return replaceMarkdownEditorBlockTarget(
      view,
      target,
      createMarkdownEditorTurnIntoReplacementNode(ctx, selectedNode, option),
    );
  });
};

/**
 * Deletes the selected block target while keeping the document valid.
 * @param crepe The current Crepe editor instance.
 * @param target The selected block target to remove.
 * @returns True when the editor document was updated.
 */
export const deleteMarkdownEditorBlock = (
  crepe: Crepe,
  target: IMarkdownEditorBlockActionTarget,
): boolean => {
  if (crepe.editor.status !== EditorStatus.Created) {
    return false;
  }

  return crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state } = view;
    const paragraph = paragraphSchema.type(ctx);
    const emptyParagraph = paragraph.create();

    try {
      const isOnlyBlock = target.from <= 0 && target.to >= state.doc.content.size;
      let transaction = isOnlyBlock
        ? state.tr.replaceWith(0, state.doc.content.size, emptyParagraph)
        : state.tr.delete(target.from, target.to);
      const selectionPosition = Math.min(target.from, transaction.doc.content.size);

      transaction = transaction.setSelection(
        TextSelection.near(transaction.doc.resolve(selectionPosition)),
      );

      if (!transaction.docChanged) {
        return false;
      }

      view.dispatch(transaction.scrollIntoView());
      view.focus();

      return true;
    } catch {
      return false;
    }
  });
};
