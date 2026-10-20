import { isStringValid } from '../validations/index.js';

import { extractFenceMarker, extractHeadingName, isClosingFence } from './utilities.js';

/**
 * Extracts the name of the first markdown heading in the given content.
 * @param markdownContent The markdown-formatted content.
 * @returns The first markdown heading text found in the content, or null if none is found.
 * @example
 * import { extractFirstMarkdownHeadingName } from 'jg-utilities';
 *
 * extractFirstMarkdownHeadingName('Intro\n\n## Getting started\n\nText'); // => 'Getting started'
 */
export const extractFirstMarkdownHeadingName = (markdownContent: string): string | null => {
  if (!isStringValid(markdownContent)) {
    return null;
  }

  let openingFenceMarker: string | null = null;
  let firstHeadingName: string | null = null;

  markdownContent.split(/\r\n|\r|\n/).some((line) => {
    if (openingFenceMarker !== null) {
      if (isClosingFence(line, openingFenceMarker)) {
        openingFenceMarker = null;
      }

      return false;
    }

    const fenceMarker = extractFenceMarker(line);

    if (fenceMarker !== null) {
      openingFenceMarker = fenceMarker;
      return false;
    }

    firstHeadingName = extractHeadingName(line);
    return firstHeadingName !== null;
  });

  return firstHeadingName;
};

/**
 * Extracts the names of substitution placeholders in the given text.
 * @param text The text containing substitution placeholders.
 * @returns An array of substitution placeholder names.
 * @example
 * import { extractSubstitutionPlaceholderNames } from 'jg-utilities';
 *
 * extractSubstitutionPlaceholderNames('Hi {{name}}, you have {{count}} messages, {{name}}.'); // => ['name', 'count']
 */
export const extractSubstitutionPlaceholderNames = (text: string): string[] => {
  // ensure the string is valid before attempting to extract the variables
  if (!isStringValid(text)) {
    return [];
  }

  // extract the variables (if any)
  const pattern = /{{(.*?)}}/g;
  const variables = new Set<string>();

  for (const match of text.matchAll(pattern)) {
    const variableName = match[1];

    if (isStringValid(variableName)) {
      variables.add(variableName);
    }
  }

  return [...variables];
};

/**
 * Escapes text for one line of Markdown, such as a heading or a table cell, so the text shows as
 * written: it puts a backslash before each backslash, backtick, `*`, `_`, `{`, `}`, `[`, `]`, `<`,
 * `>`, and `|`, which stops code, emphasis, links, inline HTML, and table pipes, and turns each line
 * break and control character into a space, so the text stays on its line.
 * @param text The text.
 * @returns The escaped text.
 * @example
 * import { escapeMarkdownInline } from 'jg-utilities';
 *
 * escapeMarkdownInline('*bold* <b>x</b> | [link](u)'); // => '\\*bold\\* \\<b\\>x\\</b\\> \\| \\[link\\](u)'
 * escapeMarkdownInline('two\r\nlines'); // => 'two lines'
 */
export const escapeMarkdownInline = (text: string): string =>
  text.replace(/[\\`*_{}[\]<>|]/gu, '\\$&').replace(/\r\n|\p{Cc}/gu, ' ');
