import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

import { runProcess } from 'jg-process';

const withFixture = async (run: (directory: string) => Promise<void>): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'jg-astro-foundation-'));
  try {
    await Promise.all([
      mkdir(join(directory, 'scripts/foundation'), { recursive: true }),
      mkdir(join(directory, 'src/styles'), { recursive: true }),
      mkdir(join(directory, 'src/components/jg-mark'), { recursive: true }),
      writeFile(join(directory, 'package.json'), '{"type":"module","private":true}'),
      // a directory junction needs no Windows symlink privilege and is removed without traversal.
      symlink(
        resolve(import.meta.dirname, '../../node_modules'),
        join(directory, 'node_modules'),
        'junction',
      ),
    ]);
    for (const name of ['generate.ts', 'utilities.ts']) {
      await copyFile(join(import.meta.dirname, name), join(directory, 'scripts/foundation', name));
    }
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

const runGenerator = (directory: string, args: string[]) =>
  runProcess({
    command: process.execPath,
    args: [join(directory, 'scripts/foundation/generate.ts'), ...args],
    cwd: directory,
    timeoutSeconds: 10,
    maxOutputBytes: 16_384,
  });

test('the real CLI rejects stale copies, regenerates canonical assets and checks without writing', async () => {
  await withFixture(async (directory) => {
    const stale = await runGenerator(directory, ['--check']);
    expect(stale.exitCode).toBe(1);
    expect(stale.stderr).toContain('Astro foundation assets are stale.');
    expect((await runGenerator(directory, [])).exitCode).toBe(0);
    for (const name of ['jg-mark.svg', 'jg-favicon.svg']) {
      expect(await readFile(join(directory, 'src/components/jg-mark', name), 'utf8')).toBe(
        (
          await readFile(fileURLToPath(import.meta.resolve(`jg-personal-ui/${name}`)), 'utf8')
        ).replace(/\r\n/g, '\n'),
      );
    }
    const scopesPath = join(directory, 'src/styles/dark-scopes.css');
    const scopes = await readFile(scopesPath, 'utf8');
    expect(scopes).toContain('.jg-code-window,\n.jg-section-inverse');
    expect((await runGenerator(directory, ['--check'])).exitCode).toBe(0);
    await writeFile(scopesPath, 'stale');
    expect((await runGenerator(directory, ['--check'])).exitCode).toBe(1);
    expect(await readFile(scopesPath, 'utf8')).toBe('stale');
  });
});

test('unknown flags fail as an operation error rather than reporting a successful check', async () => {
  await withFixture(async (directory) => {
    const result = await runGenerator(directory, ['--unknown']);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Unable to synchronize Astro foundation assets:');
  });
});
