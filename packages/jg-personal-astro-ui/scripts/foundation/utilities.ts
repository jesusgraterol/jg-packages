/**
 * Reuses the canonical dark declarations for Astro's existing code and inverse surface scopes.
 * @param theme The shared foundation stylesheet.
 * @returns Generated CSS with no independently authored palette values.
 * @throws
 * - The shared foundation must expose exactly two supported dark declaration blocks.
 */
export const renderDarkScopes = (theme: string): string => {
  const blocks = [...theme.replace(/\r\n/g, '\n').matchAll(/^\.dark\s*\{([^{}]*)\}/gmu)];
  const palette = blocks[0]?.[1];
  const syntax = blocks[1]?.[1];
  if (
    blocks.length !== 2 ||
    palette === undefined ||
    syntax === undefined ||
    !palette.includes('--jg-background:') ||
    !syntax.includes('--jg-syntax-foreground:')
  ) {
    throw new Error(
      'The shared foundation must expose exactly two supported dark declaration blocks.',
    );
  }
  return (
    '/* Generated from jg-personal-ui/styles/theme.css by foundation:generate. */\n' +
    `.jg-section-inverse {${palette}}\n\n` +
    `.jg-code-window,\n.jg-section-inverse {${syntax}}\n`
  );
};
