import { isAbsolute, relative, win32 } from 'node:path';

import { CMD_SHIM_TARGET_PATTERN, JAVASCRIPT_ENTRY_PATTERN } from './constants.js';
import type { IPackageManager, IPackageManagerCommand } from './types.js';

/**
 * Builds the command that runs an entry: a JavaScript entry through this Node.js, so it works on
 * every platform, and any other entry, such as a native binary, directly.
 * @param entry The entry's path.
 * @param args The arguments for the package manager.
 * @returns The command.
 */
export const toCommand = (entry: string, args: string[]): IPackageManagerCommand =>
  JAVASCRIPT_ENTRY_PATTERN.test(entry)
    ? { command: process.execPath, args: [entry, ...args] }
    : { command: entry, args: [...args] };

/**
 * Checks whether an entry, such as the one npm_execpath names, belongs to a package manager, by
 * its file name: `pnpm.cjs`, `npm-cli.js`, `yarn-4.5.0.cjs`, or `bun`, in any letter case. The
 * name is read with Windows rules, which split on both `/` and `\`, so either kind of path works.
 * @param entry The entry's path.
 * @param packageManager The package manager.
 * @returns Whether the entry runs it.
 */
export const namesPackageManager = (entry: string, packageManager: IPackageManager): boolean =>
  win32.basename(entry).toLowerCase().startsWith(packageManager);

/**
 * Reads the script a cmd-shim shim runs from the `# cmd-shim-target=` line cmd-shim writes into
 * it. The line is read as text and never run.
 * @param shim The shim's contents.
 * @returns The target's path, or undefined.
 */
export const readShimTarget = (shim: string): string | undefined => {
  const target = CMD_SHIM_TARGET_PATTERN.exec(shim)?.[1]?.trim();
  return target === undefined || target === '' ? undefined : target;
};

/**
 * Checks that a path stays inside a directory, after both are resolved.
 * @param directory The directory.
 * @param path The path.
 * @returns Whether the path is the directory or inside it.
 */
export const isInside = (directory: string, path: string): boolean => {
  const fromDirectory = relative(directory, path);
  return fromDirectory === '' || (!fromDirectory.startsWith('..') && !isAbsolute(fromDirectory));
};
