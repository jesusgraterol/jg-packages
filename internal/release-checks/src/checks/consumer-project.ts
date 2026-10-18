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
 * Lists the React types a package with a React peer was tested with, so its JSX recipes and its
 * hooks typecheck in the consumer project, as they do in an app that has React. npm installs the
 * peers themselves, but types aren't peers.
 * @param packages The packed packages.
 * @returns The type packages, as `name@version`, without repeats.
 */
export const listPeerTypePackages = (packages: IPackedPackage[]): string[] => [
  ...new Set(
    packages.flatMap(({ packedManifest }) => {
      const version = packedManifest.devDependencies?.['@types/react'];
      return packedManifest.peerDependencies?.['react'] === undefined || version === undefined
        ? []
        : [`@types/react@${version}`];
    }),
  ),
];

/**
 * Installs every tarball together into a temporary ESM project, which checks 2 and 8 share, with
 * the React types a package with a React peer was tested with.
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
        ...listPeerTypePackages(packages),
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
