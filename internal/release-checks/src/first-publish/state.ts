import { ERRORS, readBoundedFile, writeFileAtomic } from 'jg-fs';

import type { IReleaseManifestEntry } from '../shared/types.ts';

import { STAGE_ID } from './options.ts';
import type { IFirstPublishAttempt, IFirstPublishState, IReleaseIdentity } from './types.ts';

const STATE_MAX_BYTES = 256 * 1024;

/**
 * Reads a release attempt log and refuses incompatible or malformed state.
 * @param path The release's state file.
 * @param identity The approved source and manifest digests.
 * @param manifest The approved entries used to validate persisted attempts.
 * @returns The verified state or a new log for an unattempted release.
 */
export const readFirstPublishState = async (
  path: string,
  identity: IReleaseIdentity,
  manifest: IReleaseManifestEntry[],
): Promise<IFirstPublishState> => {
  let text: string;
  try {
    text = (await readBoundedFile(path, STATE_MAX_BYTES)).toString('utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === ERRORS.NON_EXISTENT_FILE) {
      return {
        sourceCommit: identity.sourceCommit,
        manifestSha256: identity.manifestSha256,
        attempts: [],
      };
    }
    throw error;
  }
  const stored: unknown = JSON.parse(text);
  if (
    !stored ||
    typeof stored !== 'object' ||
    !('sourceCommit' in stored) ||
    stored.sourceCommit !== identity.sourceCommit ||
    !('manifestSha256' in stored) ||
    stored.manifestSha256 !== identity.manifestSha256 ||
    !('attempts' in stored) ||
    !Array.isArray(stored.attempts)
  ) {
    throw new Error('First-publish state does not match the approved release.');
  }
  const attempts: IFirstPublishAttempt[] = [];
  for (const item of stored.attempts as unknown[]) {
    if (!item || typeof item !== 'object') {
      throw new Error('First-publish state contains an invalid attempt.');
    }
    const attempt = item as Partial<Record<keyof IFirstPublishAttempt, unknown>>;
    const entry = manifest.find(({ name }) => name === attempt.name);
    if (
      !entry ||
      attempts.some(({ name }) => name === entry.name) ||
      entry.version !== attempt.version ||
      entry.sha256 !== attempt.sha256 ||
      entry.file !== attempt.file ||
      typeof attempt.isPublished !== 'boolean' ||
      typeof attempt.requiresStageEvidence !== 'boolean' ||
      (attempt.stageId !== undefined &&
        (typeof attempt.stageId !== 'string' || !STAGE_ID.test(attempt.stageId)))
    ) {
      throw new Error('First-publish state contains an invalid attempt.');
    }
    attempts.push({
      ...entry,
      isPublished: attempt.isPublished,
      requiresStageEvidence: attempt.requiresStageEvidence,
      ...(attempt.stageId === undefined ? {} : { stageId: attempt.stageId }),
    });
  }
  return { sourceCommit: identity.sourceCommit, manifestSha256: identity.manifestSha256, attempts };
};

/**
 * Persists a release attempt before its external effect or after reconciliation.
 * @param path The state file protected by the release lock.
 * @param state The nonsecret release attempt log.
 * @returns A promise that resolves once the log has been written atomically.
 */
export const writeFirstPublishState = (path: string, state: IFirstPublishState): Promise<void> =>
  writeFileAtomic(path, JSON.stringify(state, null, 2) + '\n', 0o600);
