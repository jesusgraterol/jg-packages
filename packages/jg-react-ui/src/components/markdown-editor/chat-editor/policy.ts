import type { Mark, Node as ProseMirrorNode, Schema } from '@milkdown/kit/prose/model';

import { CHAT_MARKDOWN_EDITOR_TOOLS } from './constants.js';
import type { IChatMarkdownEditorTool } from './types.js';

// one policy is shared by every descendant in a normalization pass
type IChatToolSet = ReadonlySet<IChatMarkdownEditorTool>;
const CHAT_MARKDOWN_MARK_TOOLS = {
  emphasis: 'italic',
  link: 'link',
  strong: 'bold',
} as const;
const CHAT_MARKDOWN_TABLE_NODES = new Set([
  'table_header_row',
  'table_row',
  'table_header',
  'table_cell',
]);

/**
 * Checks whether a link destination is safe for the shared chat surface.
 * @param href The destination read from a Markdown or pasted HTML link.
 * @returns True for absolute HTTP, HTTPS, and mailto destinations.
 */
export const isChatMarkdownLinkSafe = (href: string): boolean => {
  try {
    const url = new URL(href);

    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:';
  } catch {
    return false;
  }
};

/**
 * Escapes dictated or otherwise literal text before appending it through Markdown parsing.
 * @param text The literal text to preserve.
 * @returns Markdown source that cannot introduce formatting syntax.
 */
