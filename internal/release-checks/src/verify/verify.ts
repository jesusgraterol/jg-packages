import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { checkAstroFixture } from '../checks/astro-fixture.ts';
import { checkFileList } from '../checks/file-list.ts';
import { checkInstallAndImport } from '../checks/install-import.ts';
import { checkPackagingLint } from '../checks/packaging-lint.ts';
import { checkRegistryVersions } from '../checks/registry-versions.ts';
import { checkReleaseDocs } from '../checks/release-docs.ts';
import { checkTsdoc } from '../checks/tsdoc.ts';
import { sha256, writeReleaseManifest } from '../shared/release-files.ts';
import { readTarballFiles } from '../shared/tarball.ts';
import { findPublishablePackages, type IWorkspacePackage } from '../workspace/workspace.ts';
import type { IPackedPackage, IRegistry } from '../checks/types.ts';
import type { IPackageManifest, IReleaseManifestEntry, IRunCommand } from '../shared/types.ts';

// what the verify and pack commands need from their environment
export type IVerifyDependencies = {
  registry: IRegistry;
  runCommand: IRunCommand;
  log: (message: string) => void;
};

// the outcome of packing and checking every publishable package
export type IReleaseCheckResult = {
  entries: IReleaseManifestEntry[];
  problems: Map<string, string[]>;
};

/**
 * Packs one package with pnpm, which replaces workspace and catalog ranges, and reads its
 * tarball back.
 * @param workspacePackage The package to pack.
 * @param outputDirectory Where the tarball goes.
 * @param runCommand Runs a command.
 * @returns A promise that resolves to the packed package.
 * @throws
 * - pnpm pack failed for {name}: {stderr}
 */
const packPackage = async (
  workspacePackage: IWorkspacePackage,
  outputDirectory: string,
  runCommand: IRunCommand,
): Promise<IPackedPackage> => {
  const result = await runCommand(
    'pnpm',
    ['pack', '--pack-destination', outputDirectory, '--json'],
    {
      cwd: workspacePackage.directory,
    },
  );
  if (result.exitCode !== 0) {
    throw new Error(`pnpm pack failed for ${workspacePackage.name}: ${result.stderr.trim()}`);
  }
  const { filename } = JSON.parse(result.stdout) as { filename: string };
  const tarballPath = filename.startsWith(outputDirectory)
    ? filename
    : join(outputDirectory, basename(filename));
  const files = await readTarballFiles(tarballPath);
  return {
    workspacePackage,
    tarballPath,
    sha256: sha256(await readFile(tarballPath)),
    files,
    packedManifest: JSON.parse(
      files.get('package.json')?.toString('utf8') ?? '{}',
    ) as IPackageManifest,
  };
};

/**
 * Adds problems to a package's list.
 * @param problems Every package's problems.
 * @param name The package name.
 * @param additions The problems to add.
 */
const addProblems = (problems: Map<string, string[]>, name: string, additions: string[]): void => {
  problems.set(name, [...(problems.get(name) ?? []), ...additions]);
};

/**
 * Packs every publishable package into a directory and runs every release check on the tarballs:
 * the file list, the release docs, a consumer install and imports, an Astro fixture build for
 * packages with Astro components, publint and attw, TSDoc, and the registry comparison.
 * @param rootDirectory The repository root.
 * @param outputDirectory An existing, empty directory for the tarballs.
 * @param dependencies The registry, command runner, and logger.
 * @returns A promise that resolves to the manifest entries in publish order and every problem.
 * @throws
 * - No publishable packages were found under packages/.
 * - pnpm pack failed for {name}: {stderr}
 */
