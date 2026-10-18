import { describe, expect, test } from 'vitest';

import { renderSegmentedControl } from './segmented-control-markup.ts';

// the two modes the sites' toggles switch between
const MODES = [
  { label: 'Supervised', value: 'supervised' },
  { label: 'Autonomous', value: 'autonomous' },
] as const;

/**
 * Lists the radios of a rendered control.
 * @param html The control.
 * @returns Each radio's opening tag.
 */
const readRadios = (html: string): string[] => html.match(/<input[^>]*>/gu) ?? [];

describe('renderSegmentedControl', () => {
  test('renders a fieldset, its legend, and a native radio per option, the first checked', () => {
    const html = renderSegmentedControl({
      legend: 'How jg-execute runs',
      name: 'execute-mode',
      options: MODES,
    });

    expect(
      html.startsWith(
        '<fieldset class="min-w-0"><legend class="mb-2 text-sm font-semibold">How jg-execute runs</legend>',
      ),
    ).toBe(true);
    expect(html).toContain('rounded-full border border-border bg-surface p-1');
    expect(readRadios(html)).toStrictEqual([
      '<input class="sr-only" type="radio" name="execute-mode" value="supervised" checked data-segment="supervised">',
      '<input class="sr-only" type="radio" name="execute-mode" value="autonomous" data-segment="autonomous">',
    ]);
    expect(html).toContain('data-segment="supervised">Supervised</label>');
    // the label shows the checked state and the hidden radio's focus ring
    expect(html).toContain('has-checked:bg-primary has-checked:text-primary-foreground');
    expect(html).toContain('has-focus-visible:outline-2');
  });

  test('checks the default value, hides the legend, and escapes what it shows', () => {
    const html = renderSegmentedControl({
      class: 'justify-self-center "x"',
      defaultValue: 'autonomous',
      legend: 'Mode <a>',
      legendHidden: true,
      name: 'mode"1',
      options: [...MODES, { label: 'Both & more', value: 'both-2' }],
    });

    expect(html).toContain('<fieldset class="min-w-0 justify-self-center &quot;x&quot;">');
    expect(html).toContain('<legend class="sr-only">Mode &lt;a&gt;</legend>');
    expect(readRadios(html).map((radio) => radio.includes(' checked'))).toStrictEqual([
      false,
      true,
      false,
    ]);
    expect(html).toContain('name="mode&quot;1"');
    expect(html).toContain('data-segment="both-2">Both &amp; more</label>');
  });

  test.each(['Autonomous', 'auto mode', 'a_b', 'a]b', 'a"b', ''])(
    'throws for the value %o, which a selector could not hold safely',
    (value) => {
      expect(() =>
        renderSegmentedControl({ legend: 'Mode', name: 'mode', options: [{ label: 'A', value }] }),
      ).toThrow('must be lowercase letters, digits, and hyphens');
    },
  );

  test('throws when two options share a value', () => {
    expect(() =>
      renderSegmentedControl({ legend: 'Mode', name: 'mode', options: [MODES[0], MODES[0]] }),
    ).toThrow("The segmented control's values must differ: supervised, supervised.");
  });

  test('throws when the default value is not an option', () => {
    expect(() =>
      renderSegmentedControl({
        defaultValue: 'manual',
        legend: 'Mode',
        name: 'mode',
        options: MODES,
      }),
    ).toThrow('default value "manual" is not one of its options');
  });

  test('throws without options', () => {
    expect(() => renderSegmentedControl({ legend: 'Mode', name: 'mode', options: [] })).toThrow(
      'The segmented control needs at least one option.',
    );
  });
});
