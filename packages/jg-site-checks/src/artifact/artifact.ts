import { lstat, opendir, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { assertNoLinksBelow, isPathWithin, readBoundedFile } from 'jg-fs';

import type { IStaticSiteLimits } from '../checker/types.js';
import { invalidSiteBuild } from '../errors.js';

import { EXCLUDED_DIRECTORIES } from './paths.js';
import type { IArtifactIndex } from './types.js';

/**
 * Indexes ordinary files once, without following links, and exposes budgeted reads inside that root.
 * @param artifactRoot The trusted artifact root.
 * @param limits The traversal and read limits.
 * @returns The verified file inventory and text reader.
 */
export const indexArtifact = async (
  artifactRoot: string,
  limits: IStaticSiteLimits,
): Promise<IArtifactIndex> => {
  const requestedRoot = resolve(artifactRoot);
  if (!(await lstat(requestedRoot)).isDirectory())
    invalidSiteBuild('The artifact root is not a directory.');
  const root = await realpath(requestedRoot);
  const files = new Set<string>();
  const pending = [''];
  let entries = 0;
  for (let relative = pending.pop(); relative !== undefined; relative = pending.pop()) {
    const directory = join(root, relative);
    if (relative !== '') await assertNoLinksBelow(root, directory);
    for await (const entry of await opendir(directory)) {
      entries += 1;
      if (entries > limits.entries) invalidSiteBuild('The artifact exceeds the entry limit.');
      if (EXCLUDED_DIRECTORIES.has(entry.name))
        invalidSiteBuild('An excluded directory appears in the artifact.');
      const file = relative === '' ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) pending.push(file);
      else if (entry.isFile()) files.add(file);
      else invalidSiteBuild(`The artifact contains an unsupported file or link: ${file}`);
    }
  }

  let remaining = limits.totalTextBytes;
  const readText = async (file: string): Promise<string> => {
    const target = resolve(root, file);
    if (!files.has(file) || !isPathWithin(root, target))
      invalidSiteBuild(`Missing or unsafe artifact file: ${file}`);
    if (remaining <= 0) invalidSiteBuild('The artifact exceeds the total text read budget.');
    await assertNoLinksBelow(root, target);
    if (!(await lstat(target)).isFile())
      invalidSiteBuild(`The artifact file changed type: ${file}`);
    const bytes = await readBoundedFile(target, Math.min(limits.textBytes, remaining));
    remaining -= bytes.byteLength;
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  };
  return { files, readText };
};
