import { escapeHtml } from '../../html/index.ts';

// the copy button's look: 'surface' on the page's surfaces, 'terminal' on dark terminal panels, and
// 'outline', a bordered pill for a button that stands on its own, such as a page's copy button
export type ICopyButtonTone = 'outline' | 'surface' | 'terminal';

// the copy button's height and text: 'sm', compact, as in a code window's header, or 'md', as tall
// as a default-sized button beside it
export type ICopyButtonSize = 'md' | 'sm';

// visible label or a compact icon with the same accessible name and outcome feedback
export type ICopyButtonDisplay = 'icon' | 'label';

// the height, gap, and text of each size
const SIZE_CLASSES: Record<ICopyButtonSize, string> = {
  sm: 'min-h-8 items-center gap-1.5 text-xs',
  md: 'min-h-11 items-center gap-2 text-sm',
};

// what renderCopyButton needs
export type ICopyButtonOptions = {
  class?: string | undefined;
  // what the button copies, added to its accessible name and its guidance, such as "install command"
  context?: string | undefined;
  display?: ICopyButtonDisplay | undefined;
  label?: string | undefined;
  // defaults to 'sm'
  size?: ICopyButtonSize | undefined;
  // copies the text of the element with this id
  sourceId?: string | undefined;
  // the text to copy. Without it, url, or sourceId, the button copies the code of its code window
  text?: string | undefined;
  tone?: ICopyButtonTone | undefined;
  // copies the text at this URL, fetched on click, such as a page's Markdown version. When the copy
  // fails, the guidance links to it
  url?: string | undefined;
};

// the classes of each tone
const TONE_CLASSES: Record<ICopyButtonTone, string> = {
  outline: 'rounded-full border border-border-strong px-3 text-foreground hover:bg-secondary',
  surface: 'rounded-md px-2.5 text-muted hover:bg-secondary hover:text-foreground',
  terminal:
    'rounded-md px-2.5 text-terminal-foreground/80 hover:bg-terminal-foreground/10 hover:text-terminal-foreground focus-visible:outline-terminal-accent',
};

// the labels a button shows after a copy, which LABEL_CELL_CLASSES makes room for
export const COPY_OUTCOME_LABELS = { error: 'Copy failed', success: 'Copied' } as const;

// holds the label in a grid cell that also stacks the outcome labels, invisible, so the button is
// as wide as the longest label it shows from the start, and a longer one, such as "Copied" after
// "Copy", never widens it. The outcome labels match the ones copy-behavior shows
const LABEL_CELL_CLASSES =
  "grid justify-items-center before:invisible before:col-start-1 before:row-start-1 before:content-['Copied'] after:invisible after:col-start-1 after:row-start-1 after:content-['Copy_failed']";

// the icons' shared attributes, as Lucide draws them
const ICON_ATTRIBUTES =
  'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

// Lucide's copy, check, and triangle-alert icons (ISC License), each shown in one state
const ICONS = [
  `<svg ${ICON_ATTRIBUTES} class="size-3.5 [[data-copy-state]_&]:hidden"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
  `<svg ${ICON_ATTRIBUTES} class="hidden size-3.5 [[data-copy-state=success]_&]:block"><path d="M20 6 9 17l-5-5"/></svg>`,
  `<svg ${ICON_ATTRIBUTES} class="hidden size-3.5 [[data-copy-state=error]_&]:block"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
].join('');

/**
 * Renders an optional data attribute.
 * @param name The attribute's name.
 * @param value Its value, or undefined to leave it out.
 * @returns The attribute with a leading space, or an empty string.
 */
const renderAttribute = (name: string, value: string | undefined): string =>
  // literal CRs are normalized by the HTML parser; character references retain original CRLF text
  value === undefined ? '' : ` ${name}="${escapeHtml(value).replaceAll('\r', '&#13;')}"`;

/**
 * Renders the guidance shown under a button after a failed copy, hidden until then. A button that
 * copies from a URL links to it under the guidance, so the text is a click away.
 * @param url The URL the button copies from, if any.
 * @returns The HTML.
 */
const renderHint = (url: string | undefined): string =>
  [
    '<span class="absolute top-full right-0 z-20 mt-1.5 w-60 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface p-2.5 text-xs leading-5 font-medium text-foreground shadow-raised" data-copy-hint hidden>',
    url === undefined
      ? ''
      : `<span data-copy-hint-text></span><a href="${escapeHtml(url)}" class="mt-1.5 block font-semibold underline underline-offset-2 wrap-anywhere">${escapeHtml(url)}</a>`,
    '</span>',
  ].join('');

/**
 * Renders a copy button as HTML, for the copy-button component and for code windows built outside
 * Astro, such as in Markdown. registerCopyButtons makes every such button copy. Its label and
 * guidance stay out of a Pagefind index.
 * @param options What the button copies and how it looks.
 * @returns The HTML.
 */
export const renderCopyButton = ({
  class: className,
  context = 'text',
  display = 'label',
  label = 'Copy',
  size = 'sm',
  sourceId,
  text,
  tone = 'surface',
  url,
}: ICopyButtonOptions = {}): string =>
  [
    `<span class="${escapeHtml(['relative inline-flex shrink-0 items-center', className].filter(Boolean).join(' '))}" data-pagefind-ignore>`,
    `<button type="button" inert class="invisible inline-flex ${SIZE_CLASSES[size]} font-semibold transition-colors ${TONE_CLASSES[tone]}${display === 'icon' ? ` ${size === 'sm' ? 'w-8' : 'w-11'} justify-center data-[copy-display=icon]:gap-0 data-[copy-display=icon]:px-0 pointer-coarse:min-h-11 pointer-coarse:min-w-11` : ''}" data-copy-button${renderAttribute('data-copy-display', display === 'icon' ? 'icon' : undefined)}${renderAttribute('data-copy-context', context)}${renderAttribute('data-copy-source', sourceId)}${renderAttribute('data-copy-text', text)}${renderAttribute('data-copy-url', url)}>`,
    ICONS,
    `<span class="${display === 'icon' ? 'sr-only' : LABEL_CELL_CLASSES}"><span class="col-start-1 row-start-1" data-copy-label>${escapeHtml(label)}</span></span>`,
    `<span class="sr-only"> ${escapeHtml(context)}</span>`,
    '</button>',
    '<span class="sr-only" data-copy-status role="status" aria-live="polite" aria-atomic="true"></span>',
    renderHint(url),
    '</span>',
  ].join('');
