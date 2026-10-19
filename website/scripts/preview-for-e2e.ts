import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';

import { runUntilInputEnds } from '../src/utilities/run-until-input-ends/index.ts';

/*
 * Serves the build on 127.0.0.1 as the end-to-end suite's web server, which playwright.config.ts
 * starts as `node scripts/preview-for-e2e.ts --port <port>`. Playwright stops the server when it
 * exits. When Playwright is killed instead, such as when turbo stops a failed run, the pipe it
 * holds to this script's stdin closes, and the script stops the server, so none is left on the
 * port.
 */

const { values } = parseArgs({ options: { port: { type: 'string' } } });
if (values.port === undefined || !/^\d+$/u.test(values.port)) {
  throw new Error('Pass the port to serve the build on, such as --port 4330.');
}

// astro's command-line entry, run with this Node.js instead of through a shell or a .cmd shim
const astroPackageFile = createRequire(import.meta.url).resolve('astro/package.json');
const { bin } = createRequire(import.meta.url)(astroPackageFile) as { bin: { astro: string } };
const astroEntry = join(dirname(astroPackageFile), bin.astro);

process.exitCode = await runUntilInputEnds(
  process.execPath,
  [astroEntry, 'preview', '--host', '127.0.0.1', '--port', values.port, '--ignore-lock'],
  process.stdin,
);
