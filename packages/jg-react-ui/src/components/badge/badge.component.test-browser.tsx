import { cleanup, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { Badge } from './index.js';

afterEach(cleanup);

test('Badge forwards span attributes and ref with the selected variant', () => {
  const ref = createRef<HTMLSpanElement>();
  render(
    <Badge
      ref={ref}
      variant="secondary"
      title="Current status"
    >
      Ready
    </Badge>,
  );
  expect(ref.current).toBe(screen.getByText('Ready'));
  expect(ref.current?.tagName).toBe('SPAN');
  expect(ref.current?.title).toBe('Current status');
  expect(ref.current?.dataset['variant']).toBe('secondary');
});

test('Badge merges child and parent handlers, refs, styles, and native link props', async () => {
  const ref = createRef<HTMLSpanElement>();
  const childRef = createRef<HTMLAnchorElement>();
  const parentClick = vi.fn();
  const childClick = vi.fn();
  render(
    <Badge
      asChild
      ref={ref}
      onClick={parentClick}
      className="parent-class"
      style={{ marginTop: 4 }}
    >
      <a
        ref={childRef}
        href="#ready"
        className="child-class"
        style={{ marginBottom: 8 }}
        onClick={childClick}
      >
        Ready
      </a>
    </Badge>,
  );
  const link = screen.getByRole('link', { name: 'Ready' });
  expect(ref.current).toBe(link);
  expect(childRef.current).toBe(link);
  expect(link.getAttribute('href')).toBe('#ready');
  expect(link.classList.contains('parent-class')).toBe(true);
  expect(link.classList.contains('child-class')).toBe(true);
  expect(link.style.marginTop).toBe('4px');
  expect(link.style.marginBottom).toBe('8px');
  await page.getByRole('link', { name: 'Ready' }).click();
  expect(parentClick).toHaveBeenCalledTimes(1);
  expect(childClick).toHaveBeenCalledTimes(1);
});
