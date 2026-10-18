import { escapeHtml } from '../../html/index.ts';
import { renderCopyButton } from '../copy-button/copy-button-markup.ts';

// what renderCodeWindowHeader needs
export type ICodeWindowHeaderOptions = {
  // the language or a file name, such as 'ts' or 'vite.config.ts'
  caption: string;
  // shows a copy button that copies the window's code. Defaults to true
  copy?: boolean | undefined;
  // what the copy button copies instead of the window's code: the element with this id, named by
  // context in its accessible name, such as "command"
  copySource?: { context: string; sourceId: string } | undefined;
};

/**
 * Renders a code window's header as HTML: the window dots, the caption, and a copy button. The
 * window is a `figure` with the `jg-code-window` class and a `data-code-window` attribute, holding
 * the header and the highlighted `pre`; contract.css styles it. The header stays out of a Pagefind
 * index, so search excerpts show the code alone.
 * @param options The caption, and whether to show the copy button.
 * @returns The header's HTML.
 * @example
 * import { renderCodeWindowHeader } from 'jg-personal-astro-ui/code-window';
 *
 * const header = renderCodeWindowHeader({ caption: 'ts' });
 */
export const renderCodeWindowHeader = ({
  caption,
  copy = true,
  copySource,
}: ICodeWindowHeaderOptions): string =>
  [
    '<figcaption class="jg-code-window-header" data-pagefind-ignore>',
    '<span class="jg-code-window-dots" aria-hidden="true"><span></span><span></span><span></span></span>',
    `<span class="jg-code-window-caption">${escapeHtml(caption)}</span>`,
    copy
      ? renderCopyButton({
          context: copySource?.context ?? 'code',
          sourceId: copySource?.sourceId,
          tone: 'terminal',
        })
      : '',
    '</figcaption>',
  ].join('');
