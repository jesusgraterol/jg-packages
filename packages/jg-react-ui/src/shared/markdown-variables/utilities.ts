import { MARKDOWN_VARIABLE_FALLBACK_NAME, MARKDOWN_VARIABLE_PATTERN_SOURCE } from './constants.js';
import type { IMarkdownVariableMatch } from './types.js';

// token-name words are uppercased and joined to satisfy the shared variable pattern.
const MARKDOWN_VARIABLE_NAME_WORD_PATTERN = /[A-Za-z0-9]+/g;

// escaped variable tokens are produced by markdown serializers that protect underscores.
const MARKDOWN_ESCAPED_VARIABLE_PATTERN_SOURCE = String.raw`\{\{[A-Z](?:[A-Z0-9]|\\?_)*\}\}`;

/**
 * Creates a fresh global regular expression for template-variable scanning.
 * @returns A regular expression that matches uppercase `{{VARIABLE_NAME}}` tokens.
 */
export const createMarkdownVariablePattern = (): RegExp =>
  new RegExp(MARKDOWN_VARIABLE_PATTERN_SOURCE, 'g');

/**
 * Creates a fresh global regular expression for escaped template-variable scanning.
 * @returns A regular expression that matches `{{VARIABLE\_NAME}}` and unescaped tokens.
 */
export const createEscapedMarkdownVariablePattern = (): RegExp =>
  new RegExp(MARKDOWN_ESCAPED_VARIABLE_PATTERN_SOURCE, 'g');

/**
 * Finds template-variable tokens and their offsets inside a source string.
 * @param text The source text to scan.
 * @returns The variable tokens found in source order.
 */
export const getMarkdownVariableMatches = (text: string): ReadonlyArray<IMarkdownVariableMatch> =>
  Array.from(text.matchAll(createMarkdownVariablePattern()), (match) => ({
    index: match.index,
    token: match[0],
  }));

/**
 * Finds escaped template-variable tokens and their offsets inside a source string.
 * @param text The source text to scan.
 * @returns The escaped or unescaped variable tokens found in source order.
 */
export const getEscapedMarkdownVariableMatches = (
  text: string,
): ReadonlyArray<IMarkdownVariableMatch> =>
  Array.from(text.matchAll(createEscapedMarkdownVariablePattern()), (match) => ({
    index: match.index,
    token: match[0],
  }));

/**
 * Normalizes user-facing text into an uppercase template-variable name.
 * @param text The selected text or proposed variable label.
 * @returns A variable name that matches the shared `VARIABLE_NAME` convention.
 */
export const normalizeMarkdownVariableName = (text: string): string => {
  const words = text.match(MARKDOWN_VARIABLE_NAME_WORD_PATTERN);

  if (!words) {
    return MARKDOWN_VARIABLE_FALLBACK_NAME;
  }

  return words.map((word) => word.toUpperCase()).join('_');
};

/**
 * Creates a complete template-variable token from user-facing text.
 * @param text The selected text or proposed variable label.
 * @returns A `{{VARIABLE_NAME}}` token.
 */
export const createMarkdownVariableToken = (text: string): string =>
  `{{${normalizeMarkdownVariableName(text)}}}`;

/**
 * Restores a template-variable token into lowercase plain text.
 * @param token The `{{VARIABLE_NAME}}` token to restore.
 * @returns The lowercase text represented by the variable name.
 */
export const restoreMarkdownVariableText = (token: string): string => {
  const variableName = normalizeMarkdownVariableName(token);

  return variableName
    .split('_')
    .map((word) => word.toLowerCase())
    .join(' ');
};

/**
 * Restores every template-variable token inside a larger text string.
 * @param text The source text that may contain template variables.
 * @returns The text with each template variable replaced by readable lowercase text.
 */
export const restoreMarkdownVariableTokens = (text: string): string =>
  text.replace(createMarkdownVariablePattern(), (token) => restoreMarkdownVariableText(token));

/**
 * Removes markdown underscore escapes inside template-variable tokens only.
 * @param text The serialized markdown text to normalize.
 * @returns The markdown text with readable `{{VARIABLE_NAME}}` tokens.
 */
export const normalizeEscapedMarkdownVariableTokens = (text: string): string =>
  text.replace(createEscapedMarkdownVariablePattern(), (token) => token.replaceAll('\\_', '_'));
