import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { IRegistry, IRegistryPackage } from '../checks/types.ts';
import type { IRunCommand } from '../shared/types.ts';

/**
 * Creates registry access through the npm CLI, so it follows the user's npm configuration.
 * @param runCommand Runs a command.
 * @returns The registry.
 */
export const createNpmRegistry = (runCommand: IRunCommand): IRegistry => ({
  getPackage: async (name: string): Promise<IRegistryPackage | undefined> => {
    const result = await runCommand('npm', ['view', name, 'versions', 'dist-tags', '--json']);
    if (result.exitCode !== 0) {
      if (result.stderr.includes('E404')) {
        return undefined;
      }
      throw new Error(`npm view ${name} failed: ${result.stderr.trim()}`);
    }
    const info = JSON.parse(result.stdout) as {
      versions?: string | string[];
      'dist-tags'?: Record<string, string>;
    };
    const versions = info.versions ?? [];
    return {
      versions: Array.isArray(versions) ? versions : [versions],
      distTags: info['dist-tags'] ?? {},
    };
  },
  downloadTarball: async (name: string, version: string): Promise<Buffer> => {
    const directory = await mkdtemp(join(tmpdir(), 'jg-release-published-'));
    try {
      const result = await runCommand(
        'npm',
        ['pack', `${name}@${version}`, '--pack-destination', directory, '--json'],
        {
          cwd: directory,
        },
      );
      if (result.exitCode !== 0) {
        throw new Error(`npm pack ${name}@${version} failed: ${result.stderr.trim()}`);
      }
      const [packed] = JSON.parse(result.stdout) as { filename: string }[];
      if (packed === undefined) {
        throw new Error(`npm pack ${name}@${version} produced no tarball.`);
      }
      return await readFile(join(directory, packed.filename));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
});
