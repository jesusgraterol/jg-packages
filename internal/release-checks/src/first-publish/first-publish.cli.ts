import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import { runFirstPublish } from './first-publish.ts';
import { parseFirstPublishOptions } from './options.ts';

const ROOT = resolve(import.meta.dirname, '../../../..');

/**
 * Runs the developer-operated first-publish command with an interactive terminal.
 * @returns A promise that resolves once the selected public artifacts are verified.
 */
const main = async (): Promise<void> => {
  const options = parseFirstPublishOptions(process.argv.slice(2));
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error('First publication requires an interactive terminal.');
  }
  await runFirstPublish(ROOT, options, {
    log: (message) => console.log(message),
    confirm: async (prompt, signal) => {
      const promptReader = createInterface({ input: stdin, output: stdout });
      const interrupt = new AbortController();
      promptReader.once('SIGINT', () => interrupt.abort());
      try {
        return (
          (await promptReader.question(prompt + '? Type yes to continue: ', {
            signal: AbortSignal.any([signal, interrupt.signal]),
          })) === 'yes'
        );
      } finally {
        promptReader.close();
      }
    },
  });
};

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'First publication did not complete.');
  process.exitCode = 1;
}
