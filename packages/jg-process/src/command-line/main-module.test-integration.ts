// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { isMainModule } from './main-module.js';

// the built package, which the scripts import as an app would
const DIST_URL = new URL('../../dist/index.js', import.meta.url).href;

let directory: string;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'jg-process-main-'));
  await writeFile(
    join(directory, 'cli.mjs'),
    `import { isMainModule } from ${JSON.stringify(DIST_URL)};\nprocess.stdout.write(String(isMainModule(import.meta.url)));\n`,
  );
  await writeFile(join(directory, 'runner.mjs'), "import './cli.mjs';\n");
  if (process.platform !== 'win32') {
    await symlink(join(directory, 'cli.mjs'), join(directory, 'bin-link.mjs'));
  }
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

/**
 * Runs a script with Node.js and returns what it printed.
 * @param script The script's path.
 * @returns The output.
 */
const runScript = (script: string): string =>
  spawnSync(process.execPath, [script], { encoding: 'utf8' }).stdout;

describe('isMainModule', () => {
  test('is true in the script Node.js started', () => {
    expect(runScript(join(directory, 'cli.mjs'))).toBe('true');
  });

  test('is false in a module another script imports', () => {
    expect(runScript(join(directory, 'runner.mjs'))).toBe('false');
  });

  test.skipIf(process.platform === 'win32')(
    'is true for a script started through a symbolic link, as an npm bin entry is',
    () => {
      expect(runScript(join(directory, 'bin-link.mjs'))).toBe('true');
    },
  );

  test("is false when the module's URL can't be resolved", () => {
    expect(isMainModule('https://example.com/cli.mjs')).toBe(false);
    expect(isMainModule('file:///no/such/file.mjs')).toBe(false);
  });
});
