import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { DEPENDENCY_FIELDS } from '../shared/constants.ts';
import type { IPackageManifest } from '../shared/types.ts';

// a publishable package of the workspace
export type IWorkspacePackage = {
  name: string;
  version: string;
  directory: string;
  manifest: IPackageManifest;
};

// directory, relative to the repository root, that holds every publishable package
const PACKAGES_DIRECTORY = 'packages';

/**
 * Lists the names a package depends on through its runtime dependency fields.
 * @param manifest The package manifest.
 * @returns The dependency names.
 */
export const getRuntimeDependencyNames = (manifest: IPackageManifest): string[] =>
  DEPENDENCY_FIELDS.flatMap((field) => Object.keys(manifest[field] ?? {}));

/**
 * Orders packages so every package comes after the siblings it depends on, breaking ties by name.
 * @param packages The packages to order.
 * @returns The packages in dependency order.
 * @throws
 * - The packages depend on each other in a cycle: {names}
 */
export const sortByDependencies = (packages: IWorkspacePackage[]): IWorkspacePackage[] => {
  const byName = new Map(
    packages.map((workspacePackage) => [workspacePackage.name, workspacePackage]),
  );
  const pending = new Map(
    packages.map((workspacePackage) => [
      workspacePackage.name,
      new Set(
        getRuntimeDependencyNames(workspacePackage.manifest).filter((name) => byName.has(name)),
      ),
    ]),
  );
  const ordered: IWorkspacePackage[] = [];
  while (pending.size > 0) {
    const [ready] = [...pending.entries()]
      .filter(([, dependencies]) => dependencies.size === 0)
      .map(([name]) => name)
      .sort();
    if (ready === undefined) {
      throw new Error(
        `The packages depend on each other in a cycle: ${[...pending.keys()].sort().join(', ')}`,
      );
    }
    pending.delete(ready);
    for (const dependencies of pending.values()) {
      dependencies.delete(ready);
    }
    ordered.push(byName.get(ready)!);
  }
  return ordered;
};

/**
 * Finds the packages under `packages/` that aren't private, in dependency order.
 * @param rootDirectory The repository root.
 * @returns A promise that resolves to the publishable packages.
 * @throws
 * - The packages depend on each other in a cycle: {names}
 */
export const findPublishablePackages = async (
  rootDirectory: string,
): Promise<IWorkspacePackage[]> => {
  const packagesDirectory = join(rootDirectory, PACKAGES_DIRECTORY);
  const entries = await readdir(packagesDirectory, { withFileTypes: true }).catch(
    (error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return [];
      }
      throw error;
    },
  );
  const packages: IWorkspacePackage[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const directory = join(packagesDirectory, entry.name);
    const manifest = JSON.parse(
      await readFile(join(directory, 'package.json'), 'utf8'),
    ) as IPackageManifest;
    if (manifest.private !== true) {
      packages.push({ name: manifest.name, version: manifest.version, directory, manifest });
    }
  }
  return sortByDependencies(packages);
};

// the file at the repository root that lists the workspace directories
const WORKSPACE_FILE = 'pnpm-workspace.yaml';

// a workspace directory, private or not, with its manifest
export type IWorkspace = {
  directory: string;
  manifest: IPackageManifest;
};

/**
 * Reads the directory patterns in pnpm-workspace.yaml's `packages` list, such as `packages/*`.
 * @param yaml The file's text.
 * @returns The patterns, in order.
 */
export const readWorkspacePatterns = (yaml: string): string[] => {
  const patterns: string[] = [];
  let isInPackages = false;
  for (const line of yaml.split('\n')) {
    if (/^packages:\s*$/.test(line)) {
      isInPackages = true;
      continue;
    }
    if (!isInPackages || line.trim() === '' || line.trim().startsWith('#')) {
      continue;
    }
    const item = /^\s+-\s+(.+?)\s*$/.exec(line);
    if (item === null) {
      break;
    }
    patterns.push((item[1] ?? '').replace(/^['"]|['"]$/g, ''));
  }
  return patterns;
};

/**
 * Lists the directories a workspace pattern names: the directory itself, or with `/*`, each of its
 * subdirectories.
 * @param rootDirectory The repository root.
 * @param pattern The pattern, such as `packages/*` or `website`.
 * @returns A promise that resolves to the directories.
 * @throws
 * - pnpm-workspace.yaml has a pattern the release checks can't read: {pattern}
 */
const listPatternDirectories = async (
  rootDirectory: string,
  pattern: string,
): Promise<string[]> => {
  if (pattern.endsWith('/*') && !pattern.slice(0, -2).includes('*')) {
    const parent = join(rootDirectory, pattern.slice(0, -2));
    const entries = await readdir(parent, { withFileTypes: true }).catch(() => []);
    return entries.filter((entry) => entry.isDirectory()).map((entry) => join(parent, entry.name));
  }
  if (pattern.includes('*') || pattern.startsWith('!')) {
    throw new Error(`pnpm-workspace.yaml has a pattern the release checks can't read: ${pattern}`);
  }
  return [join(rootDirectory, pattern)];
};

/**
 * Finds every workspace that pnpm-workspace.yaml lists and that has a package.json, private ones
 * included.
 * @param rootDirectory The repository root.
 * @returns A promise that resolves to the workspaces, in the file's order.
 * @throws
 * - pnpm-workspace.yaml has a pattern the release checks can't read: {pattern}
 */
export const findWorkspaces = async (rootDirectory: string): Promise<IWorkspace[]> => {
  const yaml = await readFile(join(rootDirectory, WORKSPACE_FILE), 'utf8');
  const workspaces: IWorkspace[] = [];
  for (const pattern of readWorkspacePatterns(yaml)) {
    for (const directory of await listPatternDirectories(rootDirectory, pattern)) {
      const manifest = await readFile(join(directory, 'package.json'), 'utf8').catch(() => null);
      if (manifest !== null) {
        workspaces.push({ directory, manifest: JSON.parse(manifest) as IPackageManifest });
      }
    }
  }
  return workspaces;
};
