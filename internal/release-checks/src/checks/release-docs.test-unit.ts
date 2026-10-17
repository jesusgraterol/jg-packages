import { describe, expect, test } from 'vitest';

import { renderApiMarkdown, type IApiReference } from '@jg-packages/api-reference';

import { checkReleaseDocs } from './release-docs.ts';

const MANIFEST = { name: 'jg-sample', version: '1.2.0' };

const README = [
  '# jg-sample',
  '',
  'Does one thing well.',
  '',
  '## Install',
  '',
  '## Usage',
  '',
  '## Documentation',
  '',
  '## License',
  '',
].join('\n');

const CHANGELOG = '# Changelog\n\n## 1.2.0\n\n### Added\n\n- Something.\n\n## 1.1.0\n';

// the sample package's API reference, and the API.md a build writes from it
const REFERENCE: IApiReference = { packageName: 'jg-sample', version: '1.2.0', entryPoints: [] };
const API_MARKDOWN = renderApiMarkdown(REFERENCE);

// builds the tarball's documentation files
const toFiles = (
  readme: string | undefined,
  changelog: string | undefined,
  // null leaves API.md out
  apiMarkdown: string | null = API_MARKDOWN,
): Map<string, Buffer> =>
  new Map(
    [
      ['README.md', readme],
      ['CHANGELOG.md', changelog],
      ['API.md', apiMarkdown ?? undefined],
    ].flatMap(([path, text]) => (text === undefined ? [] : [[path!, Buffer.from(text)] as const])),
  );

describe('checkReleaseDocs', () => {
  test('accepts a changelog section for the version and the README sections in order', () => {
    expect(checkReleaseDocs(MANIFEST, toFiles(README, CHANGELOG), REFERENCE)).toStrictEqual([]);
  });

  test('accepts a README with extra sections', () => {
    const readme = README.replace('## Usage', '## Usage\n\n## Browser support');

    expect(checkReleaseDocs(MANIFEST, toFiles(readme, CHANGELOG), REFERENCE)).toStrictEqual([]);
  });

  test('reports a Coming from section', () => {
    const readme = README.replace(
      '## Documentation',
      '## Coming from sample-utils\n\n## Documentation',
    );

    expect(checkReleaseDocs(MANIFEST, toFiles(readme, CHANGELOG), REFERENCE)).toStrictEqual([
      'README.md has a `## Coming from sample-utils` section, but no package has a predecessor',
    ]);
  });

  test('reports a changelog without a section for the version', () => {
    expect(
      checkReleaseDocs(
        MANIFEST,
        toFiles(README, CHANGELOG.replace('## 1.2.0', '## 1.2.0-beta.0')),
        REFERENCE,
      ),
    ).toStrictEqual(['CHANGELOG.md has no `## 1.2.0` section']);
  });

  test('reports missing documents', () => {
    expect(
      checkReleaseDocs(MANIFEST, toFiles(undefined, undefined, null), REFERENCE),
    ).toStrictEqual([
      "doesn't ship a CHANGELOG.md",
      "doesn't ship a README.md",
      "doesn't ship an API.md",
    ]);
  });

  test('reports a wrong title, a missing summary, and sections out of order', () => {
    const readme = README.replace('# jg-sample', '# Sample')
      .replace('Does one thing well.', '')
      .replace('## Documentation\n\n## License', '## License\n\n## Documentation');

    expect(checkReleaseDocs(MANIFEST, toFiles(readme, CHANGELOG), REFERENCE)).toStrictEqual([
      "README.md doesn't start with the title `# jg-sample`",
      'README.md has no summary between the title and the first section',
      'README.md needs the sections `## Install`, `## Usage`, `## Documentation`, `## License` once each, in that order',
    ]);
  });

  test('reports an API.md that differs from a fresh render of the TSDoc', () => {
    const outdated = API_MARKDOWN.replace('0 in all', '1 in all');

    expect(
      checkReleaseDocs(MANIFEST, toFiles(README, CHANGELOG, outdated), REFERENCE),
    ).toStrictEqual(['API.md differs from a fresh render of the TSDoc; build the package again']);
  });
});
