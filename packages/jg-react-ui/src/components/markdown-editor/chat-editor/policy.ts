import type { Mark, Node as ProseMirrorNode, Schema } from '@milkdown/kit/prose/model';

const CHAT_MARKDOWN_ALLOWED_BLOCKS = new Set([
  'bullet_list',
  'heading',
  'list_item',
  'ordered_list',
  'paragraph',
]);
const CHAT_MARKDOWN_ALLOWED_MARKS = new Set(['emphasis', 'link', 'strong']);

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
    .replace(/([`*_[\]{}()#+\-.!>|])/g, '\\$1')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n/g, '  \n'))
    .join('\n\n');

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
 * Converts a ProseMirror document into the fixed chat Markdown document subset.
 * @param documentNode The parsed or edited ProseMirror document.
 * @returns A policy-compliant document using the same editor schema.
 */
export const normalizeChatMarkdownDocument = (documentNode: ProseMirrorNode): ProseMirrorNode => {
  const { schema } = documentNode.type;
  const normalizedBlocks = normalizeBlockChildren(documentNode, schema);
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
 * @returns True when unsupported content or unsafe attributes are present.
 */
export const doesChatMarkdownDocumentNeedNormalization = (documentNode: ProseMirrorNode): boolean =>
  !documentNode.eq(normalizeChatMarkdownDocument(documentNode));

const normalizeBlockChildren = (parentNode: ProseMirrorNode, schema: Schema): ProseMirrorNode[] => {
  const blocks: ProseMirrorNode[] = [];

  parentNode.forEach((childNode) => {
    for (const block of normalizeBlockNode(childNode, schema)) blocks.push(block);
  });

  return blocks;
};

const normalizeBlockNode = (node: ProseMirrorNode, schema: Schema): ProseMirrorNode[] => {
  const nodeName = node.type.name;

  if (nodeName === 'paragraph') {
    return [schema.nodes['paragraph']!.create(null, normalizeInlineChildren(node, schema))];
  }

  if (nodeName === 'heading') {
    const level =
      typeof node.attrs['level'] === 'number' ? Math.min(Math.max(node.attrs['level'], 1), 3) : 1;

    return [
      schema.nodes['heading']!.create(
        { ...node.attrs, level },
        normalizeInlineChildren(node, schema),
      ),
    ];
  }

  if (nodeName === 'bullet_list' || nodeName === 'ordered_list') {
    const listType = schema.nodes[nodeName];
    const listItems = normalizeListItems(node, schema);

    return listType && listItems.length > 0 ? [listType.create(node.attrs, listItems)] : [];
  }

  if (nodeName === 'html') {
    return [];
  }

  if (CHAT_MARKDOWN_ALLOWED_BLOCKS.has(nodeName)) {
    return normalizeBlockChildren(node, schema);
  }

  return createReadableParagraphs(node, schema);
};

const normalizeListItems = (listNode: ProseMirrorNode, schema: Schema): ProseMirrorNode[] => {
  const listItemType = schema.nodes['list_item'];

  if (!listItemType) {
    return [];
  }

  const normalizedItems: ProseMirrorNode[] = [];

  listNode.forEach((itemNode) => {
    const blocks = normalizeBlockChildren(itemNode, schema);
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

const normalizeInlineChildren = (node: ProseMirrorNode, schema: Schema): ProseMirrorNode[] => {
  const inlineNodes: ProseMirrorNode[] = [];

  node.forEach((childNode) => {
    for (const inlineNode of normalizeInlineNode(childNode, schema)) inlineNodes.push(inlineNode);
  });

  return inlineNodes;
};

const normalizeInlineNode = (node: ProseMirrorNode, schema: Schema): ProseMirrorNode[] => {
  if (node.isText) {
    return [schema.text(node.textContent, normalizeMarks(node.marks))];
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

const normalizeMarks = (marks: readonly Mark[]): Mark[] =>
  marks.flatMap((mark) => {
    if (!CHAT_MARKDOWN_ALLOWED_MARKS.has(mark.type.name)) {
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
