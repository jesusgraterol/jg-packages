// @vitest-environment node
import { describe, expect, test } from 'vitest';

import {
  extractFirstMarkdownHeadingName,
  extractSubstitutionPlaceholderNames,
} from './markdown.js';

describe('extractFirstMarkdownHeadingName', () => {
  test.each(['', '  ', '\n', '\t', 'Hello world :)'])(
    'returns null when section is invalid: %j',
    (section) => {
      expect(extractFirstMarkdownHeadingName(section)).toBeNull();
    },
  );

  test('extracts the name from the first h1 heading', () => {
    expect(extractFirstMarkdownHeadingName('# Output format\n\nReturn concise Markdown.')).toBe(
      'Output format',
    );
  });

  test('extracts the name from the first heading regardless of heading level', () => {
    expect(
      extractFirstMarkdownHeadingName(
        [
          'Introductory text before the reusable section.',
          '',
          '### Review criteria',
          '',
          '# Later heading',
        ].join('\n'),
      ),
    ).toBe('Review criteria');
  });

  test('normalizes heading whitespace and trailing closing hashes', () => {
    expect(
      extractFirstMarkdownHeadingName('  ##   C# guidance ###  \n\nKeep inline hashes intact.'),
    ).toBe('C# guidance');
  });

  test('ignores heading-like lines inside fenced code blocks', () => {
    expect(
      extractFirstMarkdownHeadingName(
        ['```markdown', '# Example heading in code', '```', '', '## Runtime context'].join('\n'),
      ),
    ).toBe('Runtime context');
  });

  test('returns null when no markdown heading is found', () => {
    expect(extractFirstMarkdownHeadingName('Plain section content without a heading.')).toBeNull();
  });

  test('returns null when the first markdown heading has no text', () => {
    expect(extractFirstMarkdownHeadingName('###   \n\nBody content.')).toBeNull();
  });
});

describe('extractSubstitutionPlaceholderNames', () => {
  test.each<[unknown]>([[undefined], [null], [{}], [[]], [''], ['  '], ['No placeholders here.']])(
    'returns an empty array when text has no extractable placeholders: %j',
    (text) => {
      expect(extractSubstitutionPlaceholderNames(text as string)).toStrictEqual([]);
    },
  );

  test('extracts placeholder names in first-seen order', () => {
    expect(
      extractSubstitutionPlaceholderNames('Hello, {{name}}! You have {{count}} new messages.'),
    ).toStrictEqual(['name', 'count']);
  });

  test('deduplicates repeated placeholder names', () => {
    expect(
      extractSubstitutionPlaceholderNames(
        'Hello, {{name}}! Your name is {{name}} and you have {{count}} messages.',
      ),
    ).toStrictEqual(['name', 'count']);
  });

  test('supports placeholder names with special characters', () => {
    expect(
      extractSubstitutionPlaceholderNames(
        'User: {{user-name}}. Email: {{user.email}}. Role: {{roles[0]}}. My variable: {{MY_VARIABLE}}. Something: {{ }}',
      ),
    ).toStrictEqual(['user-name', 'user.email', 'roles[0]', 'MY_VARIABLE']);
  });

  test('ignores empty and whitespace-only placeholders', () => {
    expect(
      extractSubstitutionPlaceholderNames('Empty: {{}}. Space: {{ }}. Valid: {{name}}.'),
    ).toStrictEqual(['name']);
  });
});
