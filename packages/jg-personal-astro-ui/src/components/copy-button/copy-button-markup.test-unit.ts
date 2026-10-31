import { describe, expect, test } from 'vitest';

import { COPY_OUTCOME_LABELS, renderCopyButton } from './copy-button-markup.ts';

/**
 * Reads the opening tag of the rendered button.
 * @param html The rendered copy button.
 * @returns The button's opening tag.
 */
const readButtonTag = (html: string): string => /<button[^>]*>/.exec(html)?.[0] ?? '';

describe('renderCopyButton', () => {
  test('preserves carriage returns in literal source attributes', () => {
    expect(renderCopyButton({ text: 'first\r\nsecond\n' })).toContain(
      'data-copy-text="first&#13;\nsecond\n"',
    );
  });
  test(
    'renders a button that copies its code window, labelled Copy, on the page surface',
    { tags: ['full'] },
    () => {
      const html = renderCopyButton();

      expect(readButtonTag(html)).toBe(
        '<button type="button" inert class="invisible inline-flex min-h-8 items-center gap-1.5 text-xs font-semibold transition-colors rounded-md px-2.5 text-muted hover:bg-secondary hover:text-foreground" data-copy-button data-copy-context="text">',
      );
      expect(html).toContain('<span class="col-start-1 row-start-1" data-copy-label>Copy</span>');
      expect(html).toContain('<span class="sr-only"> text</span>');
      expect(html).toContain(
        '<span class="sr-only" data-copy-status role="status" aria-live="polite" aria-atomic="true"></span>',
      );
      expect(html).toContain('data-copy-hint hidden></span>');
      // the label and the guidance stay out of the search index
      expect(
        html.startsWith(
          '<span class="relative inline-flex shrink-0 items-center" data-pagefind-ignore>',
        ),
      ).toBe(true);
      // the copy, check, and alert icons, each shown in one state
      expect(html.match(/<svg /g)).toHaveLength(3);
    },
  );

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
    expect(html).toContain(
      '<span class="col-start-1 row-start-1" data-copy-label>Copy &amp; paste</span>',
    );
    expect(html).toContain('<span class="sr-only"> npm &lt;install&gt; command</span>');
    expect(
      html.startsWith(
        '<span class="relative inline-flex shrink-0 items-center ml-auto &quot;x&quot;" data-pagefind-ignore>',
      ),
    ).toBe(true);
  });

  test(
    'makes room for each outcome label in the label cell, so a longer one never widens it',
    { tags: ['full'] },
    () => {
      const cell = /<span class="(grid [^"]*)"><span[^>]*data-copy-label>/u.exec(
        renderCopyButton(),
      )?.[1];

      // invisible pseudo-elements in the label's grid cell, holding the labels copy-behavior shows
      expect(cell).toContain(
        `before:content-['${COPY_OUTCOME_LABELS.success.replaceAll(' ', '_')}']`,
      );
      expect(cell).toContain(`after:content-['${COPY_OUTCOME_LABELS.error.replaceAll(' ', '_')}']`);
      for (const pseudo of ['before', 'after']) {
        for (const utility of ['invisible', 'col-start-1', 'row-start-1']) {
          expect(cell).toContain(`${pseudo}:${utility}`);
        }
      }
    },
  );

  test.each([
    ['sm', 'min-h-8 items-center gap-1.5 text-xs'],
    ['md', 'min-h-11 items-center gap-2 text-sm'],
  ] as const)('renders the %s size', { tags: ['full'] }, (size, classes) => {
    expect(readButtonTag(renderCopyButton({ size }))).toContain(
      `class="invisible inline-flex ${classes} `,
    );
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
  test.each(['sm', 'md'] as const)(
    'renders %s icon controls with an accessible label and stable width',
    { tags: ['full'] },
    (size) => {
      const html = renderCopyButton({
        display: 'icon',
        size,
        context: 'Unicode example',
        label: 'Copy source',
      });
      expect(readButtonTag(html)).toContain(' inert ');
      expect(readButtonTag(html)).toContain('data-copy-display="icon"');
      expect(readButtonTag(html)).toContain(size === 'sm' ? ' w-8 ' : ' w-11 ');
      expect(html).toContain(
        '<span class="sr-only"><span class="col-start-1 row-start-1" data-copy-label>Copy source</span></span>',
      );
      expect(html).toContain('<span class="sr-only"> Unicode example</span>');
      expect(readButtonTag(html)).toContain('pointer-coarse:min-h-11 pointer-coarse:min-w-11');
    },
  );
});
