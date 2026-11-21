import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';

import { runCommand } from './run-command.ts';

test.skipIf(process.platform === 'win32')(
  'waits for the child to finish handling cancellation before rejecting',
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'jg-release-command-'));
    const controller = new AbortController();
    const reason = new Error('Release qualification interrupted');
    const ready = join(directory, 'ready');
    const stopped = join(directory, 'stopped');
    const childCode = `
      const {writeFileSync} = require('node:fs');
      const [ready, stopped] = process.argv.slice(1);
      const keepAlive = setInterval(() => {}, 1000);
      process.once('SIGTERM', () => {
        setImmediate(() => {
          writeFileSync(stopped, 'stopped');
          clearInterval(keepAlive);
        });
      });
      writeFileSync(ready, 'ready');
    `;
    const operation = runCommand(process.execPath, ['--eval', childCode, ready, stopped], {
      cwd: directory,
      signal: controller.signal,
    });
    const rejected = operation.then(
      () => undefined,
      (error: unknown) => error,
    );

    try {
      await vi.waitFor(async () => expect(await readFile(ready, 'utf8')).toBe('ready'));
      controller.abort(reason);
      expect(await rejected).toBe(reason);
      expect(await readFile(stopped, 'utf8')).toBe('stopped');
    } finally {
      controller.abort(reason);
      await rejected;
      await rm(directory, { recursive: true, force: true });
    }
  },
);
