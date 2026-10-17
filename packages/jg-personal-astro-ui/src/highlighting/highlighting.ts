import {
  createCssVariablesTheme,
  createHighlighter,
  type BundledLanguage,
  type Highlighter,
  type ThemedToken,
} from 'shiki';

// the theme every highlighted block uses: each token's colour is a --jg-syntax-* variable
export const SYNTAX_THEME = createCssVariablesTheme({
  name: 'jg-syntax',
  variablePrefix: '--jg-syntax-',
  variableDefaults: {},
  fontStyle: true,
});

// the languages the highlighter loads; anything else renders as plain text
const LANGUAGES = [
  'astro',
  'bash',
  'css',
  'diff',
  'html',
  'javascript',
  'json',
  'jsx',
  'markdown',
  'shellscript',
  'tsx',
  'typescript',
  'yaml',
] as const satisfies readonly BundledLanguage[];

// the aliases code fences and props use for the loaded languages
const ALIASES: Record<string, (typeof LANGUAGES)[number]> = {
  js: 'javascript',
  md: 'markdown',
  sh: 'bash',
  shell: 'bash',
  ts: 'typescript',
  yml: 'yaml',
  zsh: 'bash',
};

// created on the first highlight and shared by every block of the build
let highlighter: Promise<Highlighter> | undefined;

/**
 * Returns the shared highlighter, creating it on the first call.
 * @returns A promise that resolves to the highlighter.
 */
const getHighlighter = (): Promise<Highlighter> => {
  highlighter ??= createHighlighter({ themes: [SYNTAX_THEME], langs: [...LANGUAGES] });
  return highlighter;
};

/**
 * Maps a language name or alias to a loaded language, or to plain text.
 * @param language The language, such as 'ts' or 'typescript'.
 * @returns The loaded language, or 'text'.
 */
export const toSupportedLanguage = (language: string): string => {
  const normalized = language.trim().toLowerCase();
  if ((LANGUAGES as readonly string[]).includes(normalized)) {
    return normalized;
  }
  return ALIASES[normalized] ?? 'text';
};

/**
 * Highlights code as HTML: a pre element whose tokens are coloured with --jg-syntax-* variables.
 * @param code The code.
 * @param language The language, such as 'ts'.
 * @returns A promise that resolves to the HTML.
 */
export const highlightToHtml = async (code: string, language: string): Promise<string> =>
  (await getHighlighter()).codeToHtml(code.replace(/\n$/, ''), {
    lang: toSupportedLanguage(language),
    theme: SYNTAX_THEME,
  });

/**
 * Highlights code line by line, for views that arrange lines themselves, such as a diff.
 * @param code The code.
 * @param language The language, such as 'ts'.
 * @returns A promise that resolves to each line's tokens.
 */
export const highlightToLines = async (code: string, language: string): Promise<ThemedToken[][]> =>
  (await getHighlighter()).codeToTokensBase(code.replace(/\n$/, ''), {
    lang: toSupportedLanguage(language) as BundledLanguage,
    theme: SYNTAX_THEME,
  });

/**
 * Escapes text for HTML.
 * @param text The text.
 * @returns The escaped text.
 */
export const escapeHtml = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/**
 * Renders one highlighted line's tokens as HTML spans.
 * @param tokens The line's tokens.
 * @returns The HTML.
 */
export const renderLineTokens = (tokens: readonly ThemedToken[]): string =>
  tokens
    .map(({ color, content }) =>
      color === undefined
        ? escapeHtml(content)
        : `<span style="color:${escapeHtml(color)}">${escapeHtml(content)}</span>`,
    )
    .join('');
