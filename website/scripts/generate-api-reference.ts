import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { extractApiReference, findUndocumentedSymbols } from '@jg-packages/api-reference';

import { PACKAGE_CATALOG, PACKAGES_DIRECTORY } from '../src/site.config.ts';

/*
 * The website's generate task: extracts every listed package's API with TypeDoc into
 * src/generated/api/<name>.json, which the package pages render. It fails when an export has no
 * TSDoc, the same rule release:verify applies.
 */

// where the reference files go; the directory is git-ignored
const OUTPUT_DIRECTORY = join(import.meta.dirname, '..', 'src', 'generated', 'api');

try {
  await rm(OUTPUT_DIRECTORY, { recursive: true, force: true });
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  const problems: string[] = [];
  for (const name of Object.keys(PACKAGE_CATALOG)) {
    const reference = await extractApiReference(join(PACKAGES_DIRECTORY, name));
    for (const symbol of findUndocumentedSymbols(reference)) {
      problems.push(
        `${name}${symbol.subpath === '.' ? '' : symbol.subpath.slice(1)} exports the ${symbol.kind} ${symbol.name} without ${symbol.missing.join(' or ')}`,
      );
    }
    await writeFile(
      join(OUTPUT_DIRECTORY, `${name}.json`),
      `${JSON.stringify(reference, null, 2)}\n`,
    );
    console.log(`Generated the API reference of ${name}@${reference.version}`);
  }
  if (problems.length > 0) {
    throw new Error(`Some exports have no TSDoc:\n- ${problems.join('\n- ')}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
