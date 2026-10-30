import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { assertNoLinksBelow, pathExists, readBoundedFile, writeFileAtomicIfUnchanged } from 'jg-fs';
import { JG_FAVICON_PATHS, JG_MARK_PATHS } from 'jg-personal-ui/brand';

import { renderBrandSvg } from './utilities.ts';

// the two small, fixed assets share one canonical geometry definition
const ASSETS = [
  ['jg-mark.svg', JG_MARK_PATHS],
  ['jg-favicon.svg', JG_FAVICON_PATHS],
] as const;
const PACKAGE_DIRECTORY = resolve(import.meta.dirname, '../..');
const MAX_ASSET_BYTES = 8192;

/**
 * Checks committed artwork or regenerates it atomically from the canonical constants.
 * @returns A promise that resolves after checking or writing both files; exit codes distinguish stale output (1) from a failed check (2).
 */
const main = async (): Promise<void> => {
  try {
    const { values } = parseArgs({ options: { check: { type: 'boolean', default: false } } });
    const assets = await Promise.all(
      ASSETS.map(async ([name, paths]) => {
        const path = resolve(PACKAGE_DIRECTORY, 'src/assets', name);
        await assertNoLinksBelow(PACKAGE_DIRECTORY, path);
        const before = (await pathExists(path))
          ? await readBoundedFile(path, MAX_ASSET_BYTES)
          : null;
        return { path, before, contents: renderBrandSvg(paths) };
      }),
    );
    for (const { path, before, contents } of assets) {
      if (before?.toString('utf8') === contents) continue;
      if (values.check) {
        process.stderr.write(
          'Brand assets are stale. Run pnpm --filter jg-personal-ui brand:generate.\n',
        );
        process.exitCode = 1;
        return;
      }
      await writeFileAtomicIfUnchanged(path, contents, before);
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 2;
  }
};

await main();
