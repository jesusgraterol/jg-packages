import { realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { extractMessage } from 'jg-exception';
import { isPathWithin, readBoundedFile } from 'jg-fs';
import { runProcess } from 'jg-process';

import type { IPackedConsumer } from '../consumer/index.js';

import type { IPackedExportCheck } from './types.js';

const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];
const MAX_MANIFEST_BYTES = 1024 * 1024;
const WORKSPACE_RANGE = /^(?:workspace|catalog):/;
const CHECK_PRIVATE = `
  try { import.meta.resolve(process.argv[1]); process.exitCode = 1; }
  catch (error) { if (error?.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw error; }
`;

/**
 * Reads an installed manifest and checks its dependency ranges for unpublished placeholders.
 * @param directory The consumer directory.
 * @param name The validated package name.
 * @returns One diagnostic per placeholder.
 */
const checkManifest = async (directory: string, name: string): Promise<string[]> => {
  const file = await realpath(join(directory, 'node_modules', name, 'package.json'));
  if (!isPathWithin(directory, file))
    throw new Error('The manifest resolves outside the consumer.');
  const manifest: unknown = JSON.parse(
    (await readBoundedFile(file, MAX_MANIFEST_BYTES)).toString('utf8'),
  );
  if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest))
    throw new Error('The installed manifest must be an object.');
  const fields = manifest as Record<string, unknown>;
  if (fields['name'] !== name)
    throw new Error('The installed manifest has a different package name.');
  return DEPENDENCY_FIELDS.flatMap((field) => {
    const dependencies = fields[field];
    if (dependencies === undefined) return [];
    if (typeof dependencies !== 'object' || dependencies === null || Array.isArray(dependencies))
      throw new Error(`The installed manifest's ${field} must be an object.`);
    return Object.entries(dependencies)
      .filter(([, range]) => typeof range === 'string' && WORKSPACE_RANGE.test(range))
      .map(([dependency, range]) => `installs with an unpublished range: ${dependency}@${range}`);
  });
};

/**
 * Checks unpublished workspace/catalog ranges, imports the requested public subpaths through Node,
 * and requires the package export map to reject each private subpath. Import checks execute the
 * installed package, so use a trusted artifact. CLI, type and browser checks are caller-owned.
 * @param consumer An installed temporary consumer.
 * @param options The name and paths to check. A root export is specified as `.`.
 * The caller's signal reason propagates if it interrupts an import check.
 * @returns Diagnostics, or an empty array when all requested checks pass.
 */
export const checkPackedExports = async (
  consumer: IPackedConsumer,
  options: IPackedExportCheck,
): Promise<string[]> => {
  const { packageName, importSubpaths = [], privateSubpaths = [], timeoutSeconds = 30 } = options;
  if (!PACKAGE_NAME.test(packageName)) return ['Invalid package name.'];
  let problems: string[];
  try {
    problems = await checkManifest(consumer.directory, packageName);
  } catch (error) {
    return [`Unable to inspect the installed manifest: ${extractMessage(error)}`];
  }
  for (const [subpaths, isPrivate] of [
    [importSubpaths, false],
    [privateSubpaths, true],
  ] as const) {
    for (const subpath of subpaths) {
      if (subpath !== '.' && !/^\.\/(?:[^/\\\s.][^/\\\s]*\/)*[^/\\\s.][^/\\\s]*$/.test(subpath)) {
        problems.push(`Invalid package subpath: ${JSON.stringify(subpath)}.`);
        continue;
      }
      const specifier = subpath === '.' ? packageName : `${packageName}/${subpath.slice(2)}`;
      try {
        const result = await runProcess({
          command: process.execPath,
          args: [
            '--input-type=module',
            '--eval',
            isPrivate ? CHECK_PRIVATE : 'await import(process.argv[1]);',
            specifier,
          ],
          cwd: consumer.directory,
          env: consumer.env,
          ...(consumer.signal === undefined ? {} : { signal: consumer.signal }),
          timeoutSeconds,
        });
        if (result.exitCode !== 0) {
          if (isPrivate) {
            problems.push(
              `exposes paths outside \`exports\`: importing ${specifier} didn't fail with ERR_PACKAGE_PATH_NOT_EXPORTED`,
            );
          } else {
            const lines = result.stderr.trim().split('\n');
            const diagnostic = lines.find((line) => /^\w*Error(?: \[[^\]]+\])?:/.test(line));
            problems.push(`can't be imported as ${specifier}: ${diagnostic ?? lines[0] ?? ''}`);
          }
        }
      } catch (error) {
        if (consumer.signal?.aborted) throw error;
        problems.push(`Unable to check ${specifier}: ${extractMessage(error)}`);
      }
    }
  }
  return problems;
};
