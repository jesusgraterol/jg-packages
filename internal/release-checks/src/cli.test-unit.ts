import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

// static import and re-export specifiers; dynamic `import()` calls are deliberately not matched
const STATIC_IMPORT = /^\s*(?:import|export)\s(?:[^'"]*?\sfrom\s)?['"]([^'"]+)['"]/gm;

/**
 * Collects every static import specifier reachable from a file, following relative imports.
 * @param file The starting file.
 * @param visited Files already read.
 * @returns A promise that resolves to the non-relative specifiers, by importing file.
 */
const collectExternalImports = async (
  file: string,
  visited = new Set<string>(),
): Promise<string[]> => {
  if (visited.has(file)) {
    return [];
  }
  visited.add(file);
  const source = await readFile(file, 'utf8');
  const external: string[] = [];
  for (const [, specifier] of source.matchAll(STATIC_IMPORT)) {
    if (specifier === undefined) {
      continue;
    }
    if (specifier.startsWith('.')) {
      external.push(...(await collectExternalImports(join(dirname(file), specifier), visited)));
    } else {
      external.push(`${file.slice(import.meta.dirname.length + 1)} -> ${specifier}`);
    }
  }
  return external;
};

describe('the publish and tag import graph', () => {
  test.each([['cli.ts'], ['publish/publish.ts'], ['tag/tag.ts']])(
    '%s statically imports only Node.js built-ins, because the publish and tag jobs install nothing',
    async (file) => {
      const external = await collectExternalImports(join(import.meta.dirname, file));

      expect(
        external.filter((entry) => !entry.endsWith(' -> node:') && !/ -> node:/.test(entry)),
      ).toStrictEqual([]);
      expect(external.length).toBeGreaterThan(0);
    },
  );

  test('the import scan sees non-built-in imports', async () => {
    const external = await collectExternalImports(
      join(import.meta.dirname, 'checks', 'registry-versions.ts'),
    );

    expect(external).toContain('checks/registry-versions.ts -> semver');
  });
});
