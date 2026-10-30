import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

import type { ILockOwner } from './types.js';

// the built package, which `test:integration` builds first
const PACKAGE_URL = pathToFileURL(join(import.meta.dirname, '..', '..', 'dist', 'index.js')).href;

// a program that takes a lock, prints its owner, and releases it when its stdin closes
const HOLDER_SCRIPT = `
const [moduleUrl, name, root, metadata] = process.argv.slice(2);
const { acquireLock } = await import(moduleUrl);
const lock = await acquireLock(name, { root, metadata: JSON.parse(metadata) });
process.stdout.write(JSON.stringify(lock.owner) + '\\n');
process.stdin.resume();
process.stdin.on('end', async () => {
  await lock.release();
  process.exit(0);
});
`;

// another process that holds a lock
export type IHolder = {
  owner: ILockOwner;
  child: ChildProcess;

  // releases the lock and waits for the process to exit
  release: () => Promise<void>;

  // kills the process without releasing, which leaves the lock to a dead owner
  kill: () => Promise<void>;
};

/**
 * Starts another process that takes a lock and holds it, from a script in the given folder, with
 * an argument that must never reach owner.json.
 * @param folder A temporary folder for the script.
 * @param name The lock's name.
 * @param root The locks folder.
 * @param metadata What the holder writes about itself.
 * @returns A promise that resolves once the process holds the lock.
 */
export const startHolder = async (
  folder: string,
  name: string,
  root: string,
  metadata: Record<string, string> = {},
): Promise<IHolder> => {
  const script = join(folder, 'holder.mjs');
  await writeFile(script, HOLDER_SCRIPT);
  const child = spawn(
    process.execPath,
    [script, PACKAGE_URL, name, root, JSON.stringify(metadata), '--token=secret-argument'],
    { stdio: ['pipe', 'pipe', 'inherit'] },
  );
  const exited = once(child, 'exit');
  const [line] = (await Promise.race([
    once(createInterface({ input: child.stdout }), 'line'),
    exited.then(() => {
      throw new Error('The holder exited before it held the lock.');
    }),
  ])) as [string];
  return {
    owner: JSON.parse(line) as ILockOwner,
    child,
    release: async () => {
      child.stdin.end();
      await exited;
    },
    kill: async () => {
      child.kill('SIGKILL');
      await exited;
    },
  };
};
