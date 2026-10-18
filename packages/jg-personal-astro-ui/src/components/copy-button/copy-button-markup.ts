import { escapeHtml } from '../../html/index.ts';

// the copy button's look: 'surface' on the page's surfaces, 'terminal' on dark terminal panels, and
// 'outline', a bordered pill for a button that stands on its own, such as a page's copy button
export type ICopyButtonTone = 'outline' | 'surface' | 'terminal';

// the copy button's height and text: 'sm', compact, as in a code window's header, or 'md', as tall
// as a default-sized button beside it
export type ICopyButtonSize = 'md' | 'sm';

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
  value === undefined ? '' : ` ${name}="${escapeHtml(value)}"`;

/**
 * Renders the guidance shown under a button after a failed copy, hidden until then. A button that
 * copies from a URL links to it under the guidance, so the text is a click away.
 * @param url The URL the button copies from, if any.
 * @returns The HTML.
 */
const renderHint = (url: string | undefined): string =>
  [
    '<span class="absolute top-full right-0 z-20 mt-1.5 w-60 rounded-lg border border-border bg-surface p-2.5 text-xs leading-5 font-medium text-foreground shadow-raised" data-copy-hint hidden>',
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
  label = 'Copy',
  size = 'sm',
  sourceId,
  text,
  tone = 'surface',
  url,
}: ICopyButtonOptions = {}): string =>
  [
    `<span class="${escapeHtml(['relative inline-flex shrink-0 items-center', className].filter(Boolean).join(' '))}" data-pagefind-ignore>`,
    `<button type="button" class="inline-flex ${SIZE_CLASSES[size]} font-semibold transition-colors ${TONE_CLASSES[tone]}" data-copy-button${renderAttribute('data-copy-context', context)}${renderAttribute('data-copy-source', sourceId)}${renderAttribute('data-copy-text', text)}${renderAttribute('data-copy-url', url)}>`,
    ICONS,
    `<span data-copy-label>${escapeHtml(label)}</span>`,
    `<span class="sr-only"> ${escapeHtml(context)}</span>`,
    '</button>',
    '<span class="sr-only" data-copy-status aria-live="polite"></span>',
    renderHint(url),
    '</span>',
  ].join('');
