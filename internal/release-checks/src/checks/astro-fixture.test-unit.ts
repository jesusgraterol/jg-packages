import { describe, expect, test } from 'vitest';

import { buildFixtureSources, classifyExports } from './astro-fixture.ts';

const EXPORTS = {
  './styles/theme.css': { style: './src/styles/theme.css', default: './src/styles/theme.css' },
  './syntax-theme': './src/syntax-theme/index.ts',
  './badge': './src/components/badge/badge.astro',
  './code-block': './src/components/code-block/code-block.astro',
};

describe('classifyExports', () => {
  test('sorts the specifiers into components, stylesheets, and modules', () => {
    expect(classifyExports('jg-ui', EXPORTS)).toStrictEqual({
      components: ['jg-ui/badge', 'jg-ui/code-block'],
      stylesheets: ['jg-ui/styles/theme.css'],
      modules: ['jg-ui/syntax-theme'],
    });
  });

  test('finds no components in a package without Astro exports', () => {
    expect(
      classifyExports('jg-sample', {
        '.': { types: './dist/index.d.ts', default: './dist/index.js' },
      }),
    ).toStrictEqual({ components: [], stylesheets: [], modules: ['jg-sample'] });
    expect(classifyExports('jg-sample', undefined).components).toStrictEqual([]);
  });
});

describe('buildFixtureSources', () => {
  test('imports and references every component and module, and imports every stylesheet', () => {
    const { page, stylesheet } = buildFixtureSources(classifyExports('jg-ui', EXPORTS));

    expect(page).toContain("import Component0 from 'jg-ui/badge';");
    expect(page).toContain("import Component1 from 'jg-ui/code-block';");
    expect(page).toContain("import * as module0 from 'jg-ui/syntax-theme';");
    expect(page).toContain('const imported = [Component0, Component1, module0];');
    expect(stylesheet).toBe("@import 'tailwindcss';\n@import 'jg-ui/styles/theme.css';\n");
  });
});
