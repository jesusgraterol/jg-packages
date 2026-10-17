import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DEPENDENCY_FIELDS } from '../shared/constants.ts';
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
 * Checks one installed package: no unpublished range in its manifest, every JavaScript subpath
 * imports by name, and a private path is refused.
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
  return problems;
};

/**
 * Check 2: installs every tarball together into a temporary ESM project, the way a consumer
 * would, then checks each package's installed manifest and imports.
 * @param packages The packed packages.
 * @param runCommand Runs a command.
 * @returns A promise that resolves to each package's problems, by name.
 */
export const checkInstallAndImport = async (
  packages: IPackedPackage[],
  runCommand: IRunCommand,
): Promise<Map<string, string[]>> => {
  const projectDirectory = await mkdtemp(join(tmpdir(), 'jg-release-consumer-'));
  try {
    await writeFile(
      join(projectDirectory, 'package.json'),
      JSON.stringify({ name: 'release-check-consumer', private: true, type: 'module' }),
    );
    const install = await runCommand(
      'npm',
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--no-package-lock',
        ...packages.map(({ tarballPath }) => tarballPath),
      ],
      { cwd: projectDirectory },
    );
    if (install.exitCode !== 0) {
      const message = `couldn't be installed from its tarball: ${install.stderr.trim()}`;
      return new Map(packages.map(({ packedManifest }) => [packedManifest.name, [message]]));
    }
    const problems = new Map<string, string[]>();
    for (const packed of packages) {
      problems.set(
        packed.packedManifest.name,
        await checkInstalledPackage(runCommand, projectDirectory, packed),
      );
    }
    return problems;
  } finally {
    await rm(projectDirectory, { recursive: true, force: true });
  }
};
