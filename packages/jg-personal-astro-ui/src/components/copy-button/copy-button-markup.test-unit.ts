import { describe, expect, test } from 'vitest';

import { renderCopyButton } from './copy-button-markup.ts';

/**
 * Reads the opening tag of the rendered button.
 * @param html The rendered copy button.
 * @returns The button's opening tag.
 */
const readButtonTag = (html: string): string => /<button[^>]*>/.exec(html)?.[0] ?? '';

describe('renderCopyButton', () => {
  test('renders a button that copies its code window, labelled Copy, on the page surface', () => {
    const html = renderCopyButton();

    expect(readButtonTag(html)).toBe(
      '<button type="button" class="inline-flex min-h-8 items-center gap-1.5 text-xs font-semibold transition-colors rounded-md px-2.5 text-muted hover:bg-secondary hover:text-foreground" data-copy-button data-copy-context="text">',
    );
    expect(html).toContain('<span data-copy-label>Copy</span>');
    expect(html).toContain('<span class="sr-only"> text</span>');
    expect(html).toContain('<span class="sr-only" data-copy-status aria-live="polite"></span>');
    expect(html).toContain('data-copy-hint hidden></span>');
    // the label and the guidance stay out of the search index
    expect(
      html.startsWith(
        '<span class="relative inline-flex shrink-0 items-center" data-pagefind-ignore>',
      ),
    ).toBe(true);
    // the copy, check, and alert icons, each shown in one state
    expect(html.match(/<svg /g)).toHaveLength(3);
  });

  test('copies its own text or an element by id, escaping every value', () => {
    const html = renderCopyButton({
      class: 'ml-auto "x"',
      context: 'npm <install> command',
      label: 'Copy & paste',
      sourceId: 'cmd"1',
      text: 'npm install "a" <b> & c',
      tone: 'terminal',
    });

    expect(readButtonTag(html)).toContain(
      'data-copy-context="npm &lt;install&gt; command" data-copy-source="cmd&quot;1" data-copy-text="npm install &quot;a&quot; &lt;b&gt; &amp; c">',
    );
    expect(readButtonTag(html)).toContain('text-terminal-foreground/80');
    expect(html).toContain('<span data-copy-label>Copy &amp; paste</span>');
    expect(html).toContain('<span class="sr-only"> npm &lt;install&gt; command</span>');
    expect(
      html.startsWith(
        '<span class="relative inline-flex shrink-0 items-center ml-auto &quot;x&quot;" data-pagefind-ignore>',
      ),
    ).toBe(true);
  });

  test('copies the text at a URL, linking to it under the guidance', () => {
    const html = renderCopyButton({
      context: 'as Markdown',
      label: 'Copy page',
      tone: 'outline',
      url: '/packages/a&b/index.md',
    });

    expect(readButtonTag(html)).toContain(
      'rounded-full border border-border-strong px-3 text-foreground hover:bg-secondary',
    );
    expect(readButtonTag(html)).toContain('data-copy-url="/packages/a&amp;b/index.md">');
    expect(html).toContain(
      'data-copy-hint hidden><span data-copy-hint-text></span><a href="/packages/a&amp;b/index.md" class="mt-1.5 block font-semibold underline underline-offset-2 wrap-anywhere">/packages/a&amp;b/index.md</a></span>',
    );
  });
});
