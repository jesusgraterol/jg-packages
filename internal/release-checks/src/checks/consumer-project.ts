import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { IRunCommand } from '../shared/types.ts';
import type { IPackedPackage } from './types.ts';

// a temporary ESM project with every tarball installed, the way a consumer installs them
export type IConsumerProject = {
  directory: string;

  // why the install failed, or undefined when it succeeded
  installProblem: string | undefined;

  // removes the project
  remove: () => Promise<void>;
};

/**
 * Installs every tarball together into a temporary ESM project, which checks 2 and 8 share.
 * @param packages The packed packages.
 * @param runCommand Runs a command.
 * @returns A promise that resolves to the project.
 */
export const installConsumerProject = async (
  packages: IPackedPackage[],
  runCommand: IRunCommand,
): Promise<IConsumerProject> => {
  const directory = await mkdtemp(join(tmpdir(), 'jg-release-consumer-'));
  const remove = (): Promise<void> => rm(directory, { recursive: true, force: true });
  try {
    await writeFile(
      join(directory, 'package.json'),
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
      { cwd: directory },
    );
    return {
      directory,
      installProblem:
        install.exitCode === 0
          ? undefined
          : `couldn't be installed from its tarball: ${install.stderr.trim()}`,
      remove,
    };
  } catch (error) {
    await remove();
    throw error;
  }
};
