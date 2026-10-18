import { escapeHtml } from '../../html/index.ts';
import { renderCopyButton } from '../copy-button/copy-button-markup.ts';

// what renderCodeWindowHeader needs
export type ICodeWindowHeaderOptions = {
  // the language or a file name, such as 'ts' or 'vite.config.ts'
  caption: string;
  // shows a copy button that copies the window's code. Defaults to true
  copy?: boolean | undefined;
};

/**
 * Renders a code window's header as HTML: the window dots, the caption, and a copy button. The
 * window is a `figure` with the `jg-code-window` class and a `data-code-window` attribute, holding
 * the header and the highlighted `pre`; contract.css styles it.
 * @param options The caption, and whether to show the copy button.
 * @returns The header's HTML.
 */
export const renderCodeWindowHeader = ({
  caption,
  copy = true,
}: ICodeWindowHeaderOptions): string =>
  [
    '<figcaption class="jg-code-window-header">',
    '<span class="jg-code-window-dots" aria-hidden="true"><span></span><span></span><span></span></span>',
    `<span class="jg-code-window-caption">${escapeHtml(caption)}</span>`,
    copy ? renderCopyButton({ context: 'code', tone: 'terminal' }) : '',
    '</figcaption>',
  ].join('');