export const packAndCheck = async (
  rootDirectory: string,
  outputDirectory: string,
  { registry, runCommand, log }: IVerifyDependencies,
): Promise<IReleaseCheckResult> => {
  const workspacePackages = await findPublishablePackages(rootDirectory);
  if (workspacePackages.length === 0) {
    throw new Error('No publishable packages were found under packages/.');
  }
  const packages: IPackedPackage[] = [];
  for (const workspacePackage of workspacePackages) {
    log(`Packing ${workspacePackage.name}@${workspacePackage.version}`);
    packages.push(await packPackage(workspacePackage, outputDirectory, runCommand));
  }

  const problems = new Map<string, string[]>();
  for (const { packedManifest, files } of packages) {
    addProblems(problems, packedManifest.name, [
      ...checkFileList(packedManifest, files),
      ...checkReleaseDocs(packedManifest, files),
    ]);
  }
  log('Installing the tarballs into a consumer project');
  for (const [name, packageProblems] of await checkInstallAndImport(packages, runCommand)) {
    addProblems(problems, name, packageProblems);
  }
  log('Building an Astro site from each package with Astro components');
  for (const [name, packageProblems] of await checkAstroFixture(packages, runCommand)) {
    addProblems(problems, name, packageProblems);
  }
  for (const packed of packages) {
    log(`Linting ${packed.packedManifest.name} and its TSDoc`);
    addProblems(problems, packed.packedManifest.name, [
      ...(await checkPackagingLint(packed, runCommand)),
      ...(await checkTsdoc(packed.workspacePackage.directory)),
    ]);
  }
  log('Comparing with the npm registry');
  for (const [name, packageProblems] of await checkRegistryVersions(packages, registry)) {
    addProblems(problems, name, packageProblems);
  }

  return {
    entries: packages.map(({ packedManifest, tarballPath, sha256: digest }) => ({
      name: packedManifest.name,
      version: packedManifest.version,
      file: basename(tarballPath),
      sha256: digest,
    })),
    problems,
  };
};

/**
 * Prints each package's result and counts the problems.
 * @param result The check result.
 * @param log Prints one line.
 * @returns The number of problems.
 */
const reportResult = (
  { entries, problems }: IReleaseCheckResult,
  log: (message: string) => void,
): number => {
  let count = 0;
  for (const { name, version } of entries) {
    const packageProblems = problems.get(name) ?? [];
    count += packageProblems.length;
    log(packageProblems.length === 0 ? `PASS ${name}@${version}` : `FAIL ${name}@${version}`);
    for (const problem of packageProblems) {
      log(`  - ${problem}`);
    }
  }
  return count;
};

/**
 * The `verify` command: packs every publishable package into a temporary directory, runs every
 * release check, and removes the directory.
 * @param rootDirectory The repository root.
 * @param dependencies The registry, command runner, and logger.
 * @returns A promise that resolves to the exit code: 0 when everything passes, 1 otherwise.
 */
export const runVerify = async (
  rootDirectory: string,
  dependencies: IVerifyDependencies,
): Promise<number> => {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'jg-release-verify-'));
  try {
    const result = await packAndCheck(rootDirectory, outputDirectory, dependencies);
    return reportResult(result, dependencies.log) === 0 ? 0 : 1;
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
};

/**
 * The `pack` command: packs and checks every publishable package into an empty directory, and
 * writes the release manifest only when every check passes.
 * @param rootDirectory The repository root.
 * @param outputDirectory The directory for the tarballs; it must be empty or missing.
 * @param dependencies The registry, command runner, and logger.
 * @returns A promise that resolves to the exit code: 0 when the release is ready, 1 otherwise.
 * @throws
 * - The output directory isn't empty; remove it first: {outputDirectory}
 */
export const runPack = async (
  rootDirectory: string,
  outputDirectory: string,
  dependencies: IVerifyDependencies,
): Promise<number> => {
  await mkdir(outputDirectory, { recursive: true });
  if ((await readdir(outputDirectory)).length > 0) {
    throw new Error(`The output directory isn't empty; remove it first: ${outputDirectory}`);
  }
  const result = await packAndCheck(rootDirectory, outputDirectory, dependencies);
  if (reportResult(result, dependencies.log) > 0) {
    return 1;
  }
  await writeReleaseManifest(outputDirectory, result.entries);
  dependencies.log(
    `Wrote the release manifest for ${result.entries.length} packages to ${outputDirectory}`,
  );
  return 0;
};
