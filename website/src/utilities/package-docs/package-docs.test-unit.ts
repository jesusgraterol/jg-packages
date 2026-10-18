import { describe, expect, test } from 'vitest';

import { selectReadmeSections, selectRecipes } from './package-docs.ts';

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

describe('selectRecipes', () => {
  test('keeps everything after the title: the summary, then the recipes', () => {
    const recipes = [
      '# jg-example recipes',
      '',
      'Patterns for apps that use jg-example.',
      '',
      '## Doing a job',
      '',
      '```ts',
      '# not a title',
      '```',
      '',
    ].join('\n');

    expect(selectRecipes(recipes)).toBe(
      [
        'Patterns for apps that use jg-example.',
        '',
        '## Doing a job',
        '',
        '```ts',
        '# not a title',
        '```',
        '',
      ].join('\n'),
    );
  });

  test('keeps a file without a title as it is', () => {
    expect(selectRecipes('## Doing a job\n\nText.\n')).toBe('## Doing a job\n\nText.\n');
  });
});
