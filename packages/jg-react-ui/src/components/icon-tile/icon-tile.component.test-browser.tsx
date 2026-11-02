import { cleanup, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, expect, test } from 'vitest';

import { IconTile } from './index.js';

afterEach(cleanup);

test(
  'IconTile is decorative by default and forwards native props and ref',
  { tags: ['full'] },
  () => {
    const ref = createRef<HTMLSpanElement>();
    render(
      <IconTile
        ref={ref}
        title="Decorative"
      >
        1
      </IconTile>,
    );
    expect(ref.current).toBe(screen.getByText('1'));
    expect(ref.current?.getAttribute('aria-hidden')).toBe('true');
    expect(ref.current?.dataset['size']).toBe('md');
    expect(ref.current?.dataset['tone']).toBe('neutral');
    expect(ref.current?.title).toBe('Decorative');
  },
);

test.each([
  ['sm', 'size-8'],
  ['md', 'size-10'],
  ['lg', 'size-12'],
] as const)('IconTile retains %s size classes', { tags: ['full'] }, (size, className) => {
  render(
    <IconTile
      size={size}
      aria-hidden={false}
      className="mt-2"
    >
      Step 2
    </IconTile>,
  );
  const tile = screen.getByText('Step 2');
  expect(tile.getAttribute('aria-hidden')).toBe('false');
  expect(tile.classList.contains(className)).toBe(true);
  expect(tile.classList.contains('mt-2')).toBe(true);
});

test.each(['neutral', 'brand', 'success', 'warning', 'destructive'] as const)(
  'IconTile retains the %s tone',
  { tags: ['full'] },
  (tone) => {
    render(<IconTile tone={tone}>Icon</IconTile>);
    expect(screen.getByText('Icon').dataset['tone']).toBe(tone);
  },
);
