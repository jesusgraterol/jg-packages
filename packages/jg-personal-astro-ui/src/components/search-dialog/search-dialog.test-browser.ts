import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';

import { registerDialogs } from '../dialog/dialog-behavior.ts';
import { registerSearchDialogs, type IPagefind } from './search-behavior.ts';

/*
 * The search dialog on markup like the component's, in Chromium, Firefox, and WebKit, searching a
 * fake Pagefind that knows one page.
 */

// a Pagefind that finds jg-fetch for any query that mentions fetch
const PAGEFIND: IPagefind = {
  search: (query) =>
    Promise.resolve({
      results: query.includes('fetch')
        ? [
            {
              data: () =>
                Promise.resolve({
                  excerpt: 'A <mark>fetch</mark> wrapper that never throws.',
                  meta: { title: 'jg-fetch' },
                  url: '/packages/jg-fetch/',
                }),
            },
          ]
        : [],
    }),
};

/**
 * Renders a button to start from, and the search dialog.
 * @returns The button, the dialog, and its field, list, and status.
 */
const renderSearch = () => {
  document.body.innerHTML = `
    <button type="button" id="start">Start</button>
    <dialog id="search" aria-labelledby="search-title" data-dialog>
      <h2 id="search-title">Search</h2>
      <button type="button" data-dialog-close>Close</button>
      <div data-search-dialog data-pagefind-path="/pagefind/pagefind.js">
        <input type="search" aria-label="Search the site" data-search-input />
        <p aria-live="polite" data-search-status></p>
        <ul data-search-results></ul>
      </div>
    </dialog>
  `;
  return {
    start: document.getElementById('start') as HTMLButtonElement,
    dialog: document.getElementById('search') as HTMLDialogElement,
    input: document.querySelector('[data-search-input]') as HTMLInputElement,
    list: document.querySelector('[data-search-results]') as HTMLUListElement,
    status: document.querySelector('[data-search-status]') as HTMLParagraphElement,
  };
};

beforeAll(() => {
  registerDialogs();
  registerSearchDialogs(document, () => Promise.resolve(PAGEFIND));
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('search dialog', () => {
  test('opens on /, with its field focused, and lists what matches', async () => {
    const { dialog, input, list, start, status } = renderSearch();
    start.focus();

    await userEvent.keyboard('/');
    expect(dialog.open).toBe(true);
    expect(document.activeElement).toBe(input);
    await userEvent.keyboard('fetch');

    await expect.poll(() => status.textContent).toBe('1 result for “fetch”.');
    const link = list.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/packages/jg-fetch/');
    expect(link.querySelector('mark')?.textContent).toBe('fetch');
  });

  test('opens on Ctrl+K, and gives focus back on Escape', async () => {
    const { dialog, start } = renderSearch();
    start.focus();

    await userEvent.keyboard('{Control>}k{/Control}');
    expect(dialog.open).toBe(true);
    await userEvent.keyboard('{Escape}');

    await expect.poll(() => dialog.open).toBe(false);
    expect(document.activeElement).toBe(start);
  });

  test('closes on one Escape with text in its field, giving focus back', async () => {
    const { dialog, input, start } = renderSearch();
    start.focus();
    await userEvent.keyboard('/');
    await userEvent.type(input, 'fetch');

    await userEvent.keyboard('{Escape}');

    await expect.poll(() => dialog.open).toBe(false);
    expect(document.activeElement).toBe(start);
  });

  test('says when nothing matches', async () => {
    const { input, status } = renderSearch();
    await userEvent.keyboard('/');

    await userEvent.type(input, 'zzz');

    await expect.poll(() => status.textContent).toBe('No results for “zzz”.');
  });
});
