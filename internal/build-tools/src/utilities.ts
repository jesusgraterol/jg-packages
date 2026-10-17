import { access, copyFile, glob, mkdir, rm } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

// directory each library builds into, relative to its package directory
const OUTPUT_DIRECTORY = 'dist';

// directory each library's sources live in, relative to its package directory
const SOURCE_DIRECTORY = 'src';

/**
 * Checks that a resolved path stays inside a trusted root without being the root itself.
 * @param root The trusted root directory.
 * @param target The resolved candidate path.
 * @returns Whether the target is inside the root.
 */
const isInside = (root: string, target: string): boolean => {
  const relativePath = relative(root, target);
  return (
    relativePath !== '' &&
    !isAbsolute(relativePath) &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${sep}`)
  );
};

/**
 * Fails unless the directory is a package, so a script run from the wrong place never deletes or
 * writes files outside a package.
 * @param packageDirectory The directory expected to hold a `package.json`.
 * @throws
 * - The directory is not a package (no package.json): {packageDirectory}
 */
const assertPackageDirectory = async (packageDirectory: string): Promise<void> => {
  try {
    await access(join(packageDirectory, 'package.json'));
  } catch (error) {
    throw new Error(`The directory is not a package (no package.json): ${packageDirectory}`, {
      cause: error,
    });
  }
};

/**
 * Removes a package's build output, so files from an earlier build never ship.
 * @param packageDirectory The package whose `dist` directory is removed.
 * @returns A promise that resolves once `dist` no longer exists.
 * @example
 * await cleanDist(process.cwd());
 * @throws
 * - The directory is not a package (no package.json): {packageDirectory}
 */
export const cleanDist = async (packageDirectory: string): Promise<void> => {
  await assertPackageDirectory(packageDirectory);
  await rm(join(packageDirectory, OUTPUT_DIRECTORY), { recursive: true, force: true });
};

/**
 * Copies the files matching a glob from a package's `src` directory to the same relative paths
 * under `dist`, for assets the compiler doesn't emit, such as template files.
 * @param packageDirectory The package whose files are copied.
 * @param pattern A glob relative to `src`, such as `build/templates/*.js`.
 * @returns A promise that resolves to the copied paths, relative to `src` and sorted.
 * @example
 * await copyAssets(process.cwd(), 'build/templates/*.js');
 * @throws
 * - The directory is not a package (no package.json): {packageDirectory}
 * - The asset pattern must be a relative path inside src: {pattern}
 * - No files in src match the asset pattern: {pattern}
 */
export const copyAssets = async (packageDirectory: string, pattern: string): Promise<string[]> => {
  await assertPackageDirectory(packageDirectory);
  const sourceDirectory = resolve(packageDirectory, SOURCE_DIRECTORY);
  const outputDirectory = resolve(packageDirectory, OUTPUT_DIRECTORY);
  if (
    pattern.trim() === '' ||
    isAbsolute(pattern) ||
    pattern.split(/[\\/]/).some((segment) => segment === '..')
  ) {
    throw new Error(`The asset pattern must be a relative path inside src: ${pattern}`);
  }

  const matches: string[] = [];
  for await (const match of glob(pattern, { cwd: sourceDirectory, withFileTypes: true })) {
    const sourcePath = join(match.parentPath, match.name);
    if (match.isFile() && isInside(sourceDirectory, sourcePath)) {
      matches.push(relative(sourceDirectory, sourcePath));
    }
  }
  if (matches.length === 0) {
    throw new Error(`No files in src match the asset pattern: ${pattern}`);
  }

  matches.sort();
  for (const match of matches) {
    const destination = join(outputDirectory, match);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(sourceDirectory, match), destination);
  }
  return matches.map((match) => match.split(sep).join('/'));
};
