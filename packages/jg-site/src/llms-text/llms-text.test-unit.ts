import { describe, expect, test } from 'vitest';

import {
  buildLlmsFullText,
  buildLlmsText,
  escapeMarkdownLabel,
  normalizeDescription,
} from './llms-text.js';

describe('buildLlmsText', () => {
  test('writes a section with a Markdown body as it is, after its heading', () => {
    expect(
      buildLlmsText({
        name: 'jg-skills',
        sections: [
          { heading: 'Install', body: '\n```bash\nnpx skills add jesusgraterol/jg-skills\n```\n' },
          {
            heading: 'Skills',
            links: [{ description: 'Plans a change.', title: 'jg-plan', url: '/skills/jg-plan/' }],
          },
        ],
        summary: 'Skills for coding agents.',
      }),
    ).toBe(
      [
        '# jg-skills',
        '> Skills for coding agents.',
        '## Install',
        '```bash\nnpx skills add jesusgraterol/jg-skills\n```',
        '## Skills',
        '- [jg-plan](/skills/jg-plan/): Plans a change.',
      ].join('\n\n') + '\n',
    );
  });

  test('writes the title, the summary, the details, and each section of links', () => {
    expect(
      buildLlmsText({
        details: ['Read the Markdown versions.'],
        name: 'jg-example',
        sections: [
          {
            heading: 'Packages',
            links: [
              { description: 'Errors.', title: 'jg-one', url: 'https://example.dev/one.md' },
              { description: 'Requests.', title: 'jg-two', url: 'https://example.dev/two.md' },
            ],
          },
        ],
        summary: 'Packages for agents.',
      }),
    ).toBe(
      [
        '# jg-example',
        '',
        '> Packages for agents.',
        '',
        'Read the Markdown versions.',
        '',
        '## Packages',
        '',
        '- [jg-one](https://example.dev/one.md): Errors.',
        '- [jg-two](https://example.dev/two.md): Requests.',
        '',
      ].join('\n'),
    );
  });

  test('writes a link without a description, or with a blank one, as its label and URL alone', () => {
    expect(
      buildLlmsText({
        name: 'jg-example',
        sections: [
          {
            heading: 'Docs',
            links: [
              { title: 'Guide', url: 'https://example.dev/guide.md' },
              { description: undefined, title: 'API', url: 'https://example.dev/api.md' },
              { description: ' \n ', title: 'FAQ', url: 'https://example.dev/faq.md' },
              { description: 'Changes.', title: 'Changelog', url: 'https://example.dev/c.md' },
            ],
          },
        ],
        summary: 'Packages for agents.',
      }),
    ).toBe(
      [
        '# jg-example',
        '',
        '> Packages for agents.',
        '',
        '## Docs',
        '',
        '- [Guide](https://example.dev/guide.md)',
        '- [API](https://example.dev/api.md)',
        '- [FAQ](https://example.dev/faq.md)',
        '- [Changelog](https://example.dev/c.md): Changes.',
        '',
      ].join('\n'),
    );
  });
});

describe('buildLlmsFullText', () => {
  test('writes the title and summary, then each document between rules', () => {
    expect(
      buildLlmsFullText({
        documents: ['# jg-one\n\nErrors.\n', '# jg-two\n'],
        name: 'jg-example',
        summary: 'Packages for agents.',
      }),
    ).toBe(
      '# jg-example\n\n> Packages for agents.\n\n---\n\n# jg-one\n\nErrors.\n\n---\n\n# jg-two\n',
    );
  });
});

describe('escapeMarkdownLabel', () => {
  test('escapes brackets and backslashes, so the label stays one label', () => {
    expect(escapeMarkdownLabel('[draft] a\\b')).toBe('\\[draft\\] a\\\\b');
    expect(
      buildLlmsText({
        name: 'x',
        sections: [
          { heading: 'Links', links: [{ description: 'd', title: '[x]', url: 'https://x.dev' }] },
        ],
        summary: 's',
      }),
    ).toContain('- [\\[x\\]](https://x.dev): d');
  });
});

describe('normalizeDescription', () => {
  test('collapses whitespace into single spaces, and trims it', () => {
    expect(normalizeDescription('  Typed stores,\n  for pages\tand workers. ')).toBe(
      'Typed stores, for pages and workers.',
    );
  });
});
