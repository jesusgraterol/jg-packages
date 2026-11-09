import {
  Fragment,
  Slice,
  type Mark,
  type Node as ProseMirrorNode,
  type Schema,
} from '@milkdown/kit/prose/model';

import { normalizeChatMarkdownDocument } from './policy.js';
import type { IChatMarkdownEditorTool, IPreparedChatMarkdownPaste } from './types.js';

/**
 * Creates literal inline content without parsing markup or losing line boundaries.
 * @param schema The current editor schema.
 * @param text The clipboard source to retain.
 * @returns Text and hard-break nodes in source order.
 */
const createLiteralInlineContent = (
  schema: Schema,
  text: string,
  marks?: ReadonlyArray<Mark>,
): ProseMirrorNode[] => {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const content: ProseMirrorNode[] = [];
  for (const [index, line] of lines.entries()) {
    if (index > 0 && schema.nodes['hardbreak']) content.push(schema.nodes['hardbreak'].create());
    if (line) content.push(schema.text(line, marks));
  }
  return content;
};

/**
 * Retains clipboard text literally when richer parsing cannot preserve it safely.
 * @param schema The current editor schema.
 * @param text The bounded source.
 * @param marks Active code-context marks retained during literal insertion.
 * @returns A document with the source's paragraphs and line breaks.
 * @example
 * const document = createLiteralChatMarkdownPaste(schema, '<tag>literal</tag>');
 */
export const createLiteralChatMarkdownPaste = (
  schema: Schema,
  text: string,
  marks?: ReadonlyArray<Mark>,
): ProseMirrorNode =>
  schema.topNodeType.create(
    null,
    text
      .replace(/\r\n?/g, '\n')
      .split(/\n{2}/)
      .map((paragraph) =>
        schema.nodes['paragraph']!.create(
          null,
          createLiteralInlineContent(schema, paragraph, marks),
        ),
      ),
  );

/**
 * Wraps bare inline clipboard runs so normalization sees a valid block document.
 * @param schema The current editor schema.
 * @param content The parsed clipboard fragment.
 * @returns A document preserving inline marks and block order.
 */
export const createChatMarkdownPasteDocument = (
  schema: Schema,
  content: Fragment,
): ProseMirrorNode => {
  const blocks: ProseMirrorNode[] = [];
  let inline: ProseMirrorNode[] = [];
  const flushInline = () => {
    if (inline.length === 0) return;
    blocks.push(schema.nodes['paragraph']!.create(null, inline));
    inline = [];
  };
  content.forEach((node) => {
    if (node.isInline) inline.push(node);
    else {
      flushInline();
      blocks.push(node);
    }
  });
  flushInline();
  return schema.topNodeType.create(null, blocks);
};

/**
 * Repairs raw HTML before ordinary chat normalization can discard part of a paste.
 * @param document The parsed incoming document, never the existing draft.
 * @param tools The current chat tool policy.
 * @returns The normalized document and whether readable content was lost.
 * @example
 * const prepared = prepareChatMarkdownPaste(parsedDocument, ['text', 'link']);
 */
export const prepareChatMarkdownPaste = (
  document: ProseMirrorNode,
  tools?: ReadonlyArray<IChatMarkdownEditorTool>,
): IPreparedChatMarkdownPaste => {
  const repaired = new Map<ProseMirrorNode, ProseMirrorNode[]>();
  const stack = [{ node: document, visited: false }];
  let wasRepaired = false;
  while (stack.length > 0) {
    const entry = stack.pop()!;
    const { node } = entry;
    if (node.type.name === 'html') {
      const source =
        typeof node.attrs['value'] === 'string' ? node.attrs['value'] : node.textContent;
      repaired.set(
        node,
        node.isInline
          ? createLiteralInlineContent(document.type.schema, source)
          : [
              document.type.schema.nodes['paragraph']!.create(
                null,
                createLiteralInlineContent(document.type.schema, source),
              ),
            ],
      );
      wasRepaired = true;
      continue;
    }
    if (!entry.visited && node.childCount > 0) {
      stack.push({ node, visited: true });
      for (let index = node.childCount - 1; index >= 0; index -= 1)
        stack.push({ node: node.child(index), visited: false });
      continue;
    }
    if (node.isLeaf) {
      repaired.set(node, [node]);
      continue;
    }
    const children: ProseMirrorNode[] = [];
    node.forEach((child) => {
      for (const replacement of repaired.get(child)!) children.push(replacement);
    });
    repaired.set(node, [node.copy(Fragment.fromArray(children))]);
  }
  const repairedDocument = repaired.get(document)![0]!;
  const normalized = normalizeChatMarkdownDocument(repairedDocument, tools);
  return {
    document: normalized,
    wasSimplified: wasRepaired || !normalized.eq(repairedDocument),
    hasLostContent: !isChatPasteTextRetained(repairedDocument.textContent, normalized.textContent),
  };
};

