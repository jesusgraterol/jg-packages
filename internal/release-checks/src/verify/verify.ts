import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { extractApiReference } from '@jg-packages/api-reference';

import { checkAstroFixture } from '../checks/astro-fixture.ts';
import { installConsumerProject } from '../checks/consumer-project.ts';
import { checkErrorCodes } from '../checks/error-codes.ts';
import { checkExamples } from '../checks/examples.ts';
import { checkFileList } from '../checks/file-list.ts';
import { checkInstallAndImport } from '../checks/install-import.ts';
import { checkPackagingLint } from '../checks/packaging-lint.ts';
import { checkRegistryVersions } from '../checks/registry-versions.ts';
import { checkReleaseDocs } from '../checks/release-docs.ts';
import { checkTsdoc } from '../checks/tsdoc.ts';
import { checkWorkspaceScripts } from '../checks/workspace-scripts.ts';
import { sha256, writeReleaseManifest } from '../shared/release-files.ts';
import { readTarballFiles } from '../shared/tarball.ts';
import {
  findPublishablePackages,
  findWorkspaces,
  type IWorkspacePackage,
} from '../workspace/workspace.ts';
import type { IPackedPackage, IRegistry } from '../checks/types.ts';
import type { IRunAstroFixtureCommand } from '../checks/astro-fixture-command/index.ts';
import type { IPackageManifest, IReleaseManifestEntry, IRunCommand } from '../shared/types.ts';

// what the verify and pack commands need from their environment
export type IVerifyDependencies = {
  registry: IRegistry;
  runCommand: IRunCommand;
  log: (message: string) => void;
  runGalleryCommand?: IRunAstroFixtureCommand;
};

// the outcome of checking the workspaces, then packing and checking every publishable package
export type IReleaseCheckResult = {
  entries: IReleaseManifestEntry[];
  problems: Map<string, string[]>;
  // the problems of the workspace check, which no single package owns
  workspaceProblems: string[];
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
export const packPackage = async (
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
 * Checks that every workspace's tests run in `pnpm check`, then packs every publishable package
 * into a directory and runs every release check on the tarballs: the file list, the release docs,
 * a consumer install and imports, the examples, the error codes' tests, an Astro fixture build
 * for packages with Astro components, publint and attw, TSDoc, and the registry comparison.
 * @param rootDirectory The repository root.
 * @param outputDirectory An existing, empty directory for the tarballs.
 * @param dependencies The registry, command runner, and logger.
 * @returns A promise that resolves to the manifest entries in publish order and every problem.
 * @throws
 * - No publishable packages were found under packages/.
 * - pnpm pack failed for {name}: {stderr}
 * - pnpm-workspace.yaml has a pattern the release checks can't read: {pattern}
 * - PROCESS_INTERRUPTED: The process was interrupted by {signal}.
 */
export const packAndCheck = async (
  rootDirectory: string,
  outputDirectory: string,
  { registry, runCommand, log, runGalleryCommand }: IVerifyDependencies,
): Promise<IReleaseCheckResult> => {
  log('Checking the workspaces');
  const workspaceProblems = checkWorkspaceScripts(await findWorkspaces(rootDirectory));
  const workspacePackages = await findPublishablePackages(rootDirectory);
  if (workspacePackages.length === 0) {
    throw new Error('No publishable packages were found under packages/.');
  }
  const packages: IPackedPackage[] = [];
  for (const workspacePackage of workspacePackages) {
    log(`Packing ${workspacePackage.name}@${workspacePackage.version}`);
    packages.push(await packPackage(workspacePackage, outputDirectory, runCommand));
  }

  // each package with its API reference, which checks 5 and 6 read
  const withReferences = [];
  for (const packed of packages) {
    log(`Extracting the API reference of ${packed.packedManifest.name}`);
    withReferences.push({
      packed,
      reference: await extractApiReference(packed.workspacePackage.directory),
    });
  }

  const problems = new Map<string, string[]>();
  for (const { packed, reference } of withReferences) {
    const { packedManifest, files } = packed;
    addProblems(problems, packedManifest.name, [
      ...checkFileList(packedManifest, files),
      ...checkReleaseDocs(packedManifest, files, reference),
    ]);
  }
  log('Installing the tarballs into a consumer project');
  const consumer = await installConsumerProject(packages, runCommand);
  try {
    for (const [name, packageProblems] of await checkInstallAndImport(
      packages,
      runCommand,
      consumer,
    )) {
      addProblems(problems, name, packageProblems);
    }
    log('Typechecking and running the examples');
    for (const [name, packageProblems] of await checkExamples(packages, runCommand, consumer)) {
      addProblems(problems, name, packageProblems);
    }
    log('Finding the error codes no test asserts');
    for (const [name, packageProblems] of await checkErrorCodes(packages, runCommand, consumer)) {
      addProblems(problems, name, packageProblems);
    }
  } finally {
    await consumer.remove();
  }
  log('Building installed UI fixtures and running the personal galleries');
  for (const [name, packageProblems] of await checkAstroFixture(
    packages,
    runCommand,
    runGalleryCommand,
  )) {
    addProblems(problems, name, packageProblems);
  }
  for (const { packed, reference } of withReferences) {
    log(`Linting ${packed.packedManifest.name} and its TSDoc`);
    addProblems(problems, packed.packedManifest.name, [
      ...(await checkPackagingLint(packed, runCommand)),
      ...checkTsdoc(reference),
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
    workspaceProblems,
  };
};

/**
 * Prints each package's result and counts the problems.
 * @param result The check result.
 * @param log Prints one line.
 * @returns The number of problems.
 */
const reportResult = (
  { entries, problems, workspaceProblems }: IReleaseCheckResult,
  log: (message: string) => void,
): number => {
  let count = workspaceProblems.length;
  if (workspaceProblems.length > 0) {
    log('FAIL workspaces');
    for (const problem of workspaceProblems) {
      log(`  - ${problem}`);
    }
  }
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
 * @throws
 * - PROCESS_INTERRUPTED: The process was interrupted by {signal}.
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
 * - PROCESS_INTERRUPTED: The process was interrupted by {signal}.
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
