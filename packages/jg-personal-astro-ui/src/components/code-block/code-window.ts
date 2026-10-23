import { escapeHtml } from '../../html/index.ts';
import { renderCopyButton, type ICopyButtonDisplay } from '../copy-button/copy-button-markup.ts';

// what renderCodeWindowHeader needs
export type ICodeWindowHeaderOptions = {
  // the language or a file name, such as 'ts' or 'vite.config.ts'
  caption: string;
  // shows a copy button that copies the window's code. Defaults to true
  copy?: boolean | undefined;
  copyDisplay?: ICopyButtonDisplay | undefined;
  // copies original text or an element's text, named by context in its accessible name
  copySource?:
    { context: string; sourceId: string } | { context: string; text: string } | undefined;
  // lets a long caption, such as a sentence, wrap onto more lines instead of ending in an ellipsis
  wrapCaption?: boolean | undefined;
};

/**
 * Renders a code window's header as HTML: the window dots, the caption, and a copy button. The
 * window is a `figure` with the `jg-code-window` class and a `data-code-window` attribute, holding
 * the header and the highlighted `pre`; contract.css styles it. The header stays out of a Pagefind
 * index, so search excerpts show the code alone.
 * @param options The caption, whether it wraps, and whether to show the copy button.
 * @returns The header's HTML.
 * @example
 * import { renderCodeWindowHeader } from 'jg-personal-astro-ui/code-window';
 *
 * const header = renderCodeWindowHeader({ caption: 'ts' });
 */
export const renderCodeWindowHeader = ({
  caption,
  copy = true,
  copyDisplay,
  copySource,
  wrapCaption = false,
}: ICodeWindowHeaderOptions): string =>
  [
    '<figcaption class="jg-code-window-header" data-pagefind-ignore>',
    '<span class="jg-code-window-dots" aria-hidden="true"><span></span><span></span><span></span></span>',
    `<span class="jg-code-window-caption"${wrapCaption ? ' data-wrap' : ''}>${escapeHtml(caption)}</span>`,
    copy
      ? renderCopyButton({
          context: copySource?.context ?? 'code',
          display: copyDisplay,
          sourceId:
            copySource !== undefined && 'sourceId' in copySource ? copySource.sourceId : undefined,
          text: copySource !== undefined && 'text' in copySource ? copySource.text : undefined,
          tone: 'terminal',
        })
      : '',
    '</figcaption>',
  ].join('');
