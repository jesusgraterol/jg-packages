import { access, readFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

// an `exports` subpath and the TypeScript source that documents it
export type ISourceEntryPoint = {
  subpath: string;
  sourceFile: string;
};

// the manifest fields the reference reads
export type IPackageManifest = {
  name: string;
  version: string;
  exports: Record<string, unknown>;
};

// extensions of built JavaScript files that map back to a TypeScript source
const JAVASCRIPT_EXTENSION = /\.m?js$/;

/**
 * Reads the fields of a package's manifest that the reference needs.
 * @param packageDirectory The package directory.
 * @returns A promise that resolves to the manifest's name, version, and exports.
 * @throws
 * - The package has no name, version, or exports map: {packageDirectory}
 */
export const readPackageManifest = async (packageDirectory: string): Promise<IPackageManifest> => {
  const manifest = JSON.parse(await readFile(join(packageDirectory, 'package.json'), 'utf8')) as {
    name?: unknown;
    version?: unknown;
    exports?: unknown;
  };
  if (
    typeof manifest.name !== 'string' ||
    typeof manifest.version !== 'string' ||
    typeof manifest.exports !== 'object' ||
    manifest.exports === null ||
    Array.isArray(manifest.exports)
  ) {
    throw new Error(`The package has no name, version, or exports map: ${packageDirectory}`);
  }
  return {
    name: manifest.name,
    version: manifest.version,
    exports: manifest.exports as Record<string, unknown>,
  };
};

/**
 * Picks the file an `exports` target loads by default: the target itself when it's a string, or
 * its `default` condition.
 * @param target One `exports` value.
 * @returns The target path, or `undefined` when there is none.
 */
const getDefaultTarget = (target: unknown): string | undefined => {
  if (typeof target === 'string') {
    return target;
  }
  if (typeof target === 'object' && target !== null && 'default' in target) {
    const { default: defaultTarget } = target;
    return typeof defaultTarget === 'string' ? defaultTarget : undefined;
  }
  return undefined;
};

/**
 * Maps a target to the TypeScript source it comes from: `./dist/x.js` to `./src/x.ts`, and a
 * `.ts` target to itself. Other targets, such as stylesheets and Astro components, have no TSDoc.
 * @param target The default target of one subpath.
 * @returns The source path relative to the package, or `undefined`.
 */
const toSourcePath = (target: string): string | undefined => {
  if (target.endsWith('.ts') && !target.endsWith('.d.ts')) {
    return target;
  }
  if (target.startsWith('./dist/') && JAVASCRIPT_EXTENSION.test(target)) {
    return `./src/${target.slice('./dist/'.length).replace(JAVASCRIPT_EXTENSION, '.ts')}`;
  }
  return undefined;
};

/**
 * Lists the `exports` subpaths whose code has TypeScript sources, with the absolute path of each
 * source, in the order the manifest declares them.
 * @param packageDirectory The package directory.
 * @param exportsMap The manifest's `exports` map.
 * @returns A promise that resolves to the documented entry points.
 * @throws
 * - The exports target points outside the package: {subpath}
 * - The source of an exports target doesn't exist: {sourceFile}
 */
export const getSourceEntryPoints = async (
  packageDirectory: string,
  exportsMap: Record<string, unknown>,
): Promise<ISourceEntryPoint[]> => {
  const entryPoints: ISourceEntryPoint[] = [];
  for (const [subpath, target] of Object.entries(exportsMap)) {
    const defaultTarget = getDefaultTarget(target);
    const sourcePath = defaultTarget === undefined ? undefined : toSourcePath(defaultTarget);
    if (sourcePath === undefined) {
      continue;
    }
    const sourceFile = resolve(packageDirectory, sourcePath);
    const relativePath = relative(packageDirectory, sourceFile);
    if (isAbsolute(relativePath) || relativePath === '..' || relativePath.startsWith(`..${sep}`)) {
      throw new Error(`The exports target points outside the package: ${subpath}`);
    }
    try {
      await access(sourceFile);
    } catch (error) {
      throw new Error(`The source of an exports target doesn't exist: ${sourceFile}`, {
        cause: error,
      });
    }
    entryPoints.push({ subpath, sourceFile });
  }
  return entryPoints;
};
