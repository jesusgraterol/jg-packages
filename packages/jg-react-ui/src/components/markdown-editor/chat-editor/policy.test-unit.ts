import { describe, expect, test } from 'vitest';
import { Schema } from '@milkdown/kit/prose/model';

import {
  canParseChatMarkdown,
  escapeChatMarkdownLiteralText,
  isChatMarkdownEmpty,
  isChatMarkdownLinkSafe,
  normalizeChatMarkdownDocument,
} from './policy.js';

describe('chat Markdown policy', () => {
  test('flattens a large unsupported block without exhausting the JavaScript argument limit', () => {
    const schema = new Schema({
      nodes: {
        doc: { content: 'block*' },
        text: { group: 'inline' },
        paragraph: { content: 'inline*', group: 'block' },
        blockquote: { content: 'block*', group: 'block' },
      },
    });
    const paragraphs = Array.from({ length: 131_072 }, () =>
      schema.node('paragraph', null, schema.text('Line')),
    );
    const source = schema.node('doc', null, schema.node('blockquote', null, paragraphs));
    const normalized = normalizeChatMarkdownDocument(source);
    expect(normalized.childCount).toBe(131_072);
    expect(normalized.firstChild?.textContent).toBe('Line');
    expect(normalized.lastChild?.textContent).toBe('Line');
    normalized.check();
  });

  test('preserves task state, readable unknown inline nodes, and safe link titles while removing hidden HTML', () => {
    const schema = new Schema({
      nodes: {
        doc: { content: 'block*' },
        text: { group: 'inline' },
        paragraph: { content: 'inline*', group: 'block' },
        heading: { attrs: { level: { default: 1 } }, content: 'inline*', group: 'block' },
        bullet_list: { content: 'list_item*', group: 'block' },
        list_item: { attrs: { checked: { default: null } }, content: 'block*' },
        mention: { content: 'text*', inline: true, group: 'inline' },
        image: { attrs: { alt: { default: null } }, inline: true, group: 'inline' },
        html: { content: 'text*', group: 'block' },
      },
      marks: { link: { attrs: { href: {}, title: { default: null } } } },
    });
    const source = schema.node('doc', null, [
      schema.node(
        'bullet_list',
        null,
        schema.node(
          'list_item',
          { checked: true },
          schema.node('heading', { level: 8 }, schema.text('Task')),
        ),
      ),
      schema.node('paragraph', null, [
        schema.node('mention', null, schema.text('Reader')),
        schema.node('mention'),
        schema.node('image', { alt: 'Alternative' }),
        schema.node('image', { alt: 42 }),
        schema.text('Safe', [schema.mark('link', { href: 'https://example.com', title: 42 })]),
        schema.text('Unsafe', [schema.mark('link', { href: 42 })]),
      ]),
      schema.node('html', null, schema.text('Hidden script')),
    ]);
    const normalized = normalizeChatMarkdownDocument(source);
    expect(normalized.childCount).toBe(2);
    expect(normalized.firstChild?.firstChild?.firstChild?.textContent).toBe('[x] ');
    expect(normalized.firstChild?.firstChild?.lastChild?.attrs['level']).toBe(3);
    expect(normalized.lastChild?.textContent).toBe('ReaderAlternativeSafeUnsafe');
    expect(normalized.lastChild?.child(1).marks[0]?.attrs['title']).toBeNull();
    expect(normalized.lastChild?.lastChild?.marks).toStrictEqual([]);
    normalized.check();
  });

  test('a foreign list without list-item support is discarded rather than producing invalid content', () => {
    const schema = new Schema({
      nodes: {
        doc: { content: 'block*' },
        text: { group: 'inline' },
        paragraph: { content: 'inline*', group: 'block' },
        bullet_list: { content: 'paragraph*', group: 'block' },
      },
    });
    const source = schema.node(
      'doc',
      null,
      schema.node(
        'bullet_list',
        null,
        schema.node('paragraph', null, schema.text('Unsupported list')),
      ),
    );
    const normalized = normalizeChatMarkdownDocument(source);
    expect(normalized.childCount).toBe(1);
    expect(normalized.firstChild?.type.name).toBe('paragraph');
    expect(normalized.textContent).toBe('');
    normalized.check();
  });

  test('unknown block containers expose image alternatives and never expose HTML contents', () => {
    const schema = new Schema({
      nodes: {
        doc: { content: 'block*' },
        text: { group: 'inline' },
        paragraph: { content: 'inline*', group: 'block' },
        container: { content: 'block*', group: 'block' },
        image: { attrs: { alt: { default: null } }, group: 'block' },
        html: { content: 'text*', group: 'block' },
      },
    });
    const source = schema.node(
      'doc',
      null,
      schema.node('container', null, [
        schema.node('image', { alt: 'Readable alternative' }),
        schema.node('image'),
        schema.node('html', null, schema.text('Hidden script')),
      ]),
    );
    const normalized = normalizeChatMarkdownDocument(source);
    expect(normalized.textContent).toBe('Readable alternative');
    normalized.check();
  });

  test('stray list items flatten to paragraphs and hard breaks remain inline boundaries', () => {
    const schema = new Schema({
      nodes: {
        doc: { content: 'block*' },
        text: { group: 'inline' },
        paragraph: { content: 'inline*', group: 'block' },
        list_item: { content: 'paragraph*', group: 'block' },
        hardbreak: { inline: true, group: 'inline' },
      },
    });
    const paragraph = schema.node('paragraph', null, [
      schema.text('First'),
      schema.node('hardbreak'),
      schema.text('Second'),
    ]);
    const normalized = normalizeChatMarkdownDocument(
      schema.node('doc', null, schema.node('list_item', null, paragraph)),
    );
    expect(normalized.childCount).toBe(1);
    expect(normalized.firstChild?.child(1).type.name).toBe('hardbreak');
    expect(normalized.textContent).toBe('FirstSecond');
    normalized.check();
  });

  test('foreign heading attributes, empty lists and safe link titles normalize into valid chat content', () => {
    const schema = new Schema({
      nodes: {
        doc: { content: 'block*' },
        text: { group: 'inline' },
        paragraph: { content: 'inline*', group: 'block' },
        heading: { attrs: { level: { default: 1 } }, content: 'inline*', group: 'block' },
        bullet_list: { content: 'list_item*', group: 'block' },
        list_item: { content: 'paragraph*' },
      },
      marks: { link: { attrs: { href: {}, title: { default: null } } }, strong: {} },
    });
    const source = schema.node('doc', null, [
      schema.node('heading', { level: 'invalid' }, schema.text('Title')),
      schema.node('bullet_list', null, schema.node('list_item')),
      schema.node(
        'paragraph',
        null,
        schema.text('Link', [
          schema.mark('link', { href: 'https://example.com', title: 'Caption' }),
          schema.mark('strong'),
        ]),
      ),
    ]);
    const normalized = normalizeChatMarkdownDocument(source);
    expect(normalized.firstChild?.attrs['level']).toBe(1);
    expect(normalized.child(1).firstChild?.firstChild?.type.name).toBe('paragraph');
    expect(normalized.lastChild?.firstChild?.marks.map((mark) => mark.type.name)).toStrictEqual([
      'link',
      'strong',
    ]);
    expect(normalized.lastChild?.firstChild?.marks[0]?.attrs['title']).toBe('Caption');
    normalized.check();
  });

  test('retains an unfamiliar schema unchanged when it has no paragraph type', () => {
    const schema = new Schema({
      nodes: {
        doc: { content: 'text*' },
        text: {},
      },
    });
    const source = schema.node('doc', null, schema.text('Readable'));
    expect(normalizeChatMarkdownDocument(source)).toBe(source);
  });
  test.each([
    ['https://example.com/help', true],
    ['http://example.com/help', true],
    ['mailto:support@example.com', true],
    ['/relative', false],
    ['javascript:alert(1)', false],
    ['data:text/html,test', false],
  ])('isChatMarkdownLinkSafe(%s) -> %s', (href, expectedResult) => {
    expect(isChatMarkdownLinkSafe(href)).toBe(expectedResult);
  });

  test.each([
    ['', true],
    ['### ', true],
    ['- **__**', true],
    ['[Support](https://example.com)', false],
    ['- Review this', false],
  ])('isChatMarkdownEmpty(%s) -> %s', (markdown, expectedResult) => {
    expect(isChatMarkdownEmpty(markdown)).toBe(expectedResult);
  });

  test('escapes literal inserted text without collapsing paragraph boundaries', () => {
    expect(
      escapeChatMarkdownLiteralText('# Heading\n**bold**\n\n[link](https://example.com)'),
    ).toBe('\\# Heading  \n\\*\\*bold\\*\\*\n\n\\[link\\]\\(https://example\\.com\\)');
  });

  test('rejects oversized raw content before parsing', () => {
    expect(canParseChatMarkdown('1234', 4)).toBe(true);
    expect(canParseChatMarkdown('12345', 4)).toBe(false);
  });
});
