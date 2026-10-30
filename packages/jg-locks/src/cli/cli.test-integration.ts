// @vitest-environment node
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { type IHolder, startHolder } from '../locks/holder.test-utils.js';
import { acquireLock, inspectLock } from '../locks/index.js';

import { runCli } from './cli.js';
import type { ICliOutput } from './types.js';

// the built CLI, which `test:integration` builds first
const CLI_PATH = join(import.meta.dirname, '..', '..', 'dist', 'cli', 'cli.js');

let folder: string;
let root: string;
const holders: IHolder[] = [];

beforeEach(async () => {
  folder = await realpath(await mkdtemp(join(tmpdir(), 'jg-locks-cli-')));
  root = join(folder, 'locks');
  vi.stubEnv('JG_LOCKS_ROOT', root);
});

afterEach(async () => {
  await Promise.all(holders.splice(0).map((holder) => holder.kill()));
  await rm(folder, { recursive: true, force: true });
});

/**
 * Starts a holder that the test's teardown stops.
 * @param name The lock's name.
 * @returns A promise that resolves once it holds the lock.
 */
const hold = async (name: string): Promise<IHolder> => {
  const holder = await startHolder(folder, name, root);
  holders.push(holder);
  return holder;
};

/**
 * Runs the CLI in this process, capturing what it writes.
 * @param args The CLI's arguments.
 * @returns A promise that resolves to the exit code and output.
 */
const run = async (args: string[]): Promise<{ exitCode: number; out: string; err: string }> => {
  let out = '';
  let err = '';
  const output: ICliOutput = {
    out: { write: (text: string) => (out += text) },
    err: { write: (text: string) => (err += text) },
  };
  const exitCode = await runCli(args, output);
  return { exitCode, out, err };
};

/**
 * Starts the built CLI as its own process.
 * @param args The CLI's arguments.
 * @returns The process, a reader of its first stdout line, and its exit.
 */
const startCli = (args: string[]) => {
  const child = spawn(process.execPath, [CLI_PATH, ...args], {
    env: { ...process.env, JG_LOCKS_ROOT: root },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = once(child, 'exit') as Promise<[number | null, NodeJS.Signals | null]>;
  // read on demand, so a test that never reads it leaves no rejection behind
  const firstLine = (): Promise<[string]> =>
    Promise.race([
      once(createInterface({ input: child.stdout }), 'line') as Promise<[string]>,
      exited.then(() => {
        throw new Error('The CLI exited before it printed a line.');
      }),
    ]);
  return { child, exited, firstLine };
};

describe('jg-locks', () => {
  test('prints the help with --help and exits 0, as an installed command must', async () => {
    const { exited, child } = startCli(['--help']);
    let out = '';
    child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString()));
    expect((await exited)[0]).toBe(0);
    expect(out).toContain('Usage: jg-locks <command>');
  });

  test('prints the help in this process too', async () => {
    const { exitCode, out } = await run(['--help']);
    expect(exitCode).toBe(0);
    expect(out).toContain('recover <name> --nonce <nonce>');
  });

  test.each([
    [[], 'A command is needed.'],
    [['bogus'], "Unknown command 'bogus'."],
    [['run', 'acme.app.x', 'true'], "needs '--' before the command"],
    [['run', '--', 'true'], 'needs a lock name'],
    [['run', 'acme.app.x', '--'], "needs a command after '--'"],
    [
      ['run', 'acme.app.x', '--wait', 'soon', '--', 'true'],
      "takes a number of seconds or 'forever'",
    ],
    [['run', 'acme.app.x', '--other', '--', 'true'], "Unknown option '--other'"],
    [['run', 'Bad', '--', 'true'], 'The lock name must be'],
    [['status', '--verbose'], "Unknown option '--verbose'"],
    [['recover', 'acme.app.x'], 'The --nonce option is required.'],
  ])('exits 2 for the usage error in %j', async (args, message) => {
    const { exitCode, err } = await run(args);
    expect(exitCode).toBe(2);
    expect(err).toContain(message);
    expect(err).toContain('Run jg-locks --help');
  });

  test('exits 1 with the message for any other failure', async () => {
    vi.stubEnv('JG_LOCKS_ROOT', 'relative/locks');
    const { exitCode, err } = await run(['status']);
    expect(exitCode).toBe(1);
    expect(err).toBe('jg-locks: The locks folder must be an absolute path.\n');
  });
});

