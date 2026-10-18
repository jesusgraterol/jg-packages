import { describe, expect, test } from 'vitest';

import { buildTableClasses, buildTableRegionAttributes } from './table-classes.ts';

describe('buildTableClasses', () => {
  test('renders the table as before by default', () => {
    expect(buildTableClasses()).toStrictEqual({
      caption: 'px-4 pt-3 text-left text-xs text-muted',
      table:
        'w-full border-collapse text-left text-sm [&_tbody_tr]:border-t [&_tbody_tr]:border-border [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_th]:px-4 [&_th]:py-3 [&_th]:font-semibold [&_th]:whitespace-nowrap [&_thead]:bg-secondary',
      wrapper: 'overflow-x-auto rounded-xl border border-border bg-surface shadow-surface',
    });
  });

  test('shows a hidden caption to screen readers only', () => {
    expect(buildTableClasses({ captionHidden: true }).caption).toBe('sr-only');
  });

  test("keeps a scroll region's sideways scroll to itself", () => {
    expect(buildTableClasses({ scrollable: true }).wrapper).toContain('overscroll-x-contain');
  });

  test('pins an opaque first cell in every row, on the head colour in the head', () => {
    const { table } = buildTableClasses({ stickyFirstColumn: true });

    expect(table.startsWith(buildTableClasses().table)).toBe(true);
    for (const utility of ['sticky', 'left-0', 'z-10', 'border-r', 'bg-surface']) {
      expect(table).toContain(`[&_tr>:first-child]:${utility}`);
    }
    expect(table).toContain('[&_thead_tr>:first-child]:bg-secondary');
  });
});

describe('buildTableRegionAttributes', () => {
  test('makes a labelled region keyboard users can focus', () => {
    expect(buildTableRegionAttributes('Coding mode comparison')).toStrictEqual({
      'aria-label': 'Coding mode comparison',
      role: 'region',
      tabindex: '0',
    });
  });

  test('adds nothing without a label', () => {
    expect(buildTableRegionAttributes(undefined)).toStrictEqual({});
  });
});
