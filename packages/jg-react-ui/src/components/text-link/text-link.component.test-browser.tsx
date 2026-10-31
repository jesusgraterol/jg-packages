import { cleanup, render, screen } from '@testing-library/react';
import { createRef, type ComponentProps } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { TextLink } from './index.js';

afterEach(cleanup);

const ConsumerLink = (props: ComponentProps<'a'>) => <a {...props} />;

test('TextLink preserves a consumer link, ref, handler and complete new-tab name', async () => {
  const reference = createRef<HTMLAnchorElement>();
  const onClick = vi.fn((event: React.MouseEvent<HTMLAnchorElement>) => event.preventDefault());
  const { rerender } = render(
    <TextLink
      asChild
      variant="action"
    >
      <ConsumerLink
        href="#guide"
        target="_blank"
        rel="nofollow noopener"
        ref={reference}
        onClick={onClick}
        aria-label="Read the guide"
      >
        Guide
      </ConsumerLink>
    </TextLink>,
  );
  const link = screen.getByRole('link', { name: 'Read the guide (opens in a new tab)' });
  expect(reference.current).toBe(link);
  expect(link.getAttribute('href')).toBe('#guide');
  expect(link.textContent).toBe('Guide (opens in a new tab)');
  expect(new Set(link.getAttribute('rel')?.split(' '))).toStrictEqual(
    new Set(['nofollow', 'noopener', 'noreferrer']),
  );
  expect(link.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(1);
  await page.getByRole('link', { name: 'Read the guide (opens in a new tab)' }).click();
  expect(onClick).toHaveBeenCalledOnce();
  rerender(
    <TextLink
      asChild
      target="_self"
    >
      <ConsumerLink
        href="#guide"
        aria-label="Read the guide"
      >
        Guide
      </ConsumerLink>
    </TextLink>,
  );
  const ordinary = screen.getByRole('link', { name: 'Read the guide' });
  expect(ordinary.getAttribute('target')).toBe('_self');
  expect(ordinary.textContent).toBe('Guide');
});

test('TextLink secures native new-tab links with or without an authored accessible name', () => {
  const { rerender } = render(
    <TextLink
      href="https://example.com/guide"
      target="_blank"
    >
      Connection guide
    </TextLink>,
  );
  expect(
    screen
      .getByRole('link', { name: /^Connection guide\s*\(opens in a new tab\)$/u })
      .getAttribute('rel'),
  ).toBe('noopener noreferrer');
  rerender(
    <TextLink
      href="#guide"
      aria-label="Open connection guide"
      target="_blank"
      rel="  nofollow  "
    >
      Guide
    </TextLink>,
  );
  expect(
    screen
      .getByRole('link', { name: 'Open connection guide (opens in a new tab)' })
      .getAttribute('rel'),
  ).toBe('nofollow noopener noreferrer');
});
