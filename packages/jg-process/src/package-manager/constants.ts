import type { IPackageManager } from './types.js';

// the package managers resolvePackageManagerCommand accepts, checked at runtime for callers without types
export const PACKAGE_MANAGERS: readonly unknown[] = [
  'pnpm',
  'npm',
  'yarn',
  'bun',
] satisfies IPackageManager[];

// how many directories above a Windows shim the search for its package goes
export const MAX_SHIM_PACKAGE_DEPTH = 4;

// the largest shim file read for its target, so a stray large file on PATH is never read whole
export const MAX_SHIM_BYTES = 16_384;

// the line cmd-shim writes into the shims it creates, such as pnpm's, naming the script they run
export const CMD_SHIM_TARGET_PATTERN = /(?:^|\n)#\s*cmd-shim-target=([^\r\n]+)/u;

// the entries Node.js runs, which spawn through process.execPath instead of directly
export const JAVASCRIPT_ENTRY_PATTERN = /\.[cm]?js$/iu;

// the Windows scripts Node.js won't spawn without a shell, which are never run directly
export const WINDOWS_SCRIPT_PATTERN = /\.(?:cmd|bat|ps1)$/iu;
