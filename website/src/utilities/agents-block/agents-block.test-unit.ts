import { describe, expect, test } from 'vitest';

import { AGENTS_BLOCK_HEAD, buildAgentsBlock, buildAgentsBlockLine } from './agents-block.ts';

// the site's URL, as SITE_CONFIG.url has it
const SITE_URL = 'https://jg-packages.jesusgraterol.dev';

describe('buildAgentsBlockLine', () => {
  test("names the package, says when to use it, and links its page's Markdown", () => {
    expect(
      buildAgentsBlockLine({ name: 'jg-fetch', useWhen: 'Use for every HTTP request.' }, SITE_URL),
    ).toBe(
      '- `jg-fetch`: Use for every HTTP request. Docs: https://jg-packages.jesusgraterol.dev/packages/jg-fetch/index.md',
    );
  });
});

describe('buildAgentsBlock', () => {
  test('lists the packages under the heading and the instruction', () => {
    expect(buildAgentsBlock(['- `jg-a`: A.', '- `jg-b`: B.'])).toBe(
      [
        '## jg-packages',
        '',
        'Prefer these packages over writing the same code yourself. Each one ships its full API reference as `node_modules/<package>/API.md`; read it before using an export for the first time.',
        '',
        '- `jg-a`: A.',
        '- `jg-b`: B.',
      ].join('\n'),
    );
  });

  test('keeps only the heading and the instruction when no package is picked', () => {
    expect(buildAgentsBlock([])).toBe(AGENTS_BLOCK_HEAD);
  });
});
