import { readFile } from 'node:fs/promises';

import { describe, expect, test } from 'vitest';

import { JG_PERSONAL_UI_TOKEN_NAMES } from './index.js';

// the theme's values, and the contract that maps them to Tailwind CSS utilities
const THEME_FILE = new URL('../styles/theme.css', import.meta.url);
const CONTRACT_FILE = new URL('../styles/contract.css', import.meta.url);

// the always-dark surface and the light palette value each one matches
const INVERSE_TOKENS = {
  '--jg-inverse': '--jg-primary',
  '--jg-inverse-foreground': '--jg-primary-foreground',
  '--jg-inverse-accent': '--jg-terminal-accent',
} as const;

/**
 * Reads the value a block of CSS gives a custom property.
 * @param css The CSS.
 * @param name The property, such as --jg-inverse.
 * @returns The value, or undefined when the block doesn't set it.
 */
const readValue = (css: string, name: string): string | undefined =>
  new RegExp(`${name}:\\s*([^;]+);`, 'u').exec(css)?.[1]?.trim();

/**
 * Splits the theme into its light block and the blocks that override it for the dark theme.
 * @param theme The theme's CSS.
 * @returns The light `:root` block and everything after it.
 */
const splitTheme = (theme: string): { dark: string; light: string } => {
  const darkStart = theme.indexOf('\n.dark');
  return { light: theme.slice(0, darkStart), dark: theme.slice(darkStart) };
};

describe('the inverse surface', () => {
  test('keeps dark semantic colors synchronized with the system-preference fallback', async () => {
    const theme = await readFile(THEME_FILE, 'utf8');
    const { dark } = splitTheme(theme);
    const fallback = theme.slice(theme.indexOf('@media (prefers-color-scheme: dark)'));
    for (const token of ['--jg-danger', '--jg-success', '--jg-warning']) {
      const explicit = readValue(dark, token);
      expect(explicit).toBeDefined();
      expect(readValue(fallback, token)).toBe(explicit);
    }
  });
  test('stays dark in both themes, with the light palette values the jg sites already use', async () => {
    const { dark, light } = splitTheme(await readFile(THEME_FILE, 'utf8'));

    for (const [token, source] of Object.entries(INVERSE_TOKENS)) {
      expect(readValue(light, token)).toBeDefined();
      expect(readValue(light, token)).toBe(readValue(light, source));
      // the dark theme and the system dark preference leave it alone, so it never inverts
      expect(readValue(dark, token)).toBeUndefined();
    }
  });

  test('maps each token to a Tailwind CSS colour', async () => {
    const contract = await readFile(CONTRACT_FILE, 'utf8');

    expect(readValue(contract, '--color-inverse')).toBe('var(--jg-inverse)');
    expect(readValue(contract, '--color-inverse-foreground')).toBe('var(--jg-inverse-foreground)');
    expect(readValue(contract, '--color-inverse-accent')).toBe('var(--jg-inverse-accent)');
  });
});

test('the exported semantic token names match the authoritative theme', async () => {
  const theme = await readFile(THEME_FILE, 'utf8');
  const names = [
    ...new Set([...theme.matchAll(/(--jg-[a-z-]+):/gu)].map(([, name]) => name)),
  ].sort();
  expect(JG_PERSONAL_UI_TOKEN_NAMES).toStrictEqual(names);
  expect(theme).not.toContain('--jg-page-gutter');
  expect(theme).not.toContain('.jg-section-inverse');
});
