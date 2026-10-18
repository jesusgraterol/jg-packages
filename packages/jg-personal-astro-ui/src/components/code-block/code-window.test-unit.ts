import { describe, expect, test } from 'vitest';

import { renderCodeWindowHeader } from './code-window.ts';

describe('renderCodeWindowHeader', () => {
  test('renders the dots, the caption, and a copy button for the code', () => {
    const html = renderCodeWindowHeader({ caption: 'vite.config.ts' });

    expect(html.startsWith('<figcaption class="jg-code-window-header" data-pagefind-ignore>')).toBe(
      true,
    );
    expect(html).toContain(
      '<span class="jg-code-window-dots" aria-hidden="true"><span></span><span></span><span></span></span>',
    );
    expect(html).toContain('<span class="jg-code-window-caption">vite.config.ts</span>');
    // the button copies its window's code, so it carries no text of its own
    expect(html).toContain('data-copy-button data-copy-context="code">');
    expect(html).toContain('text-terminal-foreground/80');
    expect(html.endsWith('</figcaption>')).toBe(true);
  });

  test('escapes the caption, and leaves the button out when asked', () => {
    const html = renderCodeWindowHeader({ caption: '<script>', copy: false });

    expect(html).toContain('<span class="jg-code-window-caption">&lt;script&gt;</span>');
    expect(html).not.toContain('data-copy-button');
  });

  test('copies an element by its id when given a source, named by its context', () => {
    const html = renderCodeWindowHeader({
      caption: 'Terminal',
      copySource: { context: 'command', sourceId: 'install' },
    });

    expect(html).toContain('data-copy-context="command"');
    expect(html).toContain('data-copy-source="install"');
  });

  test('names the copy button from the context, as an install command does', () => {
    const html = renderCodeWindowHeader({
      caption: 'Terminal',
      copySource: { context: 'install command', sourceId: 'install' },
    });

    expect(html).toContain(
      '<span data-copy-label>Copy</span><span class="sr-only"> install command</span>',
    );
  });

  test('lets a long caption wrap when asked', () => {
    const caption = "Install the skills from your repository's root";

    expect(renderCodeWindowHeader({ caption, wrapCaption: true })).toContain(
      `<span class="jg-code-window-caption" data-wrap>${caption}</span>`,
    );
    expect(renderCodeWindowHeader({ caption })).toContain('<span class="jg-code-window-caption">');
  });
});
