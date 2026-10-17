#!/usr/bin/env node
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { extractMessage } from 'jg-exception';

import { readServiceWorkerConfig, writeServiceWorker } from '../build/index.js';
import { DEFAULT_CONFIG_FILE_NAME } from '../build/shared/index.js';
import type { IServiceWorkerEnvironment } from '../build/shared/index.js';

// what `jg-sw --help` prints
const HELP = `Usage: jg-sw [options]

Generates the service worker a jg-sw config describes, and writes it to sw.js in the config's
outDir. Run it after the app's build.

Options:
  --config <path>        The config file. Defaults to ${DEFAULT_CONFIG_FILE_NAME}.
  --environment <name>   development, staging, or production: the environment whose file
                         (.env, .env.staging, or .env.production) holds the Firebase config of
                         the firebase-fcm template.
  --no-caching           Generates a worker without precaching, cache cleanup, or a fetch
                         handler, for development.
  --help                 Prints this message.
`;

/**
 * Runs the CLI with its arguments: prints the help, or writes the worker and prints its path.
 * @param args The arguments, without the executable and script paths.
 * @returns A promise that resolves once the CLI is done.
 */
const run = async (args: string[]): Promise<void> => {
  const { values } = parseArgs({
    args,
    strict: true,
    allowPositionals: false,
    options: {
      config: { type: 'string', default: DEFAULT_CONFIG_FILE_NAME },
      environment: { type: 'string' },
      'no-caching': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    process.stdout.write(HELP);
    return;
  }
  const config = await readServiceWorkerConfig(resolve(values.config));
  // writeServiceWorker rejects an environment it doesn't support
  const path = await writeServiceWorker(config, {
    caching: !values['no-caching'],
    ...(values.environment === undefined
      ? {}
      : { environment: values.environment as IServiceWorkerEnvironment }),
  });
  process.stdout.write(`Wrote ${path}\n`);
};

// the codes of the errors parseArgs throws for unknown options and missing values
const ARGUMENT_ERROR_CODE_PREFIX = 'ERR_PARSE_ARGS_';

try {
  await run(process.argv.slice(2));
} catch (error) {
  const isArgumentError =
    error instanceof Error &&
    'code' in error &&
    String(error.code).startsWith(ARGUMENT_ERROR_CODE_PREFIX);
  process.stderr.write(
    `${extractMessage(error)}${isArgumentError ? '. Run jg-sw --help to see the options.' : ''}\n`,
  );
  process.exitCode = 1;
}
