import { join } from 'node:path';
import { checkPackedExports, type IPackedConsumer } from 'jg-package-check';

import type { IPackageManifest, IRunCommand } from '../shared/types.ts';
import { getImportableSubpaths } from './subpaths.ts';
import type { IPackedPackage } from './types.ts';

/**
 * Builds the specifier a consumer imports a subpath with.
 * @param name The package name.
 * @param subpath The `exports` subpath.
 * @returns The specifier, such as `jg-fs/sync`.
 */
export const toSpecifier = (name: string, subpath: string): string =>
  subpath === '.' ? name : `${name}/${subpath.replace(/^\.\//, '')}`;

/**
 * Lists the commands an installed package puts in `node_modules/.bin`.
 * @param name The package name.
 * @param bin The installed manifest's `bin`.
 * @returns The command names. A `bin` string installs one command named after the package,
 * without its scope.
 */
const getCommandNames = (name: string, bin: IPackageManifest['bin']): string[] =>
  typeof bin === 'string' ? [name.slice(name.lastIndexOf('/') + 1)] : Object.keys(bin ?? {});

/**
 * Runs an installed command with `--help` from the consumer project, the way a consumer would.
 * @param runCommand Runs a command.
 * @param consumer The consumer project.
 * @param command The command's name.
 * @returns A promise that resolves to the problem, or undefined when the command exits 0.
 * @throws
 * - PROCESS_INTERRUPTED: The process was interrupted by {signal}.
 */
const checkCommandHelp = async (
  runCommand: IRunCommand,
  { directory, env, signal }: IPackedConsumer,
  command: string,
): Promise<string | undefined> => {
  try {
    const result = await runCommand(join(directory, 'node_modules', '.bin', command), ['--help'], {
      cwd: directory,
      env,
    });
    return result.exitCode === 0
      ? undefined
      : `\`${command} --help\` exits with ${result.exitCode}: ${result.stderr.trim().split('\n')[0] ?? ''}`;
  } catch (error) {
    signal?.throwIfAborted();
    return `\`${command} --help\` can't run: ${error instanceof Error ? error.message : String(error)}`;
  }
};

/**
 * Checks one installed package: no unpublished range in its manifest, every JavaScript subpath
 * imports by name, a private path is refused, and every command it installs runs `--help`.
 * @param runCommand Runs a command.
 * @param consumer The consumer project.
 * @param packed The packed package.
 * @returns One problem per failed check.
 * @throws
 * - PROCESS_INTERRUPTED: The process was interrupted by {signal}.
 */
const checkInstalledPackage = async (
  runCommand: IRunCommand,
  consumer: IPackedConsumer,
  packed: IPackedPackage,
): Promise<string[]> => {
  const { name, exports: exportsMap, bin } = packed.packedManifest;
  const importSubpaths = getImportableSubpaths(exportsMap);
  const problems = await checkPackedExports(consumer, {
    packageName: name,
    importSubpaths,
    privateSubpaths: importSubpaths.length === 0 ? [] : ['./package-private-path.js'],
  });
  for (const command of getCommandNames(name, bin)) {
    const problem = await checkCommandHelp(runCommand, consumer, command);
    if (problem !== undefined) {
      problems.push(problem);
    }
  }
  return problems;
};

/**
 * Check 2: with every tarball installed together into a temporary ESM project, the way a consumer
 * would, checks each package's installed manifest, imports, and commands.
 * @param packages The packed packages.
 * @param runCommand Runs a command.
 * @param consumer The project the tarballs are installed in.
 * @returns A promise that resolves to each package's problems, by name.
 * @throws
 * - PROCESS_INTERRUPTED: The process was interrupted by {signal}.
 */
export const checkInstallAndImport = async (
  packages: IPackedPackage[],
  runCommand: IRunCommand,
  consumer: IPackedConsumer,
): Promise<Map<string, string[]>> => {
  const problems = new Map<string, string[]>();
  for (const packed of packages) {
    problems.set(
      packed.packedManifest.name,
      await checkInstalledPackage(runCommand, consumer, packed),
    );
  }
  return problems;
};
