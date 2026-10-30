import { cleanup, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { Button } from './index.js';

afterEach(cleanup);

test('Button forwards its ref and native attributes and responds to activation', async () => {
  const ref = createRef<HTMLButtonElement>();
  const onClick = vi.fn();
  render(
    <Button
      ref={ref}
      type="submit"
      name="action"
      value="save"
      onClick={onClick}
    >
      Save
    </Button>,
  );
  expect(ref.current).toBe(screen.getByRole('button', { name: 'Save' }));
  expect(ref.current?.type).toBe('submit');
  expect(ref.current?.name).toBe('action');
  expect(ref.current?.value).toBe('save');
  await page.getByRole('button', { name: 'Save' }).click();
  expect(onClick).toHaveBeenCalledTimes(1);
});

test.each([undefined, 0, -1])('Button omits a nonpositive badge: %s', (badgeCount) => {
  const { container } = render(
    <Button {...(badgeCount === undefined ? {} : { badgeCount })}>Inbox</Button>,
  );
  expect(container.querySelector('[data-slot="button-badge"]')).toBeNull();
});

test('Button retains badge defaults and custom count, location, and theme', () => {
  const { container, rerender } = render(<Button badgeCount={12}>Inbox</Button>);
  const badge = () => container.querySelector('[data-slot="button-badge"]');
  expect(badge()?.textContent).toBe('9+');
  expect(badge()?.getAttribute('data-location')).toBe('top-right');
  expect(badge()?.getAttribute('data-theme')).toBe('primary');
  rerender(
    <Button
      badgeCount={135}
      maxValue={99}
      badgeLocation="bottom-left"
      badgeTheme="destructive"
    >
      Inbox
    </Button>,
  );
  expect(badge()?.textContent).toBe('99+');
  expect(badge()?.getAttribute('data-location')).toBe('bottom-left');
  expect(badge()?.getAttribute('data-theme')).toBe('destructive');
});

test('Button renders a child link with and without a badge, retaining its content and href', () => {
  const { rerender } = render(
    <Button
      asChild
      badgeCount={3}
    >
      <a href="#inbox">Inbox</a>
    </Button>,
  );
  const link = screen.getByRole('button', { name: 'Inbox3' });
  expect(link.getAttribute('href')).toBe('#inbox');
  expect(link.querySelector('[data-slot="button-badge"]')?.textContent).toBe('3');
  rerender(
    <Button asChild>
      <a href="#inbox">Inbox</a>
    </Button>,
  );
  expect(screen.getByRole('button', { name: 'Inbox' }).getAttribute('href')).toBe('#inbox');
});

test('Button preserves disabled and busy semantics for native and child buttons', () => {
  const onClick = vi.fn();
  const { rerender } = render(
    <Button
      disabled
      aria-busy="true"
      onClick={onClick}
    >
      Save
    </Button>,
  );
  expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('button').getAttribute('aria-busy')).toBe('true');
  screen.getByRole('button').click();
  expect(onClick).not.toHaveBeenCalled();
  rerender(
    <Button
      asChild
      disabled
      variant="ghost"
    >
      <a href="#inbox">Inbox</a>
    </Button>,
  );
  expect(screen.getByRole('button', { name: 'Inbox' }).getAttribute('aria-disabled')).toBe('true');
});
