import { Fragment, Schema } from '@milkdown/kit/prose/model';
import { EditorState, TextSelection } from '@milkdown/kit/prose/state';
import { describe, expect, test } from 'vitest';

import {
  createChatMarkdownPasteDocument,
  createChatMarkdownPasteSlice,
  createLiteralChatMarkdownPaste,
  isChatPasteTextRetained,
  prepareChatMarkdownPaste,
} from './paste.js';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block' },
    text: { group: 'inline' },
    hardbreak: { inline: true, group: 'inline' },
    html: { inline: true, group: 'inline', atom: true, attrs: { value: {} } },
    code_block: { content: 'text*', group: 'block', code: true },
  },
  marks: { link: { attrs: { href: {}, title: { default: null } } } },
});

describe('chat paste transformations', () => {
  test('wraps bare marked inline runs without flattening marks or changing block order', () => {
    const link = schema.text('Link', [schema.mark('link', { href: 'https://example.com' })]);
    const source = createChatMarkdownPasteDocument(
      schema,
      Fragment.fromArray([link, schema.node('paragraph', null, schema.text('Middle')), link]),
    );
    const prepared = prepareChatMarkdownPaste(source);
    expect(prepared.document.childCount).toBe(3);
    expect(prepared.document.child(0).firstChild?.marks).toStrictEqual(link.marks);
    expect(prepared.document.child(1).textContent).toBe('Middle');
    expect(prepared.document.child(2).firstChild?.marks).toStrictEqual(link.marks);
    prepared.document.check();
  });
  test('repairs HTML surrounded by retained paragraphs without mutating the parsed document', () => {
    const source = schema.node('doc', null, [
      schema.node('paragraph', null, schema.text('Before')),
      schema.node('paragraph', null, schema.node('html', { value: '<div>Keep this text</div>' })),
      schema.node('paragraph', null, schema.text('After')),
    ]);
    const original: unknown = source.toJSON();
    const prepared = prepareChatMarkdownPaste(source);
    expect(prepared.document.textContent).toBe('Before<div>Keep this text</div>After');
    expect(prepared.wasSimplified).toBe(true);
    expect(prepared.hasLostContent).toBe(false);
    expect(source.toJSON()).toStrictEqual(original);
    prepared.document.check();
  });

  test('literal recovery preserves source, Unicode, CRLF and intentional paragraph boundaries', () => {
    const source = createLiteralChatMarkdownPaste(schema, 'α😀\r\n<tag>\r\n\r\n日本語');
    expect(source.childCount).toBe(2);
    expect(source.firstChild?.textBetween(0, source.firstChild.content.size, '', '\n')).toBe(
      'α😀\n<tag>',
    );
    expect(source.lastChild?.textContent).toBe('日本語');
    expect(source.firstChild?.child(2).isText).toBe(true);
    source.check();
  });

  test.each([
    [1, 'pastedHello world'],
    [7, 'Hello pastedworld'],
    [12, 'Hello worldpasted'],
  ])(
    'paragraph insertion at position %d preserves the surrounding paragraph',
    (position, expected) => {
      const document = createLiteralChatMarkdownPaste(schema, 'Hello world');
      const state = EditorState.create({
        doc: document,
        selection: TextSelection.create(document, position),
      });
      const incoming = createChatMarkdownPasteSlice(
        createLiteralChatMarkdownPaste(schema, 'pasted'),
      );
      const next = state.tr.replaceSelection(incoming).doc;
      expect(next.childCount).toBe(1);
      expect(next.textContent).toBe(expected);
    },
  );

  test('replacement keeps source edge spaces and leaves code blocks closed', () => {
    const document = createLiteralChatMarkdownPaste(schema, 'Hello world');
    const state = EditorState.create({
      doc: document,
      selection: TextSelection.create(document, 7, 12),
    });
    const incoming = createChatMarkdownPasteSlice(
      createLiteralChatMarkdownPaste(schema, 'new'),
      ' new ',
    );
    expect(state.tr.replaceSelection(incoming).doc.textContent).toBe('Hello  new ');
    const code = schema.node('doc', null, schema.node('code_block', null, schema.text('literal')));
    const codeSlice = createChatMarkdownPasteSlice(code);
    expect([codeSlice.openStart, codeSlice.openEnd]).toStrictEqual([0, 0]);
  });

  test('retains safe links while removing unsafe navigation from repaired source', () => {
    const source = schema.node(
      'doc',
      null,
      schema.node('paragraph', null, [
        schema.text('Safe', [
          schema.mark('link', { href: 'https://example.com', title: 'Caption' }),
        ]),
        schema.text('Unsafe', [schema.mark('link', { href: 'javascript:alert(1)' })]),
      ]),
    );
    const prepared = prepareChatMarkdownPaste(source, ['text', 'link']);
    expect(prepared.document.firstChild?.firstChild?.marks[0]?.attrs['href']).toBe(
      'https://example.com',
    );
    expect(prepared.document.lastChild?.lastChild?.marks).toStrictEqual([]);
    expect(prepared.document.textContent).toBe('SafeUnsafe');
    expect(prepared.hasLostContent).toBe(false);
  });

  test.each([
    ['α😀 日本語', 'α😀\n日本語', true],
    ['Before Keep After', 'BeforeAfter', false],
    ['one one', 'one', false],
    ['FirstSecond', '[x] FirstSecond', true],
    ['BeforeAfter', 'AfterBefore', false],
  ])('readable source %s survives %s -> %s', (expected, actual, retained) => {
    expect(isChatPasteTextRetained(expected, actual)).toBe(retained);
  });

  test('normalizes a representative maximum-sized flat paste without expanding its content', () => {
    const text = 'x'.repeat(16_384);
    const source = createLiteralChatMarkdownPaste(schema, text);
    const prepared = prepareChatMarkdownPaste(source);
    expect(prepared.document.textContent).toBe(text);
    expect(prepared.wasSimplified).toBe(false);
  });
});
