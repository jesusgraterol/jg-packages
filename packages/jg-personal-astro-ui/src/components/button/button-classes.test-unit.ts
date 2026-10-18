import { describe, expect, test } from 'vitest';

import { buildButtonClasses } from './button-classes.ts';

describe('buildButtonClasses', () => {
  test('pads each text size, after the shared classes, and adds the page classes last', () => {
    const classes = buildButtonClasses('sm', 'outline', 'mt-8').split(' ');

    expect(classes.slice(0, 2)).toStrictEqual(['inline-flex', 'shrink-0']);
    expect(classes).toContain('min-h-9');
    expect(classes).toContain('px-3.5');
    expect(classes).toContain('border-border-strong');
    expect(classes.at(-1)).toBe('mt-8');
  });

  test('leaves the padding out of the link variant, whatever the size', () => {
    for (const size of ['xs', 'sm', 'default', 'lg'] as const) {
      const classes = buildButtonClasses(size, 'link');

      expect(classes).not.toMatch(/\bpx-/u);
      expect(classes).toContain('hover:underline');
    }
  });

  test('gives icon sizes a square instead of padding', () => {
    expect(buildButtonClasses('icon', 'ghost')).toContain('size-9');
    expect(buildButtonClasses('touch', 'default')).not.toMatch(/\bpx-/u);
  });

  test('never sets the same property from the size and the variant', () => {
    for (const variant of [
      'default',
      'outline',
      'secondary',
      'ghost',
      'destructive',
      'link',
    ] as const) {
      const classes = buildButtonClasses('default', variant).split(' ');
      const paddings = classes.filter((name) => /^px-/u.test(name));

      expect(paddings.length).toBeLessThanOrEqual(1);
    }
  });
});
