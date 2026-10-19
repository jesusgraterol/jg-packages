import { accessSync, constants, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, posix, resolve, win32 } from 'node:path';
import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/index.js';

import {
  MAX_SHIM_BYTES,
  MAX_SHIM_PACKAGE_DEPTH,
  PACKAGE_MANAGERS,
  WINDOWS_SCRIPT_PATTERN,
} from './constants.js';
import type {
  IPackageManager,
  IPackageManagerCommand,
  IResolvePackageManagerOptions,
} from './types.js';
import { isInside, namesPackageManager, readShimTarget, toCommand } from './utilities.js';

/**
 * Checks whether a path is a regular file, following symbolic links.
 * @param path The path.
 * @returns Whether it's a regular file.
 */
const isFile = (path: string): boolean => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

/**
 * Reads the entry a package manager's package declares as its `bin`, when the directory holds that
 * package and the entry stays inside it.
 * @param packageDirectory The directory that may hold the package.
 * @param packageManager The package manager.
 * @returns The entry's path, or undefined.
 */
const readBinEntry = (
  packageDirectory: string,
  packageManager: IPackageManager,
): string | undefined => {
  let manifest: unknown;
  try {
    manifest = JSON.parse(readFileSync(join(packageDirectory, 'package.json'), 'utf8'));
  } catch {
    return undefined;
  }
  if (typeof manifest !== 'object' || manifest === null) {
    return undefined;
  }
  const { name, bin } = manifest as { name?: unknown; bin?: unknown };
  if (name !== packageManager) {
    return undefined;
  }
  const relativeEntry: unknown =
    typeof bin === 'string' ? bin : (bin as Record<string, unknown> | null)?.[packageManager];
  if (typeof relativeEntry !== 'string') {
    return undefined;
  }
  const entry = resolve(packageDirectory, relativeEntry);
  return isInside(packageDirectory, entry) && isFile(entry) ? entry : undefined;
};

/**
 * Finds the package manager installed in the project, as one of its dependencies.
 * @param cwd The directory resolution starts from.
 * @param packageManager The package manager.
 * @returns The entry's path, or undefined.
 */
const findLocalEntry = (cwd: string, packageManager: IPackageManager): string | undefined => {
  try {
    const manifestPath = createRequire(join(resolve(cwd), 'package.json')).resolve(
      `${packageManager}/package.json`,
    );
    return readBinEntry(dirname(manifestPath), packageManager);
  } catch {
    return undefined;
  }
};

/**
 * Finds the script a Windows shim on PATH runs: the target cmd-shim recorded in it, or the bin of
 * the package manager's package in the shim's directory, its `node_modules`, or up to four
 * directories above it. Node.js refuses to spawn a `.cmd` file without a shell, so the script runs
 * through Node.js instead.
 * @param shim The shim's path.
 * @param packageManager The package manager.
 * @returns The script's path, or undefined.
 */
const resolveWindowsShim = (shim: string, packageManager: IPackageManager): string | undefined => {
  if (!isFile(shim) || statSync(shim).size > MAX_SHIM_BYTES) {
    return undefined;
  }
  const target = readShimTarget(readFileSync(shim, 'utf8'));
  const shimDirectory = dirname(shim);
  if (target !== undefined) {
    const targetPath = resolve(shimDirectory, target);
    if (isFile(targetPath)) {
      return targetPath;
    }
  }
  const nestedEntry = readBinEntry(
    join(shimDirectory, 'node_modules', packageManager),
    packageManager,
  );
  if (nestedEntry !== undefined) {
    return nestedEntry;
  }
  let directory = shimDirectory;
  for (let depth = 0; depth <= MAX_SHIM_PACKAGE_DEPTH; depth += 1) {
    const entry = readBinEntry(directory, packageManager);
    if (entry !== undefined) {
      return entry;
    }
    directory = dirname(directory);
  }
  return undefined;
};

/**
 * Searches PATH for a package manager: an executable file named after it on POSIX, and on Windows
 * its `.exe`, which runs directly, or its `.cmd` or `.ps1` shim, whose script runs through Node.js.
 * @param env The environment that holds PATH.
 * @param packageManager The package manager.
 * @param platform The platform whose PATH rules apply.
 * @param args The arguments for the package manager.
 * @returns The command, or undefined.
 */
