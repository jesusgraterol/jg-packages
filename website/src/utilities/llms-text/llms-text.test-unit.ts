import { describe, expect, test } from 'vitest';

import { buildLlmsFullText, buildLlmsText } from './llms-text.ts';

describe('buildLlmsText', () => {
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
