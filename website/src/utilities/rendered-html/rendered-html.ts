/*
 * Reading rendered HTML the way browsers do, to find event handlers and URLs with a scheme that
 * could run script. Ported from jg-skills' website.
 */

// named character references the site's renderers emit; any other one is left as written
const NAMED_HTML_ENTITIES = { amp: '&', apos: "'", gt: '>', lt: '<', quot: '"' } as const;

// attributes a browser follows as a URL, where a script scheme would run code
const URL_ATTRIBUTES = new Set(['action', 'formaction', 'href', 'src', 'xlink:href']);

// the URL schemes a page may link to; relative URLs carry no scheme at all
const SAFE_URL_SCHEMES = new Set(['http', 'https', 'mailto']);

// one start or end tag at the current position; a quoted value is read whole, so a < or > in it
// does not end the tag
const TAG_PATTERN = /<\/?([a-zA-Z][^\s/>]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/uy;

// one tag at the current position read to its first >, for markup the pattern above cannot read
const LOOSE_TAG_PATTERN = /<\/?([a-zA-Z][^\s/>]*)([^>]*)>/uy;

// one attribute and its value, also when a slash or nothing separates it from the one before, as
// browsers read them
const ATTRIBUTE_PATTERN = /([^\s"'=<>/`]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/gu;

// script and style bodies, whose text is code rather than markup
const SCRIPT_OR_STYLE_PATTERN = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/giu;

// the highest Unicode code point; browsers read a reference beyond it as the replacement character
const MAX_CODE_POINT = 0x10ffff;

/** Converts a numeric character reference to its character, as browsers do. */
const decodeCodePoint = (codePoint: number): string =>
  codePoint > MAX_CODE_POINT ? '\uFFFD' : String.fromCodePoint(codePoint);

/**
 * Decodes HTML character references, so text and URLs are judged as browsers read them.
 * @param input Text that may contain decimal, hexadecimal, or common named character references.
 * @returns The text with those references decoded; other named references are left as written.
 */
export const decodeHtmlEntities = (input: string): string =>
  input.replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|quot);/giu, (_match, entity: string) => {
    if (/^#x/iu.test(entity)) return decodeCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith('#')) return decodeCodePoint(Number.parseInt(entity.slice(1), 10));

    return NAMED_HTML_ENTITIES[entity.toLowerCase() as keyof typeof NAMED_HTML_ENTITIES];
  });

/**
 * Decides whether a URL attribute value could run script when followed.
 * @param value The attribute value as written in the HTML.
 * @returns True for any scheme other than http, https, and mailto, and for a value whose scheme
 * part still holds a character reference, which a browser could decode into a script scheme.
 */
export const isUnsafeUrl = (value: string): boolean => {
  // browsers drop tabs and line breaks anywhere in a URL, and controls and spaces at its ends,
  // before they read the scheme
  const url = decodeHtmlEntities(value)
    .replace(/[\t\n\r]/gu, '')
    .replace(/^[\p{Cc} ]+|[\p{Cc} ]+$/gu, '');
  const head = url.split(/[/?#]/u, 1)[0] ?? '';

  if (head.includes('&')) return true;

  const scheme = /^([a-z][a-z\d+.-]*):/iu.exec(head)?.[1]?.toLowerCase();

  return scheme !== undefined && !SAFE_URL_SCHEMES.has(scheme);
};

/** Removes the quotes around an attribute value, when it has them. */
const unquote = (value: string): string =>
  /^(["']).*\1$/su.test(value) ? value.slice(1, -1) : value;

/**
 * Finds the first event-handler attribute or unsafe URL in one tag's attribute text.
 * @param attributes The text between a tag's name and its closing bracket.
 * @returns A short description of the problem, or undefined when the attributes are safe.
 */
const findUnsafeAttribute = (attributes: string): string | undefined => {
  for (const [, name = '', value = ''] of attributes.matchAll(ATTRIBUTE_PATTERN)) {
    const attributeName = name.toLowerCase();

    if (attributeName.startsWith('on')) return `${attributeName} attribute`;
    if (URL_ATTRIBUTES.has(attributeName) && isUnsafeUrl(unquote(value))) {
      return `${attributeName}=${value}`;
    }
  }

  return undefined;
};

/**
 * Finds the first event handler or unsafe URL anywhere in a page's markup, ignoring the code
 * inside its script and style elements.
 * @param html A complete HTML page or fragment.
 * @returns A short description of the problem, or undefined when none is found.
 */
export const findUnsafeAttributes = (html: string): string | undefined => {
  const markup = html.replace(SCRIPT_OR_STYLE_PATTERN, '');

  for (let index = markup.indexOf('<'); index !== -1; index = markup.indexOf('<', index + 1)) {
    TAG_PATTERN.lastIndex = index;
    LOOSE_TAG_PATTERN.lastIndex = index;

    const tag = TAG_PATTERN.exec(markup) ?? LOOSE_TAG_PATTERN.exec(markup);

    if (!tag) continue;

    const problem = findUnsafeAttribute(tag[2] ?? '');

    if (problem !== undefined) return problem;

    // continue after the tag, so a < inside one of its attribute values is not read as a tag
    index += tag[0].length - 1;
  }

  return undefined;
};
