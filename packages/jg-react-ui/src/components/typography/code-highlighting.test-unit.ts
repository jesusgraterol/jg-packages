// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { getCodeBlockHighlightStyle } from './code-highlighting.js';

describe('CodeBlock syntax highlighting', () => {
  test.each([
    ['light', '#8b1a89', '#2f6f31', '#1f5fbf'],
    ['dark', '#c678dd', '#98c379', '#61afef'],
  ] as const)(
    'preserves distinct accessible %s syntax colors',
    (theme, expectedKeywordColor, expectedStringColor, expectedFunctionColor) => {
      const highlightStyle = getCodeBlockHighlightStyle(theme);

      expect(highlightStyle['keyword']?.color).toBe(
        `var(--syntax-token-keyword, ${expectedKeywordColor})`,
      );
      expect(highlightStyle['string']?.color).toBe(
        `var(--syntax-token-string, ${expectedStringColor})`,
      );
      expect(highlightStyle['function']?.color).toBe(
        `var(--syntax-token-function, ${expectedFunctionColor})`,
      );
      expect(
        new Set([
          highlightStyle['keyword']?.color,
          highlightStyle['string']?.color,
          highlightStyle['function']?.color,
        ]).size,
      ).toBe(3);
      expect(highlightStyle['table']?.display).toBe('inline');
    },
  );
});
