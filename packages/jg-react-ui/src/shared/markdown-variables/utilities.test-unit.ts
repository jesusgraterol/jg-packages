// @vitest-environment node
import { describe, expect, test } from 'vitest';

import {
  createMarkdownVariableToken,
  getEscapedMarkdownVariableMatches,
  getMarkdownVariableMatches,
  normalizeEscapedMarkdownVariableTokens,
  normalizeMarkdownVariableName,
  restoreMarkdownVariableText,
  restoreMarkdownVariableTokens,
} from './utilities.js';

describe('markdown variable utilities', () => {
  test.each([
    ['First name', 'FIRST_NAME'],
    ['project-owner email', 'PROJECT_OWNER_EMAIL'],
    ['{{DUE_DATE}}', 'DUE_DATE'],
    ['', 'VARIABLE_NAME'],
  ])('normalizeMarkdownVariableName(%s) -> %s', (text, expectedName) => {
    expect(normalizeMarkdownVariableName(text)).toBe(expectedName);
  });

  test('createMarkdownVariableToken returns a complete placeholder token', () => {
    expect(createMarkdownVariableToken('Current status')).toBe('{{CURRENT_STATUS}}');
  });

  test.each([
    ['{{FIRST_NAME}}', 'first name'],
    ['{{PROJECT_OWNER_EMAIL}}', 'project owner email'],
    ['{{VERSION_2_STATUS}}', 'version 2 status'],
  ])('restoreMarkdownVariableText(%s) -> %s', (token, expectedText) => {
    expect(restoreMarkdownVariableText(token)).toBe(expectedText);
  });

  test('restoreMarkdownVariableTokens restores each variable in prose', () => {
    expect(restoreMarkdownVariableTokens('Hi {{FIRST_NAME}}, review {{PROJECT_STATUS}}.')).toBe(
      'Hi first name, review project status.',
    );
  });

  test('getMarkdownVariableMatches returns matching tokens with offsets', () => {
    expect(
      getMarkdownVariableMatches('Hi {{FIRST_NAME}}, review {{PROJECT_STATUS}}.'),
    ).toStrictEqual([
      {
        index: 3,
        token: '{{FIRST_NAME}}',
      },
      {
        index: 26,
        token: '{{PROJECT_STATUS}}',
      },
    ]);
  });

  test('getEscapedMarkdownVariableMatches returns escaped tokens with offsets', () => {
    expect(
      getEscapedMarkdownVariableMatches('Hi {{FIRST\\_NAME}}, review {{PROJECT_STATUS}}.'),
    ).toStrictEqual([
      {
        index: 3,
        token: '{{FIRST\\_NAME}}',
      },
      {
        index: 27,
        token: '{{PROJECT_STATUS}}',
      },
    ]);
  });

  test('normalizeEscapedMarkdownVariableTokens only unescapes inside variables', () => {
    expect(
      normalizeEscapedMarkdownVariableTokens(
        'Keep outside\\_escape, but fix {{CAMPAIGN\\_NAME}} and {{LAUNCH\\_DATE}}.',
      ),
    ).toBe('Keep outside\\_escape, but fix {{CAMPAIGN_NAME}} and {{LAUNCH_DATE}}.');
  });
});
