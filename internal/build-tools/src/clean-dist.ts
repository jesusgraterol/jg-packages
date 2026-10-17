import { parseArgs } from 'node:util';

import { cleanDist } from './utilities.ts';

/*
 * Removes the `dist` directory of the package the script runs in. Package scripts run it as
 * `node ../../internal/build-tools/src/clean-dist.ts`, so the working directory is the package.
 */
try {
  parseArgs({ args: process.argv.slice(2), options: {} });
  await cleanDist(process.cwd());
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
