import { hasErrorCode } from 'jg-exception';
import { ERRORS, withPackedConsumer, type IPackedConsumer } from 'jg-package-check';
import { createShutdownSignal } from 'jg-process';

import type { IPackedPackage } from './types.ts';

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
 * Qualifies this release's installed packages and the React types their examples require.
 * @param packages The exact tarballs to install together.
 * @param verify Checks to run while the consumer exists.
 * @returns The checks' result after the consumer is removed.
 * @throws
 * - PACKED_CONSUMER_SETUP_FAILED: Unable to prepare the packed consumer.
 * - PACKED_CONSUMER_CLEANUP_FAILED: Unable to remove the packed consumer.
 * - PROCESS_INTERRUPTED: The process was interrupted by {signal}.
 */
export const withReleaseConsumer = async <T>(
  packages: IPackedPackage[],
  verify: (consumer: IPackedConsumer) => Promise<T>,
): Promise<T> => {
  const { signal, dispose } = createShutdownSignal();
  try {
    const result = await withPackedConsumer(
      {
        packageManager: 'npm',
        tarballs: packages.map(({ tarballPath }) => tarballPath),
        additionalPackages: listPeerTypePackages(packages),
        installTimeoutSeconds: 300,
        signal,
      },
      verify,
    );
    signal.throwIfAborted();
    return result;
  } catch (error) {
    if (!hasErrorCode(error, ERRORS.PACKED_CONSUMER_CLEANUP_FAILED)) signal.throwIfAborted();
    throw error;
  } finally {
    dispose();
  }
};
