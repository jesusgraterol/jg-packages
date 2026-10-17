import type { IPackageManifest } from '../shared/types.ts';

// files npm always ships, whatever `files` lists
const ALWAYS_SHIPPED = new Set(['package.json', 'README.md', 'LICENSE', 'CHANGELOG.md']);

// build and test artifacts that must never ship
const FORBIDDEN_FILE = /(?:\.test-[a-z]+\.|\.tsbuildinfo$)/;

/**
 * Collects every file path an `exports` value points at, through nested conditions.
 * @param target An `exports` value.
 * @returns The paths, relative to the package root.
 */
const collectTargets = (target: unknown): string[] => {
  if (typeof target === 'string') {
    return [target];
  }
  if (typeof target === 'object' && target !== null) {
    return Object.values(target).flatMap(collectTargets);
  }
  return [];
};

/**
 * Normalizes a manifest path, such as `./dist/index.js`, to a tarball path.
 * @param path The manifest path.
 * @returns The path without a leading `./`.
 */
const toTarballPath = (path: string): string => path.replace(/^\.\//, '');

/**
 * Check 1: the tarball holds only what the package means to ship. Only the manifest, README,
 * license, changelog, and paths under `files` may ship, never test files or TypeScript build
 * info, and every `exports` and `bin` target must be there.
 * @param manifest The packed manifest.
 * @param files The tarball's files.
 * @returns One problem per offending or missing path.
 */
export const checkFileList = (manifest: IPackageManifest, files: Map<string, Buffer>): string[] => {
  const allowedRoots = (manifest.files ?? [])
    .filter((entry) => !entry.startsWith('!'))
    .map((entry) => toTarballPath(entry).replace(/\/$/, ''));
  const problems: string[] = [];
  for (const path of files.keys()) {
    const isAllowed =
      ALWAYS_SHIPPED.has(path) ||
      allowedRoots.some((root) => path === root || path.startsWith(`${root}/`));
    if (!isAllowed) {
      problems.push(`ships a file outside \`files\`: ${path}`);
    }
    if (FORBIDDEN_FILE.test(path)) {
      problems.push(`ships a test or build-info file: ${path}`);
    }
  }
  const bins =
    typeof manifest.bin === 'string' ? [manifest.bin] : Object.values(manifest.bin ?? {});
  for (const target of [...collectTargets(manifest.exports), ...bins]) {
    if (!files.has(toTarballPath(target))) {
      problems.push(`is missing an \`exports\` or \`bin\` target: ${target}`);
    }
  }
  return problems;
};
