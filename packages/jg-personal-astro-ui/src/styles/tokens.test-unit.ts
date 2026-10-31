import { readFile } from 'node:fs/promises';

import { expect, test } from 'vitest';

test('existing public styles forward shared values and retain Astro composition', async () => {
  const theme = await readFile(new URL('theme.css', import.meta.url), 'utf8');
  const contract = await readFile(new URL('contract.css', import.meta.url), 'utf8');
  expect(theme).toContain("@import 'jg-personal-ui/styles/theme.css'");
  expect(theme).toContain("@import './dark-scopes.css'");
  expect(contract).toContain("@import 'jg-personal-ui/styles/contract.css'");
  expect(contract).toContain('@source "../components"');
  expect(theme).not.toMatch(/oklch|fontsource/u);
  expect(theme).toContain('--jg-page-gutter: clamp(1rem, 4vw, 2.5rem)');
  expect(theme).toContain('--jg-prose-width: 46rem');
  expect(theme).toContain('--jg-background: var(--jg-inverse)');
  expect(theme).toContain('--jg-focus: var(--jg-inverse-foreground)');
});
