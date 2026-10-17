import { parseArgs } from 'node:util';

import { copyAssets } from './utilities.ts';

/*
 * Copies the files matching one glob, relative to `src`, into `dist` for the package the script
 * runs in: `node ../../internal/build-tools/src/copy-assets.ts 'build/templates/*.js'`.
 */
try {
  const { positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {},
    allowPositionals: true,
  });
  const [pattern, ...extra] = positionals;
  if (pattern === undefined || extra.length > 0) {
    throw new Error('Usage: copy-assets.ts <glob relative to src>');
  }
  await copyAssets(process.cwd(), pattern);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
