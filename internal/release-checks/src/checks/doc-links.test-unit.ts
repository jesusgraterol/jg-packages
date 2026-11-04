import { describe, expect, test } from 'vitest';

import { checkDocLinks } from './doc-links.ts';

// the versions of the workspace the sample docs ship from
const WORKSPACE_VERSIONS = new Map([
  ['jg-react', '0.7.0'],
  ['jg-react-ui', '0.5.1'],
  ['@jg-packages/tool', '0.0.0'],
]);

// builds the tarball's files from their text
const toFiles = (files: Record<string, string>): Map<string, Buffer> =>
  new Map(Object.entries(files).map(([path, text]) => [path, Buffer.from(text)]));

describe('checkDocLinks', () => {
  test.each([
    ['unpkg', '[API.md](https://unpkg.com/jg-react@0.7.0/API.md)'],
    ['jsDelivr', '<https://cdn.jsdelivr.net/npm/jg-react-ui@0.5.1/errors/README.md>'],
    ['npm', 'See https://www.npmjs.com/package/jg-react/v/0.7.0.'],
    ['scoped', '[README](https://unpkg.com/@jg-packages/tool@0.0.0/README.md)'],
  ])('checkDocLinks(%s link at the workspace version) -> no problems', (_, markdown) => {
    expect(checkDocLinks(toFiles({ 'README.md': markdown }), WORKSPACE_VERSIONS)).toStrictEqual([]);
  });

  test.each([
    [
      'unpkg',
      'See [the reference](https://unpkg.com/jg-react@0.6.1/API.md).',
      'errors/README.md links jg-react@0.6.1, but the workspace has 0.7.0: https://unpkg.com/jg-react@0.6.1/API.md',
    ],
    [
      'jsDelivr',
      'See <https://cdn.jsdelivr.net/npm/jg-react-ui@0.3.4/errors/README.md>.',
      'errors/README.md links jg-react-ui@0.3.4, but the workspace has 0.5.1: https://cdn.jsdelivr.net/npm/jg-react-ui@0.3.4/errors/README.md',
    ],
    [
      'npm',
      'See https://www.npmjs.com/package/jg-react/v/0.6.1.',
      'errors/README.md links jg-react@0.6.1, but the workspace has 0.7.0: https://www.npmjs.com/package/jg-react/v/0.6.1',
    ],
    [
      'scoped',
      'See https://unpkg.com/@jg-packages/tool@1.0.0/README.md, then go on.',
      'errors/README.md links @jg-packages/tool@1.0.0, but the workspace has 0.0.0: https://unpkg.com/@jg-packages/tool@1.0.0/README.md',
    ],
    [
      'prerelease',
      'See [the reference](https://unpkg.com/jg-react@0.7.0-beta.1/API.md).',
      'errors/README.md links jg-react@0.7.0-beta.1, but the workspace has 0.7.0: https://unpkg.com/jg-react@0.7.0-beta.1/API.md',
    ],
  ])('checkDocLinks(%s link at another version) -> its problem', (_, markdown, problem) => {
    expect(
      checkDocLinks(toFiles({ 'errors/README.md': markdown }), WORKSPACE_VERSIONS),
    ).toStrictEqual([problem]);
  });

  test('reports each stale link once, in every shipped Markdown file', () => {
    const files = toFiles({
      'README.md':
        'The [API.md](https://unpkg.com/jg-react-ui@0.3.4/API.md) and [RECIPES.md](https://unpkg.com/jg-react-ui@0.3.4/RECIPES.md).',
      'errors/README.md':
        'In [the reference](https://unpkg.com/jg-react@0.6.1/API.md), as [before](https://unpkg.com/jg-react@0.6.1/API.md).',
    });

    expect(checkDocLinks(files, WORKSPACE_VERSIONS)).toStrictEqual([
      'README.md links jg-react-ui@0.3.4, but the workspace has 0.5.1: https://unpkg.com/jg-react-ui@0.3.4/API.md',
      'README.md links jg-react-ui@0.3.4, but the workspace has 0.5.1: https://unpkg.com/jg-react-ui@0.3.4/RECIPES.md',
      'errors/README.md links jg-react@0.6.1, but the workspace has 0.7.0: https://unpkg.com/jg-react@0.6.1/API.md',
    ]);
  });

  test('ignores other packages, unpinned links, the changelog, and files other than Markdown', () => {
    const stale = 'https://unpkg.com/jg-react@0.6.1/API.md';
    const files = toFiles({
      'README.md': [
        '[React](https://unpkg.com/react@18.0.0/index.js)',
        '[latest](https://unpkg.com/jg-react/API.md)',
        '[tag](https://unpkg.com/jg-react@latest/API.md)',
        '[range](https://unpkg.com/jg-react@^0.6.0/API.md)',
        '[site](https://jg-packages.jesusgraterol.dev/packages/jg-react/)',
        '`npm install jg-react@0.6.1`',
      ].join('\n'),
      'CHANGELOG.md': `- Linked [jg-react 0.6.1's reference](${stale}).`,
      'dist/index.js': `// ${stale}`,
    });

    expect(checkDocLinks(files, WORKSPACE_VERSIONS)).toStrictEqual([]);
  });
});