/**
 * Checks source text in order while allowing formatting to add markers or change whitespace.
 * @param expected The readable source before reduction.
 * @param actual The readable candidate after reduction.
 * @returns True when every non-whitespace source character remains in order.
 * @example
 * isChatPasteTextRetained('First Second', 'First\nSecond');
 */
export const isChatPasteTextRetained = (expected: string, actual: string): boolean => {
  const source = expected.replace(/\s/gu, '');
  const candidate = actual.replace(/\s/gu, '');
  let matched = 0;
  for (let index = 0; index < candidate.length; index += 1)
    if (candidate[index] === source[matched]) matched += 1;
  return matched === source.length;
};

/**
 * Reads inert rich-source text so content already lost by schema parsing stays observable.
 * @param ownerDocument The editor's document.
 * @param html Bounded clipboard HTML.
 * @returns Readable descendants and image alternatives, without script/style content.
 * @example
 * const expected = readChatPasteHtmlText(document, '<custom>Title</custom>');
 */
export const readChatPasteHtmlText = (ownerDocument: Document, html: string): string => {
  const template = ownerDocument.createElement('template');
  template.innerHTML = html;
  const pending: Array<Node | string> = [template.content];
  const text: string[] = [];
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (typeof node === 'string') {
      text.push(node);
      continue;
    }
    if (node.nodeType === 3) {
      text.push(node.textContent ?? '');
      continue;
    }
    if (node.nodeType === 1) {
      const element = node as Element;
      if (['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT'].includes(element.tagName)) continue;
      if (element.tagName === 'IMG') {
        text.push(element.getAttribute('alt') ?? '');
        continue;
      }
      if (element.tagName === 'BR') {
        text.push('\n');
        continue;
      }
      if (/^(?:P|DIV|H[1-6]|LI|TR|BLOCKQUOTE|PRE|SECTION|ARTICLE|IFRAME)$/u.test(element.tagName)) {
        text.push('\n');
        pending.push('\n');
      }
    }
    for (let index = node.childNodes.length - 1; index >= 0; index -= 1)
      pending.push(node.childNodes[index]!);
  }
  return text.join('').replace(/^\n+|\n+$/gu, '');
};

/**
 * Opens paragraph edges for caret insertion while retaining code/table block boundaries.
 * @param document The repaired normalized paste.
 * @param plainSource Original plain source when Markdown parsing may trim edge spaces.
 * @returns The incoming slice suitable for one selection replacement.
 * @example
 * const slice = createChatMarkdownPasteSlice(prepared.document, 'hello ');
 */
export const createChatMarkdownPasteSlice = (
  document: ProseMirrorNode,
  plainSource?: string,
): Slice => {
  let content = document.content;
  if (
    plainSource !== undefined &&
    !/[\r\n]/u.test(plainSource) &&
    document.childCount === 1 &&
    document.firstChild?.type.name === 'paragraph'
  ) {
    const paragraph = document.firstChild;
    const leading = /^[\t ]+/u.exec(plainSource)?.[0] ?? '';
    const trailing = /[\t ]+$/u.exec(plainSource)?.[0] ?? '';
    const nodes = [...paragraph.content.content];
    if (leading && !paragraph.textContent.startsWith(leading))
      nodes.unshift(document.type.schema.text(leading));
    if (trailing && !paragraph.textContent.endsWith(trailing))
      nodes.push(document.type.schema.text(trailing));
    content = Fragment.from(paragraph.copy(Fragment.fromArray(nodes)));
  }
  return new Slice(
    content,
    content.firstChild?.type.name === 'paragraph' ? 1 : 0,
    content.lastChild?.type.name === 'paragraph' ? 1 : 0,
  );
};
