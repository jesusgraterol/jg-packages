import { readFileSync } from 'node:fs';

import { expect, test } from 'vitest';

import { JG_PERSONAL_UI_TOKEN_NAMES } from './index.js';

// temporary drift check until Astro adopts the shared foundation in this plan
test('shared palette declarations retain the values currently used by Astro', () => {
  const foundation = readFileSync(new URL('../styles/theme.css', import.meta.url), 'utf8');
  const astro = readFileSync(
    new URL('../../../jg-personal-astro-ui/src/styles/theme.css', import.meta.url),
    'utf8',
  );
  const declarations = (source: string) =>
    [...source.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/gu)].map(
      ([, name, value]) => `${name}:${value?.replace(/\s+/gu, ' ').trim()}`,
    );
  const astroDeclarations = new Set(declarations(astro));
  for (const declaration of declarations(foundation))
    expect(astroDeclarations.has(declaration), declaration).toBe(true);
  const declaredNames = [
    ...new Set([...foundation.matchAll(/(--jg-[a-z-]+):/gu)].map(([, name]) => name)),
  ].sort();
  expect(JG_PERSONAL_UI_TOKEN_NAMES).toStrictEqual(declaredNames);
  expect(foundation).not.toContain('--jg-page-gutter');
  expect(foundation).not.toContain('.jg-section-inverse');
  const contract = readFileSync(new URL('../styles/contract.css', import.meta.url), 'utf8');
  const astroContract = readFileSync(
    new URL('../../../jg-personal-astro-ui/src/styles/contract.css', import.meta.url),
    'utf8',
  );
  const astroMappings = new Set(declarations(astroContract));
  for (const mapping of declarations(contract))
    expect(astroMappings.has(mapping), mapping).toBe(true);
});
