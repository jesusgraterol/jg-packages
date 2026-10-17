import type { IApiEntryPoint, IApiSymbol } from '@jg-packages/api-reference';

import { KIND_GROUPS, MAX_SIGNATURE_LINE_LENGTH } from './constants.ts';

// one heading of an entry point's reference, with its symbols
export type ISymbolGroup = {
  heading: string;
  // the group's anchor, unique on the page
  id: string;
  symbols: IApiSymbol[];
};

// brackets that nest inside a signature's parameter list
const OPENING = new Set(['(', '<', '[', '{']);
const CLOSING = new Set([')', '>', ']', '}']);

/**
 * Builds the anchor prefix of an entry point: none for the package itself, or its subpath, such as
 * 'sync-' for './sync', so symbols with the same name in two entry points get different anchors.
 * @param subpath The entry point's exports subpath, such as '.' or './sync'.
 * @returns The prefix.
 */
const toAnchorPrefix = (subpath: string): string =>
  subpath === '.' ? '' : `${subpath.replace(/^\.\//, '').replaceAll(/[^\w-]/g, '-')}-`;

/**
 * Builds the anchor of a symbol, unique on its package's page.
 * @param subpath The entry point's exports subpath.
 * @param name The symbol's name.
 * @returns The anchor, such as 'api-readFile' or 'api-sync-readFile'.
 */
export const toSymbolAnchor = (subpath: string, name: string): string =>
  `api-${toAnchorPrefix(subpath)}${name}`;

/**
 * Builds the specifier an entry point is imported with.
 * @param packageName The package's name.
 * @param subpath The entry point's exports subpath.
 * @returns The specifier, such as 'jg-fs' or 'jg-fs/sync'.
 */
export const toImportSpecifier = (packageName: string, subpath: string): string =>
  subpath === '.' ? packageName : `${packageName}/${subpath.replace(/^\.\//, '')}`;

/**
 * Groups an entry point's symbols by kind, in the reference's order, sorted by name within each.
 * @param entryPoint The entry point.
 * @returns The non-empty groups.
 */
export const groupSymbols = (entryPoint: IApiEntryPoint): ISymbolGroup[] =>
  KIND_GROUPS.map(({ kind, heading }) => ({
    heading,
    id: `api-${toAnchorPrefix(entryPoint.subpath)}${heading.toLowerCase()}`,
    symbols: entryPoint.symbols
      .filter((symbol) => symbol.kind === kind)
      .sort((first, second) => first.name.localeCompare(second.name)),
  })).filter(({ symbols }) => symbols.length > 0);

/**
 * Splits a signature's parameter list at its top-level commas.
 * @param parameters The text between the signature's parentheses.
 * @returns The parameters, trimmed.
 */
const splitParameters = (parameters: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of parameters) {
    if (OPENING.has(character)) {
      depth += 1;
    } else if (CLOSING.has(character) && !(character === '>' && current.endsWith('='))) {
      depth -= 1;
    }
    if (character === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  if (current.trim() !== '') {
    parts.push(current.trim());
  }
  return parts;
};

/**
 * Formats a signature for reading: a long one puts each parameter on its own line.
 * @param text The signature, such as 'request(url: string, options?: IOptions): Promise<T>'.
 * @returns The formatted signature.
 */
export const formatSignature = (text: string): string => {
  if (text.length <= MAX_SIGNATURE_LINE_LENGTH) {
    return text;
  }
  // the parameter list starts at the first parenthesis outside the type parameters
  let depth = 0;
  let start = -1;
  for (let index = 0; index < text.length; index += 1) {
    const character = text.charAt(index);
    if (character === '<') depth += 1;
    if (character === '>') depth -= 1;
    if (character === '(' && depth === 0) {
      start = index;
      break;
    }
  }
  if (start === -1) {
    return text;
  }
  let end = -1;
  depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const character = text.charAt(index);
    if (character === '(') depth += 1;
    if (character === ')') {
      depth -= 1;
      if (depth === 0) {
        end = index;
        break;
      }
    }
  }
  if (end === -1) {
    return text;
  }
  const parameters = splitParameters(text.slice(start + 1, end));
  if (parameters.length === 0) {
    return text;
  }
  return `${text.slice(0, start + 1)}\n${parameters.map((parameter) => `  ${parameter},`).join('\n')}\n${text.slice(end)}`;
};

/**
 * Escapes text for HTML.
 * @param text The text.
 * @returns The escaped text.
 */
const escapeHtml = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/**
 * Renders TSDoc text as HTML paragraphs: backticks become code, line breaks within a paragraph
 * become spaces, and blank lines separate paragraphs.
 * @param text The TSDoc text.
 * @returns The HTML.
 */
export const renderDocText = (text: string): string =>
  text
    .trim()
    .split(/\n\s*\n/)
    .filter((paragraph) => paragraph.trim() !== '')
    .map(
      (paragraph) =>
        `<p>${escapeHtml(paragraph.replaceAll(/\s*\n\s*/g, ' ')).replaceAll(
          /`([^`]+)`/g,
          '<code>$1</code>',
        )}</p>`,
    )
    .join('');

/**
 * Reads a TSDoc example, which is usually a fenced code block.
 * @param markdown The example.
 * @returns Its language and code; TypeScript when it isn't fenced.
 */
export const parseExample = (markdown: string): { lang: string; code: string } => {
  const match = /^\s*```([\w-]*)\n([\s\S]*?)\n?```\s*$/.exec(markdown);
  if (match === null) {
    return { lang: 'ts', code: markdown.trim() };
  }
  return {
    lang: match[1] === undefined || match[1] === '' ? 'ts' : match[1],
    code: match[2] ?? '',
  };
};

/**
 * Splits a `@throws` item into its code and its message, such as 'NOT_FOUND: The file is missing.'.
 * @param item The item.
 * @returns The code, when the item starts with one, and the message.
 */
export const splitThrowsItem = (item: string): { code: string | undefined; message: string } => {
  const match = /^([A-Z][A-Z0-9_]*|\d[\d,]*)\s*:\s*([\s\S]*)$/.exec(item.trim());
  return match === null
    ? { code: undefined, message: item.trim() }
    : { code: match[1], message: match[2] ?? '' };
};