export const searchPath = (
  env: NodeJS.ProcessEnv,
  packageManager: IPackageManager,
  platform: NodeJS.Platform,
  args: string[],
): IPackageManagerCommand | undefined => {
  const isWindows = platform === 'win32';
  const pathValue = env['PATH'] ?? env['Path'] ?? env['path'] ?? '';
  const directories = pathValue.split(isWindows ? win32.delimiter : posix.delimiter);
  for (const directory of directories.filter((candidate) => candidate !== '')) {
    if (!isWindows) {
      const candidate = join(directory, packageManager);
      try {
        accessSync(candidate, constants.X_OK);
        if (isFile(candidate)) {
          return toCommand(candidate, args);
        }
      } catch {
        // not executable here; the next directory may hold it
      }
      continue;
    }
    const executable = join(directory, `${packageManager}.exe`);
    if (isFile(executable)) {
      return { command: executable, args: [...args] };
    }
    for (const extension of ['.cmd', '.ps1']) {
      const script = resolveWindowsShim(
        join(directory, `${packageManager}${extension}`),
        packageManager,
      );
      if (script !== undefined) {
        return toCommand(script, args);
      }
    }
  }
  return undefined;
};

/**
 * Builds the command that runs a package manager with the given arguments, without a shell, so it
 * can be passed to `runProcess` or `startProcess` as it is on Windows, macOS, and Linux. It looks,
 * in order, at:
 * 1. `npm_execpath`, which a package manager sets for the scripts it runs, when it names the
 *    requested package manager, or any one when none is requested
 * 2. the package manager installed in the project, resolved from `cwd`
 * 3. PATH: an executable on POSIX, and on Windows an `.exe`, or a `.cmd` or `.ps1` shim whose
 *    script it runs through Node.js, because Node.js refuses to spawn a `.cmd` file without a shell
 *
 * A JavaScript entry, such as `pnpm.cjs`, runs through the current Node.js. Without a requested
 * package manager or `npm_execpath`, there's nothing to look for, so it throws.
 * @param args The arguments for the package manager, such as `['run', 'build']`.
 * @param options The package manager, the environment, and the directory to resolve from.
 * @returns The command and its arguments.
 * @example
 * import { resolvePackageManagerCommand, runProcess } from 'jg-process';
 *
 * const command = resolvePackageManagerCommand(['run', 'build'], { packageManager: 'pnpm' });
 * const { exitCode } = await runProcess({ ...command, timeoutSeconds: 600 });
 * @throws
 * - UNSUPPORTED_PACKAGE_MANAGER: The package manager must be pnpm, npm, yarn, or bun.
 * - PACKAGE_MANAGER_NOT_FOUND: The package manager's executable couldn't be found.
 */
export const resolvePackageManagerCommand = (
  args: string[],
  { packageManager, env = process.env, cwd = process.cwd() }: IResolvePackageManagerOptions = {},
): IPackageManagerCommand => {
  if (packageManager !== undefined && !PACKAGE_MANAGERS.includes(packageManager)) {
    throw new Exception('The package manager must be pnpm, npm, yarn, or bun.', {
      code: ERRORS.UNSUPPORTED_PACKAGE_MANAGER,
      data: { packageManager: String(packageManager) },
    });
  }
  const execPath = env['npm_execpath'];
  if (
    execPath !== undefined &&
    execPath !== '' &&
    !WINDOWS_SCRIPT_PATTERN.test(execPath) &&
    (packageManager === undefined || namesPackageManager(execPath, packageManager))
  ) {
    return toCommand(execPath, args);
  }
  if (packageManager !== undefined) {
    const localEntry = findLocalEntry(cwd, packageManager);
    if (localEntry !== undefined) {
      return toCommand(localEntry, args);
    }
    const pathCommand = searchPath(env, packageManager, process.platform, args);
    if (pathCommand !== undefined) {
      return pathCommand;
    }
  }
  throw new Exception(`The ${packageManager ?? 'package manager'} executable couldn't be found.`, {
    code: ERRORS.PACKAGE_MANAGER_NOT_FOUND,
    data: { packageManager: packageManager ?? null },
  });
};