describe('jg-locks run', () => {
  test("runs the command while holding the lock, releases it, and exits with the command's code", async () => {
    const { exitCode } = await run([
      'run',
      'acme.app.job',
      '--',
      process.execPath,
      '-e',
      'process.exit(3)',
    ]);
    expect(exitCode).toBe(3);
    expect((await inspectLock('acme.app.job')).state).toBe('free');
  });

  test('names the command, without its arguments, as the holder', async () => {
    const { child, exited, firstLine } = startCli([
      'run',
      'acme.app.job',
      '--',
      process.execPath,
      '-e',
      "console.log('started'); setTimeout(() => {}, 30_000);",
      '--',
      '--token=secret',
    ]);
    expect((await firstLine())[0]).toBe('started');
    const { owner } = await inspectLock('acme.app.job');
    expect(owner).toMatchObject({ pid: child.pid, program: 'node', metadata: {} });
    expect(JSON.stringify(owner)).not.toContain('secret');
    child.kill('SIGTERM');
    await exited;
  });

  test('forwards SIGTERM to the command and exits with its code', async () => {
    const { child, exited, firstLine } = startCli([
      'run',
      'acme.app.job',
      '--',
      process.execPath,
      '-e',
      "process.on('SIGTERM', () => process.exit(7)); console.log('started'); setTimeout(() => {}, 30_000);",
    ]);
    await firstLine();
    child.kill('SIGTERM');
    expect((await exited)[0]).toBe(7);
    expect((await inspectLock('acme.app.job')).state).toBe('free');
  });

  test('exits 128 plus the signal number when a signal ends the command', async () => {
    const { child, exited, firstLine } = startCli([
      'run',
      'acme.app.job',
      '--',
      process.execPath,
      '-e',
      "console.log('started'); setTimeout(() => {}, 30_000);",
    ]);
    await firstLine();
    child.kill('SIGINT');
    expect((await exited)[0]).toBe(130);
    expect((await inspectLock('acme.app.job')).state).toBe('free');
  });

  test('exits 75 at once with the holder when another process holds the lock', async () => {
    const holder = await hold('acme.app.job');
    const { exitCode, err } = await run(['run', 'acme.app.job', '--', process.execPath, '-e', '']);
    expect(exitCode).toBe(75);
    expect(err).toContain(`The lock 'acme.app.job' is held: holder.mjs (pid ${holder.owner.pid})`);
  });

  test('gives the recover command when the holder is gone', async () => {
    const holder = await hold('acme.app.job');
    await holder.kill();
    const { exitCode, err } = await run(['run', 'acme.app.job', '--', process.execPath, '-e', '']);
    expect(exitCode).toBe(75);
    expect(err).toContain(`jg-locks recover acme.app.job --nonce ${holder.owner.nonce}`);
  });

  test('waits with --wait, saying who it waits for, then runs the command', async () => {
    const holder = await hold('acme.app.job');
    const running = run(['run', 'acme.app.job', '--wait', '30', '--', process.execPath, '-e', '']);
    await vi.waitFor(async () => {
      expect((await inspectLock('acme.app.job')).owner?.pid).toBe(holder.owner.pid);
    });
    setTimeout(() => void holder.release(), 400);
    const { exitCode, err } = await running;
    expect(exitCode).toBe(0);
    expect(err).toContain(`jg-locks: waiting for holder.mjs (pid ${holder.owner.pid})`);
  });

  test('exits 130 when SIGINT stops a wait', async () => {
    await hold('acme.app.job');
    const { child, exited } = startCli(['run', 'acme.app.job', '--wait', 'forever', '--', 'true']);
    let err = '';
    child.stderr.on('data', (chunk: Buffer) => (err += chunk.toString()));
    await vi.waitFor(() => {
      expect(err).toContain('waiting for');
    });
    child.kill('SIGINT');
    expect((await exited)[0]).toBe(130);
  });

  test('exits 127 when the command does not exist, and releases the lock', async () => {
    const { exitCode, err } = await run(['run', 'acme.app.job', '--', 'jg-locks-missing-command']);
    expect(exitCode).toBe(127);
    expect(err).toContain("'jg-locks-missing-command' could not start");
    expect((await inspectLock('acme.app.job')).state).toBe('free');
  });
});

