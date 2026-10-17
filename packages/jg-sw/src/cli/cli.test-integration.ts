import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

// the built CLI, which `test:integration` builds first
const CLI_PATH = join(import.meta.dirname, '..', '..', 'dist', 'cli', 'cli.js');

let directory: string;

/**
 * Runs the built CLI in the test's directory.
 * @param args The CLI's arguments.
 * @returns A promise that resolves to the exit code and output.
 */
const runCli = async (
  args: string[],
): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
  try {
    const { stdout, stderr } = await promisify(execFile)(process.execPath, [CLI_PATH, ...args], {
      cwd: directory,
    });
    return { exitCode: 0, stdout, stderr };
  } catch (error) {
    const { code, stdout, stderr } = error as { code: number; stdout: string; stderr: string };
    return { exitCode: code, stdout, stderr };
  }
};

/**
 * Writes a config and the build output it precaches.
 * @param fileName The config's file name.
 * @returns A promise that resolves once the files are written.
 */
const writeProject = async (fileName = 'jg-sw.config.json'): Promise<void> => {
  await mkdir(join(directory, 'dist'), { recursive: true });
  await writeFile(join(directory, 'dist', 'index.html'), 'Test Index File');
  await writeFile(
    join(directory, fileName),
    JSON.stringify({
      outDir: 'dist',
      cacheNamePrefix: 'test-app',
      template: 'base',
      includeToPrecache: ['/', '/index.html'],
      excludeFilesFromPrecache: [],
      excludeMIMETypesFromCache: [],
    }),
  );
};

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'jg-sw-cli-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('jg-sw', () => {
  test('--help prints the usage and exits 0', async () => {
    const { exitCode, stdout, stderr } = await runCli(['--help']);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Usage: jg-sw [options]');
    expect(stdout).toContain('--no-caching');
    expect(stderr).toBe('');
  });

  test('writes the worker from jg-sw.config.json and prints its path', async () => {
    await writeProject();

    const { exitCode, stdout, stderr } = await runCli([]);

    const path = join(directory, 'dist', 'sw.js');
    expect({ exitCode, stdout, stderr }).toStrictEqual({
      exitCode: 0,
      stdout: `Wrote ${path}\n`,
      stderr: '',
    });
    const source = await readFile(path, 'utf8');
    expect(source).toContain('"/index.html"');
    expect(source).toContain('const CACHING = true;');
  });

  test('reads --config and writes a worker without caching with --no-caching', async () => {
    await writeProject('custom.config.json');

    const { exitCode } = await runCli(['--config', 'custom.config.json', '--no-caching']);

    expect(exitCode).toBe(0);
    expect(await readFile(join(directory, 'dist', 'sw.js'), 'utf8')).toContain(
      'const CACHING = false;',
    );
  });

  test('prints the error and exits 1 when the worker cannot be generated', async () => {
    const { exitCode, stdout, stderr } = await runCli([]);

    expect(exitCode).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toBe(
      `Unable to read the service worker config '${join(directory, 'jg-sw.config.json')}': The path '${join(directory, 'jg-sw.config.json')}' is not a file.\n`,
    );
  });

  test('rejects an unsupported environment', async () => {
    await writeProject();

    const { exitCode, stderr } = await runCli(['--environment', 'prod']);

    expect(exitCode).toBe(1);
    expect(stderr).toBe(
      "The environment 'prod' isn't supported. Use development, staging, or production.\n",
    );
  });

  test.each([
    [['--bogus'], "Unknown option '--bogus'. Run jg-sw --help to see the options.\n"],
    [
      ['--config'],
      "Option '--config <value>' argument missing. Run jg-sw --help to see the options.\n",
    ],
    [
      ['extra'],
      "Unexpected argument 'extra'. This command does not take positional arguments. Run jg-sw --help to see the options.\n",
    ],
  ])('rejects the arguments %j', async (args, message) => {
    const { exitCode, stderr } = await runCli(args);

    expect(exitCode).toBe(1);
    expect(stderr).toBe(message);
  });
});
