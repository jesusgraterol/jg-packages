import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { constants } from 'node:os';
import { join } from 'node:path';

import { readTestSuite } from './test-suite.ts';

/*
 * Runs turbo with JG_TEST_SUITE set, so the root scripts select a suite the same way on every
 * platform, where `JG_TEST_SUITE=essential turbo …` works only in POSIX shells:
 *
 *   node internal/vitest-config/src/run-test-suite.ts <essential|full> <turbo arguments…>
 *
 * It runs turbo's JavaScript entry with this Node.js, without a shell, forwards SIGINT and SIGTERM
 * to it, and exits with its code, or with 128 plus the signal's number after a signal.
 */
const [suiteArgument = '', ...turboArguments] = process.argv.slice(2);

// the signal this wrapper forwarded, which makes the run fail even when turbo exits 0
let forwardedSignal: NodeJS.Signals | undefined;

try {
  const suite = readTestSuite({ JG_TEST_SUITE: suiteArgument });
  const rootRequire = createRequire(join(import.meta.dirname, '..', '..', '..', 'package.json'));
  const child = spawn(
    process.execPath,
    [rootRequire.resolve('turbo/bin/turbo'), ...turboArguments],
    {
      stdio: 'inherit',
      env: { ...process.env, JG_TEST_SUITE: suite },
    },
  );
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      forwardedSignal = signal;
      child.kill(signal);
    });
  }
  child.on('error', (error) => {
    console.error(`turbo couldn't start: ${error.message}`);
    process.exitCode = 1;
  });
  child.on('exit', (code, signal) => {
    const endingSignal = forwardedSignal ?? signal;
    process.exitCode =
      endingSignal === null || endingSignal === undefined
        ? (code ?? 1)
        : 128 + constants.signals[endingSignal];
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