describe('jg-locks status', () => {
  test('says when no lock is held', async () => {
    expect(await run(['status'])).toStrictEqual({
      exitCode: 0,
      out: 'No locks are held.\n',
      err: '',
    });
  });

  test('lists each lock with its holder and nonce', async () => {
    const holder = await hold('acme.app.port-3000');
    const { exitCode, out } = await run(['status']);
    expect(exitCode).toBe(0);
    expect(out).toContain('acme.app.port-3000: held\n');
    expect(out).toContain(`holder.mjs (pid ${holder.owner.pid})`);
    expect(out).toContain(`(alive)\n  nonce: ${holder.owner.nonce}\n`);
  });

  test('says when it lists only the first 256 locks', async () => {
    await Promise.all(
      Array.from({ length: 257 }, (_, index) =>
        acquireLock(`lock-${String(index).padStart(3, '0')}`),
      ),
    );
    const { out } = await run(['status']);
    expect(out.endsWith('Only the first 256 locks are listed.\n')).toBe(true);
    expect(out).not.toContain('lock-256');
  });

  test('prints one JSON line with schemaVersion 1 with --json', async () => {
    const holder = await hold('acme.app.port-3000');
    const { out } = await run(['status', '--json']);
    expect(out.endsWith('\n')).toBe(true);
    expect(out.trim().split('\n')).toHaveLength(1);
    const status = JSON.parse(out) as { locks: { heldSeconds: unknown }[] };
    const heldSeconds = status.locks[0]?.heldSeconds;
    expect(typeof heldSeconds).toBe('number');
    expect(status).toStrictEqual({
      schemaVersion: 1,
      locks: [
        {
          name: 'acme.app.port-3000',
          state: 'held',
          isOwnerAlive: true,
          heldSeconds,
          owner: holder.owner,
        },
      ],
      isTruncated: false,
    });
  });
});

describe('jg-locks recover', () => {
  test('takes the lock over from the named dead holder and releases it', async () => {
    const holder = await hold('acme.app.fixture');
    await holder.kill();
    const { exitCode, out } = await run([
      'recover',
      'acme.app.fixture',
      '--nonce',
      holder.owner.nonce,
    ]);
    expect(exitCode).toBe(0);
    expect(out).toBe(
      `Recovered 'acme.app.fixture' from pid ${holder.owner.pid}; the lock is free.\n`,
    );
    expect((await inspectLock('acme.app.fixture')).state).toBe('free');
  });

  test('exits 1 and changes nothing for another nonce, a live holder, or a free lock', async () => {
    expect((await run(['recover', 'acme.app.fixture', '--nonce', 'n'])).exitCode).toBe(1);
    const holder = await hold('acme.app.fixture');
    const live = await run(['recover', 'acme.app.fixture', '--nonce', holder.owner.nonce]);
    expect(live.exitCode).toBe(1);
    expect(live.err).toContain('is held; jg-locks recover only takes a lock over');
    await holder.kill();
    const wrong = await run(['recover', 'acme.app.fixture', '--nonce', 'another-nonce']);
    expect(wrong.exitCode).toBe(1);
    expect(wrong.err).toContain(`held by nonce ${holder.owner.nonce}, not another-nonce`);
    expect((await inspectLock('acme.app.fixture')).state).toBe('owner-gone');
  });

  test('exits 1 when another process has already taken the lock over', async () => {
    const holder = await hold('acme.app.fixture');
    await holder.kill();
    const lock = await acquireLock('acme.app.fixture', { recoverFrom: holder.owner });
    const { exitCode, err } = await run([
      'recover',
      'acme.app.fixture',
      '--nonce',
      holder.owner.nonce,
    ]);
    expect(exitCode).toBe(1);
    expect(err).toContain(`held by nonce ${lock.owner.nonce}`);
    await lock.release();
  });
});
