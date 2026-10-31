import { expect, test } from 'vitest';

import { DEFAULT_CODE_DIFF_STYLES } from './constants.js';
import {
  canComputeCodeDiffSynchronously,
  normalizeCodeDiffHighlightStyle,
  resolveCodeDiffStyles,
} from './utilities.js';

test.each([
  ['', '', true],
  ['a'.repeat(4096), 'b'.repeat(4096), true],
  ['a'.repeat(4096), 'b'.repeat(4097), false],
  ['line\n'.repeat(63), 'line\n'.repeat(63), true],
  ['line\n'.repeat(64), 'line\n'.repeat(63), false],
  ['line\r\n'.repeat(63), 'line\r\n'.repeat(63), true],
  ['line\r\n'.repeat(64), 'line\r\n'.repeat(63), false],
  ['line\r'.repeat(63), 'line\r'.repeat(63), true],
  ['line\r'.repeat(64), 'line\r'.repeat(63), false],
  ['line\r\nline\rline\n', '', true],
])('synchronous budget for %s and %s -> %s', (oldValue, newValue, expected) => {
  expect(canComputeCodeDiffSynchronously(oldValue, newValue)).toBe(expected);
});

test('syntax normalization preserves colors and layout without hiding diff backgrounds', () => {
  const original = {
    keyword: { color: 'red', background: 'blue', textShadow: '1px 1px black', fontWeight: 600 },
  };
  expect(normalizeCodeDiffHighlightStyle(original)).toStrictEqual({
    keyword: { color: 'red', background: 'transparent', textShadow: 'none', fontWeight: 600 },
  });
  expect(original.keyword.background).toBe('blue');
});

test('style overrides retain defaults, both theme maps and consumer precedence', () => {
  const defaults = resolveCodeDiffStyles();
  expect(defaults.variables?.light?.diffViewerBackground).toBe('var(--background)');
  expect(defaults.diffContainer).toStrictEqual([
    DEFAULT_CODE_DIFF_STYLES.diffContainer,
    expect.objectContaining({ tableLayout: 'fixed', width: '100%' }),
  ]);
  const custom = resolveCodeDiffStyles({
    variables: { light: { addedColor: 'lime' }, dark: { removedColor: 'pink' } },
    diffContainer: { fontSize: 16 },
    gutter: { width: 64 },
    content: { padding: 4 },
    lineContent: { padding: 8 },
    contentText: { fontSize: 16 },
    codeFoldExpandButton: { fontWeight: 700 },
  });
  expect(custom.variables?.light?.addedColor).toBe('lime');
  expect(custom.variables?.dark?.removedColor).toBe('pink');
  expect(custom.variables?.dark?.diffViewerBackground).toBe('var(--background)');
  expect(custom.diffContainer).toStrictEqual([defaults.diffContainer, { fontSize: 16 }]);
  expect(custom.gutter).toStrictEqual([defaults.gutter, { width: 64 }]);
  expect(custom.content).toStrictEqual([defaults.content, { padding: 4 }]);
  expect(custom.lineContent).toStrictEqual([defaults.lineContent, { padding: 8 }]);
  expect(custom.contentText).toStrictEqual([defaults.contentText, { fontSize: 16 }]);
  expect(custom.codeFoldExpandButton).toStrictEqual([
    defaults.codeFoldExpandButton,
    { fontWeight: 700 },
  ]);
});
