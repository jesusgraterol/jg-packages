import { parseStrictArgs } from 'jg-process';

import type { IFirstPublishOptions } from './types.ts';

const COMMIT = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
export const SHA256 = /^[0-9a-f]{64}$/;
export const PACKAGE_NAME = /^jg-[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const STAGE_ID = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Reads the approved release identity and exact package selections.
 * @param args The script arguments.
 * @returns The validated selections and optional recovery inputs.
 */
export const parseFirstPublishOptions = (args: string[]): IFirstPublishOptions => {
  const {
    'source-commit': sourceCommit,
    'manifest-sha256': manifestSha256,
    package: packages,
    'retry-uncertain': retryUncertain,
    'stage-id': stageId,
    'staged-tarball': stagedTarball,
  } = parseStrictArgs(args, {
    'source-commit': { type: 'string' },
    'manifest-sha256': { type: 'string' },
    package: { type: 'string', multiple: true },
    'retry-uncertain': { type: 'string' },
    'stage-id': { type: 'string' },
    'staged-tarball': { type: 'string' },
  });
  if (
    !sourceCommit ||
    !COMMIT.test(sourceCommit) ||
    !manifestSha256 ||
    !SHA256.test(manifestSha256)
  ) {
    throw new Error('Supply the approved --source-commit and --manifest-sha256.');
  }
  if (
    packages.length === 0 ||
    new Set(packages).size !== packages.length ||
    !packages.every((name) => PACKAGE_NAME.test(name))
  ) {
    throw new Error('Supply one --package for each distinct JG package in the batch.');
  }
  if (retryUncertain !== undefined && !packages.includes(retryUncertain)) {
    throw new Error('--retry-uncertain must name a selected package.');
  }

  const options: IFirstPublishOptions = { sourceCommit, manifestSha256, packages };
  if (retryUncertain !== undefined) {
    options.retryUncertain = retryUncertain;
  }
  if (stageId !== undefined || stagedTarball !== undefined) {
    if (
      !stageId ||
      !STAGE_ID.test(stageId) ||
      !stagedTarball ||
      packages.length !== 1 ||
      retryUncertain
    ) {
      throw new Error('Use --stage-id and --staged-tarball together with exactly one --package.');
    }
    options.stage = { id: stageId, tarball: stagedTarball };
  }
  return options;
};
