import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { extractMessage } from 'jg-exception';
import { assertNoLinksBelow, pathExists, readBoundedFile, writeFileAtomicIfUnchanged } from 'jg-fs';

import { renderDarkScopes } from './utilities.ts';

const PACKAGE_DIRECTORY = resolve(import.meta.dirname, '../..');
const MAX_SOURCE_BYTES = 8192;

/**
 * Checks or regenerates Astro's derived styles and compatibility SVG paths from the foundation.
 * @returns A promise that resolves after checking or writing; exit code 1 means stale output and 2 means the operation failed.
 */
const main = async (): Promise<void> => {
  try {
    const { values } = parseArgs({ options: { check: { type: 'boolean', default: false } } });
    const readFoundationEntry = async (entry: string): Promise<string> =>
      (
        await readBoundedFile(
          fileURLToPath(import.meta.resolve(`jg-personal-ui/${entry}`)),
          MAX_SOURCE_BYTES,
        )
      )
        .toString('utf8')
        .replace(/\r\n/g, '\n');
    const [theme, mark, favicon] = await Promise.all([
      readFoundationEntry('styles/theme.css'),
      readFoundationEntry('jg-mark.svg'),
      readFoundationEntry('jg-favicon.svg'),
    ]);
    const outputs = [
      ['src/styles/dark-scopes.css', renderDarkScopes(theme)],
      ['src/components/jg-mark/jg-mark.svg', mark],
      ['src/components/jg-mark/jg-favicon.svg', favicon],
    ] as const;
    const assets = await Promise.all(
      outputs.map(async ([name, contents]) => {
        const path = resolve(PACKAGE_DIRECTORY, name);
        await assertNoLinksBelow(PACKAGE_DIRECTORY, path);
        const before = (await pathExists(path))
          ? await readBoundedFile(path, MAX_SOURCE_BYTES)
          : null;
        return { path, before, contents };
      }),
    );
    for (const { path, before, contents } of assets) {
      if (before?.toString('utf8').replace(/\r\n/g, '\n') === contents) continue;
      if (values.check) {
        process.stderr.write(
          'Astro foundation assets are stale. Run pnpm --filter jg-personal-astro-ui foundation:generate.\n',
        );
        process.exitCode = 1;
        return;
      }
      await writeFileAtomicIfUnchanged(path, contents, before);
    }
  } catch (error) {
    process.stderr.write(
      `Unable to synchronize Astro foundation assets: ${extractMessage(error)}\n`,
    );
    process.exitCode = 2;
  }
};

await main();
