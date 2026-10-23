import { copyText } from 'jg-clipboard';
import { getErrorCode } from 'jg-exception';

import { COPY_OUTCOME_LABELS } from './copy-button-markup.ts';
import { positionCopyHint, registerCopyDom } from './copy-dom.ts';
import { getCopyGuidance } from './copy-guidance.ts';

// how long the copied state shows before the button resets
const RESET_DELAY_MS = 2_000;

// the timer that resets each button after a copy, cleared when it's clicked again
const resetTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

// each button's latest click, so an earlier copy that settles late never shows over it
const latestAttempts = new WeakMap<HTMLElement, object>();

// each button's own label, which shows again once its outcome resets
const defaultLabels = new WeakMap<HTMLElement, string | null>();

/**
 * Fetches the text a copy button copies from a URL.
 * @param url The URL, such as a page's Markdown version.
 * @returns A promise that resolves to the response's text, and rejects when the request fails or
 * the response isn't a success.
 */
const fetchCopyText = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `The text to copy couldn't be loaded from ${url}: the server answered ${String(response.status)}.`,
    );
  }
  return response.text();
};

/**
 * Reads the text a copy button copies: its own text, the text at its URL, the text of the element it
 * names, or the code of the code window it's in.
 * @param button The copy button.
 * @returns The text, a promise of the text at the button's URL, or undefined when there's nothing
 * to copy.
 */
export const readCopyText = (button: HTMLElement): string | Promise<string> | undefined => {
  const { copySource, copyText: text, copyUrl: url } = button.dataset;
  if (text !== undefined) {
    return text;
  }
  if (url !== undefined) {
    return fetchCopyText(url);
  }
  const source =
    copySource === undefined
      ? button.closest('[data-code-window]')?.querySelector('pre')
      : button.ownerDocument.getElementById(copySource);
  return source?.textContent ?? undefined;
};

/**
 * Shows a copy's outcome on its button: the label, the message screen readers announce, and, after
 * a failure, the guidance under the button, above the link to the button's URL when it has one.
 * @param button The copy button.
 * @param outcome The state to show, with its label and message, or undefined to reset the button.
 */
const showOutcome = (
  button: HTMLElement,
  outcome: { state: 'success' | 'error'; label: string; message: string } | undefined,
): void => {
  const wrapper = button.parentElement;
  const label = button.querySelector('[data-copy-label]');
  const status = wrapper?.querySelector('[data-copy-status]');
  const hint = wrapper?.querySelector<HTMLElement>('[data-copy-hint]');
  if (outcome === undefined) {
    delete button.dataset['copyState'];
    button.style.removeProperty('min-width');
  } else {
    // holds the resting width while the outcome shows, so a shorter label, such as "Copied" in
    // place of "Copy install command", never shrinks the button and moves what sits beside it; the
    // markup already makes room for a longer one. Every attempt resets the button first, so this
    // reads its width at rest
    button.style.minWidth = `${button.getBoundingClientRect().width}px`;
    button.dataset['copyState'] = outcome.state;
  }
  if (label) {
    // read before the first outcome replaces it
    const defaultLabel = defaultLabels.get(button) ?? label.textContent;
    defaultLabels.set(button, defaultLabel);
    label.textContent = outcome?.label ?? defaultLabel;
  }
  if (status) status.textContent = outcome?.message ?? '';
  if (hint) {
    // the guidance stays until the next attempt, so there's time to read and follow it
    (hint.querySelector('[data-copy-hint-text]') ?? hint).textContent =
      outcome?.state === 'error' ? outcome.message : '';
    hint.hidden = outcome?.state !== 'error';
    if (!hint.hidden) positionCopyHint(hint);
  }
};

/** Releases feedback for a removed control or a document being dismissed. */
const releaseCopyButton = (button: HTMLElement): void => {
  clearTimeout(resetTimers.get(button));
  resetTimers.delete(button);
  latestAttempts.delete(button);
  showOutcome(button, undefined);
  defaultLabels.delete(button);
};

/**
 * Copies a button's text and shows the outcome. The clipboard call starts before anything awaits,
 * so browsers still see the click that started it.
 * @param button The copy button.
 * @returns A promise that resolves once the outcome shows.
 */
export const copyFromButton = async (button: HTMLElement): Promise<void> => {
  if (!button.isConnected) return;
  const attempt = {};
  latestAttempts.set(button, attempt);
  clearTimeout(resetTimers.get(button));
  showOutcome(button, undefined);
  const text = readCopyText(button);
  try {
    if (text === undefined) {
      throw new Error('The copy button has nothing to copy.');
    }
    await copyText(text);
  } catch (error) {
    if (latestAttempts.get(button) !== attempt || !button.isConnected) {
      return;
    }
    showOutcome(button, {
      state: 'error',
      label: COPY_OUTCOME_LABELS.error,
      message: getCopyGuidance(getErrorCode(error), {
        context: button.dataset['copyContext'] ?? 'text',
        label: defaultLabels.get(button),
        linked: button.dataset['copyUrl'] !== undefined,
      }),
    });
    return;
  }
  if (latestAttempts.get(button) !== attempt || !button.isConnected) {
    return;
  }
  showOutcome(button, {
    state: 'success',
    label: COPY_OUTCOME_LABELS.success,
    message: 'Copied to the clipboard.',
  });
  resetTimers.set(
    button,
    setTimeout(() => {
      if (button.isConnected) showOutcome(button, undefined);
    }, RESET_DELAY_MS),
  );
};

/**
 * Copies when a click lands on a copy button, including buttons added after the page loaded.
 * @param event The click.
 */
export const handleCopyClick = (event: Event): void => {
  const target = event.target as Partial<Element> | null;
  const button =
    typeof target?.closest === 'function'
      ? target.closest<HTMLElement>('[data-copy-button]')
      : null;
  if (button !== null) {
    void copyFromButton(button);
  }
};

/**
 * Makes every copy button on the page copy, through one click listener on the document. Each
 * component that renders copy buttons calls it from its script. A document-owned controller
 * reveals current and future controls, keeps guidance in view, and releases detached feedback.
 * @param root The document. Defaults to the page's.
 */
export const registerCopyButtons = (root: Document = document): void => {
  registerCopyDom(root, handleCopyClick, releaseCopyButton);
};