export const escapeChatMarkdownLiteralText = (text: string): string =>
  text
    .replace(/\\/g, '\\\\')
    .replace(/([`*_[\]{}()#+\-.!<>|~&])/g, '\\$1')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n/g, '  \n'))
    .join('\n\n');

/**
 * Builds a complete literal append using the editor's paragraph and escaping policy.
 * @param markdown The live or not-yet-mounted controlled draft.
 * @param text The literal text to append.
 * @param maxLength The normal message length limit.
 * @param allowOverLimit Whether to retain oversized text for subsequent editing.
 * @returns The complete source, or null when bounded insertion cannot fit.
 */
export const buildChatMarkdownLiteralAppend = (
  markdown: string,
  text: string,
  maxLength: number,
  allowOverLimit = false,
): string | null => {
  const escapedText = escapeChatMarkdownLiteralText(text.trim());
  if (!escapedText) return markdown;
  const currentMarkdown = markdown.trimEnd();
  const nextMarkdown = currentMarkdown ? currentMarkdown + '\n\n' + escapedText : escapedText;
  return allowOverLimit || measureChatMarkdown(nextMarkdown) <= maxLength ? nextMarkdown : null;
};

/**
 * Checks whether serialized Markdown contains user-visible content.
 * @param markdown The normalized Markdown snapshot.
 * @returns True when text or an attachment-independent readable token remains.
 */
export const isChatMarkdownEmpty = (markdown: string): boolean => {
  const withoutLinks = markdown.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  const withoutSyntax = withoutLinks
    .replace(/^\s{0,3}(?:#{1,6}|[-+*]|\d+[.)])\s*/gm, '')
    .replace(/[\\`*_{}[\]()#+\-.!>|]/g, '')
    .trim();

  return withoutSyntax.length === 0;
};

/**
 * Returns whether a raw Markdown value can enter the parser under the configured limit.
 * @param markdown The untrusted external or pasted Markdown source.
 * @param maxLength The maximum serialized Markdown length.
 * @returns True when parsing the value is within the configured bound.
 */
export const canParseChatMarkdown = (markdown: string, maxLength: number): boolean =>
  markdown.length <= maxLength;

/**
 * Measures a chat message as its limit counts it: its serialized Markdown without the line break
 * the serializer ends every document with, which the message doesn't hold.
 * @param markdown The serialized chat Markdown.
 * @returns The message's length.
 */
export const measureChatMarkdown = (markdown: string): number =>
  markdown.endsWith('\n') ? markdown.length - 1 : markdown.length;

/**
 * Normalizes a document to the selected chat tools without rewriting literal code content.
 * @param documentNode The parsed or edited ProseMirror document.
 * @param supportedTools The enabled chat authoring tools; omitted retains the simple default.
 * @returns A policy-compliant document using the same editor schema.
 */
export const normalizeChatMarkdownDocument = (
  documentNode: ProseMirrorNode,
  supportedTools: ReadonlyArray<IChatMarkdownEditorTool> = CHAT_MARKDOWN_EDITOR_TOOLS,
): ProseMirrorNode => {
  const { schema } = documentNode.type;
  const tools: IChatToolSet = new Set(supportedTools);
  const normalizedBlocks = normalizeBlockChildren(documentNode, schema, tools);
  const paragraphType = schema.nodes['paragraph'];

  if (!paragraphType) {
    return documentNode;
  }

  return schema.topNodeType.create(
    documentNode.attrs,
    normalizedBlocks.length > 0 ? normalizedBlocks : [paragraphType.create()],
  );
};

/**
 * Reports whether normalization changes a ProseMirror document.
 * @param documentNode The document to evaluate.
 * @param supportedTools The enabled chat authoring tools.
 * @returns True when unsupported content or unsafe attributes are present.
 */
export const doesChatMarkdownDocumentNeedNormalization = (
  documentNode: ProseMirrorNode,
  supportedTools?: ReadonlyArray<IChatMarkdownEditorTool>,
): boolean => !documentNode.eq(normalizeChatMarkdownDocument(documentNode, supportedTools));

const normalizeBlockChildren = (
  parentNode: ProseMirrorNode,
  schema: Schema,
  tools: IChatToolSet,
): ProseMirrorNode[] => {
  const blocks: ProseMirrorNode[] = [];

  parentNode.forEach((childNode) => {
    for (const block of normalizeBlockNode(childNode, schema, tools)) blocks.push(block);
  });

  return blocks;
};

const normalizeBlockNode = (
  node: ProseMirrorNode,
  schema: Schema,
  tools: IChatToolSet,
): ProseMirrorNode[] => {
  const nodeName = node.type.name;

  if (nodeName === 'paragraph') {
    return [schema.nodes['paragraph']!.create(null, normalizeInlineChildren(node, schema, tools))];
  }

  if (nodeName === 'heading') {
    if (!tools.has('heading')) {
      return [
        schema.nodes['paragraph']!.create(null, normalizeInlineChildren(node, schema, tools)),
      ];
    }
    const level =
      typeof node.attrs['level'] === 'number' ? Math.min(Math.max(node.attrs['level'], 1), 3) : 1;

    return [
      schema.nodes['heading']!.create(
        { ...node.attrs, level },
        normalizeInlineChildren(node, schema, tools),
      ),
    ];
  }

  if (nodeName === 'bullet_list' || nodeName === 'ordered_list') {
    if (!tools.has(nodeName === 'bullet_list' ? 'bullet-list' : 'ordered-list')) {
      return normalizeBlockChildren(node, schema, tools);
    }
    const listType = schema.nodes[nodeName];
    const listItems = normalizeListItems(node, schema, tools);

    return listType && listItems.length > 0 ? [listType.create(node.attrs, listItems)] : [];
  }

  if (nodeName === 'html') {
    return [];
  }

  if (nodeName === 'code_block' && tools.has('code-block')) {
    return [
      node.type.create(node.attrs, node.textContent ? schema.text(node.textContent) : undefined),
    ];
  }

  if (nodeName === 'table' && tools.has('table')) {
    return [normalizeTableNode(node, schema, tools)];
  }

  if (nodeName === 'list_item') {
    return normalizeBlockChildren(node, schema, tools);
  }

  return createReadableParagraphs(node, schema);
};

const normalizeListItems = (
  listNode: ProseMirrorNode,
  schema: Schema,
  tools: IChatToolSet,
): ProseMirrorNode[] => {
  const listItemType = schema.nodes['list_item'];

  if (!listItemType) {
    return [];
  }

  const normalizedItems: ProseMirrorNode[] = [];

  listNode.forEach((itemNode) => {
    const blocks = normalizeBlockChildren(itemNode, schema, tools);
    const paragraphType = schema.nodes['paragraph'];
    const taskMarker =
      typeof itemNode.attrs['checked'] === 'boolean'
        ? `[${itemNode.attrs['checked'] ? 'x' : ' '}] `
        : '';

    if (taskMarker && paragraphType) {
      const firstBlock = blocks[0];

      if (firstBlock?.type === paragraphType) {
        blocks[0] = paragraphType.create(null, [
          schema.text(taskMarker),
          ...firstBlock.content.content,
        ]);
      } else {
        blocks.unshift(paragraphType.create(null, schema.text(taskMarker)));
      }
    }

    normalizedItems.push(
      listItemType.create(
        Object.fromEntries(
          Object.keys(listItemType.spec.attrs ?? {}).map((key) => [
            key,
            key === 'checked' ? null : itemNode.attrs[key],
          ]),
        ),
        blocks.length > 0 ? blocks : paragraphType?.create(),
      ),
    );
  });

  return normalizedItems;
};

/** Keeps table structure and layout attributes while normalizing each cell's authored content. */
const normalizeTableNode = (
  node: ProseMirrorNode,
  schema: Schema,
  tools: IChatToolSet,
): ProseMirrorNode => {
  if (node.inlineContent) {
    return node.type.create(node.attrs, normalizeInlineChildren(node, schema, tools));
  }

  const children: ProseMirrorNode[] = [];
  node.forEach((child) => {
    if (CHAT_MARKDOWN_TABLE_NODES.has(child.type.name)) {
      children.push(normalizeTableNode(child, schema, tools));
      return;
    }
    for (const block of normalizeBlockNode(child, schema, tools)) children.push(block);
  });
  return node.type.create(node.attrs, children);
};

const normalizeInlineChildren = (
  node: ProseMirrorNode,
  schema: Schema,
  tools: IChatToolSet,
): ProseMirrorNode[] => {
  const inlineNodes: ProseMirrorNode[] = [];

  node.forEach((childNode) => {
    for (const inlineNode of normalizeInlineNode(childNode, schema, tools))
      inlineNodes.push(inlineNode);
  });

  return inlineNodes;
};

const normalizeInlineNode = (
  node: ProseMirrorNode,
  schema: Schema,
  tools: IChatToolSet,
): ProseMirrorNode[] => {
  if (node.isText) {
    return [schema.text(node.textContent, normalizeMarks(node.marks, tools))];
  }

  if (node.type.name === 'hardbreak' && schema.nodes['hardbreak']) {
    return [schema.nodes['hardbreak'].create()];
  }

  if (node.type.name === 'image') {
    const alt = typeof node.attrs['alt'] === 'string' ? node.attrs['alt'].trim() : '';

    return alt ? [schema.text(alt)] : [];
  }

  const readableText = extractReadableText(node);

  return readableText ? [schema.text(readableText)] : [];
};

const normalizeMarks = (marks: readonly Mark[], tools: IChatToolSet): Mark[] =>
  marks.flatMap((mark) => {
    if (mark.type.spec.code === true) {
      return tools.has('inline-code') ? [mark.type.create(mark.attrs)] : [];
    }

    const tool = CHAT_MARKDOWN_MARK_TOOLS[mark.type.name as keyof typeof CHAT_MARKDOWN_MARK_TOOLS];
    if (!tool || !tools.has(tool)) {
      return [];
    }

    if (mark.type.name === 'link') {
      const href: unknown = mark.attrs['href'];
      const title: unknown = mark.attrs['title'];

      if (typeof href !== 'string' || !isChatMarkdownLinkSafe(href)) {
        return [];
      }

      return [mark.type.create({ href, title: typeof title === 'string' ? title : null })];
    }

    return [mark.type.create(mark.attrs)];
  });

const createReadableParagraphs = (node: ProseMirrorNode, schema: Schema): ProseMirrorNode[] => {
  const paragraphType = schema.nodes['paragraph'];

  if (!paragraphType) {
    return [];
  }

  const readableLines = extractReadableText(node)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return readableLines.map((line) => paragraphType.create(null, schema.text(line)));
};

const extractReadableText = (node: ProseMirrorNode): string => {
  if (node.isText) {
    return node.textContent;
  }

  if (node.type.name === 'image') {
    return typeof node.attrs['alt'] === 'string' ? node.attrs['alt'] : '';
  }

  if (node.type.name === 'html') {
    return '';
  }

  const parts: string[] = [];

  node.forEach((childNode) => {
    const text = extractReadableText(childNode);

    if (text) {
      parts.push(text);
    }
  });

  return parts.join(node.inlineContent ? '' : '\n');
};
