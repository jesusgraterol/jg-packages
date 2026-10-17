import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { DEPENDENCY_FIELDS } from '../shared/constants.ts';
import type { IConsumerProject } from './consumer-project.ts';
import type { IPackageManifest, IRunCommand } from '../shared/types.ts';
import type { IPackedPackage } from './types.ts';

// the import every subpath check runs, with the specifier passed as an argument
const IMPORT_SCRIPT = 'await import(process.argv[1]);';

// unpublished ranges pnpm replaces when packing
const WORKSPACE_RANGE = /^(?:workspace|catalog):/;

/**
 * Lists the `exports` subpaths a Node.js consumer can import: those whose default target is
 * JavaScript, leaving out stylesheets and source-only targets such as Astro components.
 * @param exportsMap The packed manifest's `exports`.
 * @returns The importable subpaths, such as `.` and `./sync`.
 */
const getImportableSubpaths = (exportsMap: unknown): string[] => {
  if (typeof exportsMap !== 'object' || exportsMap === null) {
    return [];
  }
  return Object.entries(exportsMap as Record<string, unknown>)
    .filter(([, target]) => {
      const defaultTarget =
        typeof target === 'object' && target !== null
          ? (target as { default?: unknown }).default
          : target;
      return typeof defaultTarget === 'string' && /\.m?js$/.test(defaultTarget);
    })
    .map(([subpath]) => subpath);
};

/**
 * Builds the specifier a consumer imports a subpath with.
 * @param name The package name.
 * @param subpath The `exports` subpath.
 * @returns The specifier, such as `jg-fs/sync`.
 */
const toSpecifier = (name: string, subpath: string): string =>
  subpath === '.' ? name : `${name}/${subpath.replace(/^\.\//, '')}`;

/**
 * Imports one specifier in a fresh Node.js process from the consumer project.
 * @param runCommand Runs a command.
 * @param projectDirectory The consumer project.
 * @param specifier The specifier to import.
 * @returns A promise that resolves to the command's result.
 */
const importSpecifier = (runCommand: IRunCommand, projectDirectory: string, specifier: string) =>
  runCommand(process.execPath, ['--input-type=module', '--eval', IMPORT_SCRIPT, specifier], {
    cwd: projectDirectory,
  });

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
 * @param projectDirectory The consumer project.
 * @param command The command's name.
 * @returns A promise that resolves to the problem, or undefined when the command exits 0.
 */
const checkCommandHelp = async (
  runCommand: IRunCommand,
  projectDirectory: string,
  command: string,
): Promise<string | undefined> => {
  try {
    const result = await runCommand(
      join(projectDirectory, 'node_modules', '.bin', command),
      ['--help'],
      { cwd: projectDirectory },
    );
    return result.exitCode === 0
      ? undefined
      : `\`${command} --help\` exits with ${result.exitCode}: ${result.stderr.trim().split('\n')[0] ?? ''}`;
  } catch (error) {
    return `\`${command} --help\` can't run: ${error instanceof Error ? error.message : String(error)}`;
  }
};

/**
 * Checks one installed package: no unpublished range in its manifest, every JavaScript subpath
 * imports by name, a private path is refused, and every command it installs runs `--help`.
 * @param runCommand Runs a command.
 * @param projectDirectory The consumer project.
 * @param packed The packed package.
 * @returns One problem per failed check.
 */
const checkInstalledPackage = async (
  runCommand: IRunCommand,
  projectDirectory: string,
  packed: IPackedPackage,
): Promise<string[]> => {
  const { name } = packed.packedManifest;
  const installed = JSON.parse(
    await readFile(
      join(projectDirectory, 'node_modules', ...name.split('/'), 'package.json'),
      'utf8',
    ),
  ) as IPackageManifest;
  const problems = DEPENDENCY_FIELDS.flatMap((field) =>
    Object.entries(installed[field] ?? {})
      .filter(([, range]) => WORKSPACE_RANGE.test(range))
      .map(([dependency, range]) => `installs with an unpublished range: ${dependency}@${range}`),
  );

  const subpaths = getImportableSubpaths(installed.exports);
  for (const subpath of subpaths) {
    const specifier = toSpecifier(name, subpath);
    const result = await importSpecifier(runCommand, projectDirectory, specifier);
    if (result.exitCode !== 0) {
      problems.push(
        `can't be imported as ${specifier}: ${result.stderr.trim().split('\n')[0] ?? ''}`,
      );
    }
  }
  if (subpaths.length > 0) {
    const privatePath = `${name}/package-private-path.js`;
    const result = await importSpecifier(runCommand, projectDirectory, privatePath);
    if (!result.stderr.includes('ERR_PACKAGE_PATH_NOT_EXPORTED')) {
      problems.push(
        `exposes paths outside \`exports\`: importing ${privatePath} didn't fail with ERR_PACKAGE_PATH_NOT_EXPORTED`,
      );
    }
  }
  for (const command of getCommandNames(name, installed.bin)) {
    const problem = await checkCommandHelp(runCommand, projectDirectory, command);
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
 */
export const checkInstallAndImport = async (
  packages: IPackedPackage[],
  runCommand: IRunCommand,
  consumer: IConsumerProject,
): Promise<Map<string, string[]>> => {
  const { directory, installProblem } = consumer;
  if (installProblem !== undefined) {
    return new Map(packages.map(({ packedManifest }) => [packedManifest.name, [installProblem]]));
  }
  const problems = new Map<string, string[]>();
  for (const packed of packages) {
    problems.set(
      packed.packedManifest.name,
      await checkInstalledPackage(runCommand, directory, packed),
    );
  }
  return problems;
};
