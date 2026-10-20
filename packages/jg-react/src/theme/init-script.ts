import { Exception } from 'jg-exception';
import { type IThemePreference, THEME_PREFERENCES } from 'jg-site';

import { ERRORS } from '../shared/index.js';

import { DARK_COLOR_SCHEME_QUERY } from './constants.js';
import type { IThemeInitScriptOptions } from './types.js';

/**
 * Writes a string as a JavaScript string literal that's safe inside a `<script>` element: `<`,
 * `>`, `&`, and the line and paragraph separators are escaped, so a value can't close the element.
 * @param value The string.
 * @returns The literal.
 */
const toScriptLiteral = (value: string): string =>
  JSON.stringify(value)
    .replaceAll('<', '\\u003C')
    .replaceAll('>', '\\u003E')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');

/**
 * Checks whether a value is a theme preference.
 * @param value The value.
 * @returns Whether it's one.
 */
const isThemePreference = (value: unknown): value is IThemePreference =>
  (THEME_PREFERENCES as readonly unknown[]).includes(value);

/**
 * Checks whether a value is a non-empty string.
 * @param value The value.
 * @returns Whether it is.
 */
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

/**
 * Builds the inline script that applies the stored theme before the page paints, so a server
 * render doesn't flash the wrong theme. It reads the preference from localStorage, as JSON or as
 * a raw string, from a field of a stored object when `field` is given, falls back to
 * `defaultPreference` when it's missing or invalid, and sets the `light` or `dark` class on
 * `<html>`. Storage that can't be read and a browser without matchMedia never make it throw.
 *
 * Render it at the top of `<head>`, with your CSP nonce, as
 * `<script nonce={nonce} dangerouslySetInnerHTML={{ __html: script }} />`. Its output is the same
 * for the same options, so a hash-based CSP works too. A jg-storage store's key is
 * `jg-storage:<id>`. Set `color-scheme` per class in your stylesheet.
 * @param options The localStorage key, and optionally the field and the default preference.
 * @returns The script's source.
 * @example
 * import { createThemeInitScript } from 'jg-react';
 *
 * const script = createThemeInitScript({ storageKey: 'jg-storage:preferences', field: 'theme' });
 * @throws
 * - INVALID_THEME_SCRIPT_OPTIONS: The theme script needs a non-empty storage key, a non-empty field when one is given, and a valid default preference.
 */
export const createThemeInitScript = ({
  storageKey,
  field,
  defaultPreference = 'system',
}: IThemeInitScriptOptions): string => {
  if (
    !isNonEmptyString(storageKey) ||
    (field !== undefined && !isNonEmptyString(field)) ||
    !isThemePreference(defaultPreference)
  ) {
    throw new Exception(
      'The theme script needs a non-empty storage key, a non-empty field when one is given, and a valid default preference.',
      { code: ERRORS.INVALID_THEME_SCRIPT_OPTIONS },
    );
  }
  return [
    '(function(){',
    `var key=${toScriptLiteral(storageKey)};`,
    `var field=${field === undefined ? 'null' : toScriptLiteral(field)};`,
    `var preference=${toScriptLiteral(defaultPreference)};`,
    "var isPreference=function(value){return value==='light'||value==='dark'||value==='system';};",
    'try{',
    'var stored=window.localStorage.getItem(key);',
    'if(stored!==null){',
    'var value;',
    'try{value=JSON.parse(stored);}catch(error){value=stored;}',
    "if(field!==null){value=value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.prototype.hasOwnProperty.call(value,field)?value[field]:undefined;}",
    'if(isPreference(value)){preference=value;}',
    '}',
    '}catch(error){}',
    `var isDark=preference==='dark'||(preference==='system'&&typeof window.matchMedia==='function'&&window.matchMedia(${toScriptLiteral(DARK_COLOR_SCHEME_QUERY)}).matches);`,
    'var root=document.documentElement;',
    "root.classList.remove('light','dark');",
    "root.classList.add(isDark?'dark':'light');",
    '})();',
  ].join('');
};
