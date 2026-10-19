import { REDACTED_VALUE } from 'jg-exception';

import { PRIVATE_KEY_BOUNDARY_PATTERN, SECRET_TOKEN_PATTERNS } from './constants.js';
import type { IRedactSecretsOptions, IRedactSecretsResult } from './types.js';

/**
 * Removes a URL's query and fragment when the query holds any of the named parameters, such as a
 * token, so the URL can be logged. A name matches exactly, after decoding, or as the start of an
 * array parameter, such as `token[]`. A name that can't be decoded could hide one of them, so the
 * whole URL becomes `[redacted]`, as does a URL that is only a query.
 * @param url The request target or absolute URL.
 * @param names The names of the parameters that make the query unsafe to log.
 * @returns The URL when it holds none of them, otherwise the part before its query.
 * @example
 * import { redactUrlQueryParams } from 'jg-utilities';
 *
 * redactUrlQueryParams('/reset?token=abc#form', ['token']); // => '/reset'
 * redactUrlQueryParams('/reset?tok%65n=abc', ['token']); // => '/reset'
 * redactUrlQueryParams('/search?q=shoes', ['token']); // => '/search?q=shoes'
 */
export const redactUrlQueryParams = (url: string, names: readonly string[]): string => {
  const queryStartIndex = url.indexOf('?');
  const fragmentStartIndex = url.indexOf('#');
  if (
    queryStartIndex === -1 ||
    (fragmentStartIndex !== -1 && fragmentStartIndex < queryStartIndex)
  ) {
    return url;
  }
  const queryEndIndex = fragmentStartIndex === -1 ? url.length : fragmentStartIndex;
  for (const parameter of url.slice(queryStartIndex + 1, queryEndIndex).split('&')) {
    const separatorIndex = parameter.indexOf('=');
    const encodedName = separatorIndex === -1 ? parameter : parameter.slice(0, separatorIndex);
    let name: string;
    try {
      name = decodeURIComponent(encodedName.replaceAll('+', ' '));
    } catch {
      return REDACTED_VALUE;
    }
    if (names.some((unsafeName) => name === unsafeName || name.startsWith(`${unsafeName}[`))) {
      return url.slice(0, queryStartIndex) || REDACTED_VALUE;
    }
  }
  return url;
};

/**
 * Replaces each complete private key block in one pass over the text. A block runs from its first
 * BEGIN line to the next END line, even when another BEGIN or a different key type comes between.
 * An END without a BEGIN is left as it is, and so is a block that never ends.
 * @param text The text to scan.
 * @param replace Gives each block's replacement, and whether the block ends the text.
 * @returns The text with every complete block replaced.
 */
const redactPrivateKeys = (
  text: string,
  replace: (block: string, isAtEnd: boolean) => string,
): string => {
  const spans: string[] = [];
  let blockStart: number | undefined;
  let copiedThrough = 0;
  for (const boundary of text.matchAll(PRIVATE_KEY_BOUNDARY_PATTERN)) {
    if (boundary[1] === 'BEGIN') {
      blockStart ??= boundary.index;
    } else if (blockStart !== undefined) {
      const blockEnd = boundary.index + boundary[0].length;
      spans.push(
        text.slice(copiedThrough, blockStart),
        replace(text.slice(blockStart, blockEnd), blockEnd === text.length),
      );
      copiedThrough = blockEnd;
      blockStart = undefined;
    }
  }
  if (copiedThrough === 0) {
    return text;
  }
  spans.push(text.slice(copiedThrough));
  return spans.join('');
};

/**
 * Replaces the secrets in free text, such as a log line or a file headed for an AI model: complete
 * PEM private key blocks first, then every match of the token patterns, which default to
 * `SECRET_TOKEN_PATTERNS`. It runs in linear time over the key blocks, matches each pattern
 * globally whatever its flags, and never throws for any text, so a logger can call it safely.
 *
 * With `preserveLineBreaks`, a private key becomes the replacement followed by its line breaks, or
 * preceded by them when it ends the text, so line numbers in the text stay the same.
 * @param text The text to redact.
 * @param options The patterns, the replacement, and whether key blocks keep their line breaks.
 * @returns The redacted text, and how many secrets were replaced.
 * @example
 * import { redactSecrets } from 'jg-utilities';
 *
 * redactSecrets('auth: ghp_abcdefghijklmnopqrstuvwxyz'); // => { text: 'auth: [redacted]', count: 1 }
 * redactSecrets('port: 3000'); // => { text: 'port: 3000', count: 0 }
 */
export const redactSecrets = (
  text: string,
  {
    patterns = SECRET_TOKEN_PATTERNS,
    replacement = REDACTED_VALUE,
    preserveLineBreaks = false,
  }: IRedactSecretsOptions = {},
): IRedactSecretsResult => {
  let count = 0;
  const replace = (secret: string, isAtEnd: boolean): string => {
    count += 1;
    if (!preserveLineBreaks) {
      return replacement;
    }
    const lineBreaks = secret.replace(/[^\r\n]/gu, '');
    return isAtEnd ? `${lineBreaks}${replacement}` : `${replacement}${lineBreaks}`;
  };
  let redacted = redactPrivateKeys(text, replace);
  for (const pattern of patterns) {
    // a copy, so the caller's pattern keeps its lastIndex, and every match is replaced
    const globalPattern = new RegExp(
      pattern.source,
      pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`,
    );
    redacted = redacted.replace(globalPattern, (secret) => replace(secret, false));
  }
  return { text: redacted, count };
};
