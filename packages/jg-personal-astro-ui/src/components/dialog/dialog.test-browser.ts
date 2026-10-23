import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';

import { registerDialogs } from './dialog-behavior.ts';

/*
 * The dialog's behavior on markup like the component's, in Chromium, Firefox, and WebKit, where
 * the dialog element itself makes the rest of the page inert while it's open.
 */

/**
 * Renders a trigger, a dialog with a close button and a link, and a button outside it.
 * @returns The trigger, the dialog, its close button, and the outside button.
 */
const renderDialog = () => {
  document.body.innerHTML = `
    <button type="button" id="trigger" data-dialog-open="example">Open</button>
    <button type="button" id="outside">Outside</button>
    <dialog id="example" aria-labelledby="example-title" data-dialog>
      <div>
        <h2 id="example-title">Example</h2>
        <button type="button" data-dialog-close>Close</button>
      </div>
      <div><a href="#here" id="link">A link</a></div>
    </dialog>
  `;
  return {
    trigger: document.getElementById('trigger') as HTMLButtonElement,
    dialog: document.getElementById('example') as HTMLDialogElement,
    close: document.querySelector('[data-dialog-close]') as HTMLButtonElement,
    outside: document.getElementById('outside') as HTMLButtonElement,
  };
};

beforeAll(() => {
  registerDialogs();
});

afterEach(async () => {
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((dialog) => dialog.close());
  await expect.poll(() => document.body.style.position).not.toBe('fixed');
  document.body.innerHTML = '';
});

describe('dialog', () => {
  test('opens from its trigger as a modal, which keeps focus inside it', async () => {
    const { dialog, outside, trigger } = renderDialog();

    await userEvent.click(trigger);
    outside.focus();

    expect(dialog.open).toBe(true);
    expect(dialog.matches(':modal')).toBe(true);
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  test('closes on Escape, and gives focus back to its trigger', async () => {
    const { dialog, trigger } = renderDialog();
    await userEvent.click(trigger);

    await userEvent.keyboard('{Escape}');

    await expect.poll(() => dialog.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  test('closes from its close button, and gives focus back to its trigger', async () => {
    const { close, dialog, trigger } = renderDialog();
    await userEvent.click(trigger);

    await userEvent.click(close);

    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  test('closes on a click on its backdrop, but not on its content', async () => {
    const { dialog, trigger } = renderDialog();
    await userEvent.click(trigger);

    (document.getElementById('example-title') as HTMLElement).click();
    expect(dialog.open).toBe(true);
    dialog.click();

    expect(dialog.open).toBe(false);
  });
});
