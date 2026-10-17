import { describe, expect, test } from 'vitest';

import { selectReadmeSections } from './package-readme.ts';

describe('selectReadmeSections', () => {
  test('keeps the sections after the title and summary, except the ones shown elsewhere', () => {
    const readme = [
      '# jg-example',
      '',
      'The summary.',
      '',
      '## Install',
      '',
      '```bash',
      'npm install jg-example',
      '```',
      '',
      '## Usage',
      '',
      'Use it.',
      '',
      '### Details',
      '',
      'More.',
      '',
      '## Browser support',
      '',
      '| Browser | Version |',
      '',
      '## Documentation',
      '',
      'A link.',
      '',
      '## License',
      '',
      'MIT',
      '',
    ].join('\n');

    expect(selectReadmeSections(readme)).toBe(
      [
        '## Usage',
        '',
        'Use it.',
        '',
        '### Details',
        '',
        'More.',
        '',
        '## Browser support',
        '',
        '| Browser | Version |',
        '',
      ].join('\n'),
    );
  });

  test('ignores headings inside code blocks', () => {
    const readme = [
      '# jg-example',
      '',
      '## Usage',
      '',
      '````markdown',
      '## License',
      '```ts',
      'code();',
      '```',
      '````',
      '',
      'After the block.',
      '',
      '~~~md',
      '## Install',
      '~~~',
      '',
      '## License',
      '',
      'MIT',
    ].join('\n');

    expect(selectReadmeSections(readme)).toBe(
      [
        '## Usage',
        '',
        '````markdown',
        '## License',
        '```ts',
        'code();',
        '```',
        '````',
        '',
        'After the block.',
        '',
        '~~~md',
        '## Install',
        '~~~',
        '',
      ].join('\n'),
    );
  });

  test('returns an empty document for a README with only the dropped sections', () => {
    expect(selectReadmeSections('# jg-example\n\nSummary.\n\n## Install\n\nnpm i\n')).toBe('\n');
  });
});
