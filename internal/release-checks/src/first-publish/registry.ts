import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { hashFile } from 'jg-fs';
import { valid } from 'semver';

import {
  MAX_TARBALL_BYTES,
  REGISTRY_POLL_INTERVAL_SECONDS,
  REGISTRY_WAIT_SECONDS,
} from '../shared/constants.ts';
import type { IReleaseManifestEntry } from '../shared/types.ts';

import type { INpmSession } from './npm-session.ts';
import type { IFirstPublishAttempt } from './types.ts';

const STAGED_PLACEHOLDER = '0.0.0-stage';

export type IRegistryResult = 'unused' | 'pending' | 'staged' | 'verified';
export type IWaitForRegistryPoll = (signal: AbortSignal) => Promise<boolean>;

/**
 * Reads the observed registry state and verifies the exact approved tarball when it is available.
 * @param npm The private npm session.
 * @param entry The approved package.
 * @param attempt The recorded state, if already attempted.
 * @param deadline The observation's overall deadline.
 * @returns The observed state.
 */
export const observeRegistry = async (
  npm: INpmSession,
  entry: IReleaseManifestEntry,
  attempt: IFirstPublishAttempt | undefined,
  deadline?: AbortSignal,
): Promise<IRegistryResult> => {
  const result = await npm.capture(['view', entry.name, 'versions', '--json'], deadline);
  if (result.exitCode !== 0) {
    if (/\bE404\b/.test(result.stderr)) {
      return 'unused';
    }
    throw new Error('Could not read npm registry versions for ' + entry.name + '.');
  }
  const parsed: unknown = JSON.parse(result.stdout);
  const versions: unknown[] =
    typeof parsed === 'string' ? [parsed] : Array.isArray(parsed) ? parsed : [];
  if (
    (typeof parsed !== 'string' && !Array.isArray(parsed)) ||
    !versions.every((version) => typeof version === 'string' && valid(version) === version)
  ) {
    throw new Error('npm returned invalid registry versions for ' + entry.name + '.');
  }
  if (versions.length === 0) {
    return 'unused';
  }
  if (
    !attempt ||
    versions.some((version) => version !== entry.version && version !== STAGED_PLACEHOLDER)
  ) {
    throw new Error('The npm name is already occupied: ' + entry.name);
  }
  if (
    !versions.includes(entry.version) ||
    ((versions.includes(STAGED_PLACEHOLDER) || attempt.requiresStageEvidence) && !attempt.stageId)
  ) {
    return 'staged';
  }

  const download = await mkdtemp(join(npm.directory, 'registry-'));
  try {
    const spec = entry.name + '@' + entry.version;
    const packed = await npm.capture(
      ['pack', spec, '--ignore-scripts', '--pack-destination', download, '--json'],
      deadline,
    );
    if (packed.exitCode !== 0) {
      if (/\bE404\b/.test(packed.stderr)) {
        return 'pending';
      }
      throw new Error('Could not download the public npm artifact for ' + spec + '.');
    }
    const signal = deadline ? AbortSignal.any([npm.signal, deadline]) : npm.signal;
    const identity = await hashFile(join(download, entry.file), {
      maxBytes: MAX_TARBALL_BYTES,
      signal,
    });
    if (identity.sha256 !== entry.sha256) {
      throw new Error('The public npm artifact bytes conflict with the approved tarball: ' + spec);
    }
    const tags = await npm.capture(['view', entry.name, 'dist-tags', '--json'], deadline);
    if (tags.exitCode !== 0) {
      throw new Error('Could not read npm dist-tags for ' + entry.name + '.');
    }
    const observedTags: unknown = JSON.parse(tags.stdout);
    if (!observedTags || typeof observedTags !== 'object' || !('latest' in observedTags)) {
      return 'pending';
    }
    return observedTags.latest === entry.version ? 'verified' : 'pending';
  } finally {
    await rm(download, { recursive: true, force: true });
  }
};

/**
 * Checks a recorded submission until it can be verified or the reconciliation window closes.
 * @param npm The private npm session.
 * @param entry The approved package.
 * @param attempt The recorded attempt.
 * @param waitForPoll An optional test seam for the polling interval.
 * @returns The last verified registry observation.
 */
export const reconcileRegistry = async (
  npm: INpmSession,
  entry: IReleaseManifestEntry,
  attempt: IFirstPublishAttempt,
  waitForPoll: IWaitForRegistryPoll = async (signal) => {
    await delay(REGISTRY_POLL_INTERVAL_SECONDS * 1000, undefined, { signal });
    return true;
  },
): Promise<IRegistryResult> => {
  const deadline = AbortSignal.timeout(REGISTRY_WAIT_SECONDS * 1000);
  const signal = AbortSignal.any([deadline, npm.signal]);
  let observation: IRegistryResult = 'pending';
  try {
    do {
      signal.throwIfAborted();
      observation = await observeRegistry(npm, entry, attempt, deadline);
      if (observation === 'verified' || observation === 'staged') {
        return observation;
      }
    } while (await waitForPoll(signal));
  } catch (error) {
    npm.signal.throwIfAborted();
    if (!deadline.aborted) {
      throw error;
    }
  }
  return observation;
};
