import { describe, expect, test } from 'vitest';

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
  '## Coming from sample-utils',
  '',
  '## Documentation',
  '',
  '## License',
  '',
].join('\n');

const CHANGELOG = '# Changelog\n\n## 1.2.0\n\n### Added\n\n- Something.\n\n## 1.1.0\n';

// builds the tarball's documentation files
const toFiles = (readme: string | undefined, changelog: string | undefined): Map<string, Buffer> =>
  new Map(
    [
      ['README.md', readme],
      ['CHANGELOG.md', changelog],
    ].flatMap(([path, text]) => (text === undefined ? [] : [[path!, Buffer.from(text)] as const])),
  );

describe('checkReleaseDocs', () => {
  test('accepts a changelog section for the version and the README sections in order', () => {
    expect(checkReleaseDocs(MANIFEST, toFiles(README, CHANGELOG))).toStrictEqual([]);
  });

  test('accepts a README without a Coming from section and with extra sections', () => {
    const readme = README.replace('## Coming from sample-utils\n\n', '').replace(
      '## Usage',
      '## Usage\n\n## Browser support',
    );

    expect(checkReleaseDocs(MANIFEST, toFiles(readme, CHANGELOG))).toStrictEqual([]);
  });

  test('reports a changelog without a section for the version', () => {
    expect(
      checkReleaseDocs(MANIFEST, toFiles(README, CHANGELOG.replace('## 1.2.0', '## 1.2.0-beta.0'))),
    ).toStrictEqual(['CHANGELOG.md has no `## 1.2.0` section']);
  });

  test('reports missing documents', () => {
    expect(checkReleaseDocs(MANIFEST, toFiles(undefined, undefined))).toStrictEqual([
      "doesn't ship a CHANGELOG.md",
      "doesn't ship a README.md",
    ]);
  });

  test('reports a wrong title, a missing summary, and sections out of order', () => {
    const readme = README.replace('# jg-sample', '# Sample')
      .replace('Does one thing well.', '')
      .replace('## Documentation\n\n## License', '## License\n\n## Documentation');

    expect(checkReleaseDocs(MANIFEST, toFiles(readme, CHANGELOG))).toStrictEqual([
      "README.md doesn't start with the title `# jg-sample`",
      'README.md has no summary between the title and the first section',
      'README.md needs the sections `## Install`, `## Usage`, `## Coming from sample-utils`, `## Documentation`, `## License` once each, in that order',
    ]);
  });
});
