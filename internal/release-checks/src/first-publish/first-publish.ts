import { join } from 'node:path';

import { acquireLock, hashFile, installVerifiedFile } from 'jg-fs';

import { MAX_TARBALL_BYTES } from '../shared/constants.ts';
import type { IReleaseManifestEntry } from '../shared/types.ts';

import { type INpmSession, withIsolatedNpm } from './npm-session.ts';
import { type IWaitForRegistryPoll, observeRegistry, reconcileRegistry } from './registry.ts';
import { qualifyRelease } from './release.ts';
import { readFirstPublishState, writeFirstPublishState } from './state.ts';
import type { IFirstPublishOptions } from './types.ts';

const STATE_FILE = 'first-publish-state.json';
const LOCK_DIRECTORY = 'first-publish.lock';

type IFirstPublishOperator = {
  confirm: (prompt: string, signal: AbortSignal) => Promise<boolean>;
  log: (message: string) => void;
  environment?: NodeJS.ProcessEnv;
  waitForPoll?: IWaitForRegistryPoll;
};

/**
 * Stages each selected tarball in the private npm directory before authentication.
 * @param releaseDirectory The checked release bundle.
 * @param entries The selected entries in approved order.
 * @param npm The isolated npm session.
 * @returns A promise that resolves once every staged tarball matches its approved digest.
 */
const stageSelectedTarballs = async (
  releaseDirectory: string,
  entries: IReleaseManifestEntry[],
  npm: INpmSession,
): Promise<void> => {
  for (const entry of entries) {
    const source = join(releaseDirectory, entry.file);
    const identity = await hashFile(source, { maxBytes: MAX_TARBALL_BYTES, signal: npm.signal });
    if (identity.sha256 !== entry.sha256) {
      throw new Error('The local tarball differs from the approved release: ' + entry.file);
    }
    await installVerifiedFile(source, join(npm.directory, entry.file), identity, {
      signal: npm.signal,
    });
  }
};

/**
 * Publishes an approved batch or reconciles its recorded first-publish attempts.
 * @param root The qualified checkout.
 * @param options The approved release identity and selections.
 * @param operator The interactive operator interface.
 * @returns A promise that resolves once every selection matches a public artifact.
 */
export const runFirstPublish = async (
  root: string,
  options: IFirstPublishOptions,
  { confirm, log, environment = process.env, waitForPoll }: IFirstPublishOperator,
): Promise<void> => {
  const { directory, entries, manifest } = await qualifyRelease(root, options);
  const lock = await acquireLock(join(directory, LOCK_DIRECTORY), {
    metadata: { operation: 'npm-first-publish', sourceCommit: options.sourceCommit },
  });
  try {
    const statePath = join(directory, STATE_FILE);
    const state = await readFirstPublishState(statePath, options, manifest);
    const save = (): Promise<void> => writeFirstPublishState(statePath, state);
    await withIsolatedNpm(root, environment, log, async (npm) => {
      await stageSelectedTarballs(directory, entries, npm);
      let confirmedAccount = false;
      for (const entry of entries) {
        let attempt = state.attempts.find(({ name }) => name === entry.name);
        const spec = entry.name + '@' + entry.version;
        const pendingStageMessage =
          'npm still shows a placeholder for ' +
          spec +
          '. Verify its stage bytes before approving any matching entry in Staged Packages. If the queue is empty, resume after npm finishes processing.';
        if (options.stage) {
          if (!attempt) {
            throw new Error('Stage evidence requires a recorded first-publish attempt.');
          }
          const { id, tarball } = options.stage;
          if (attempt.isPublished || (attempt.stageId && attempt.stageId !== id)) {
            throw new Error('Stage evidence does not match the pending first-publish attempt.');
          }
          // A dashboard selection confirms a stage even if its download cannot be verified yet.
          attempt.requiresStageEvidence = true;
          await save();
          const identity = await hashFile(tarball, {
            maxBytes: MAX_TARBALL_BYTES,
            signal: npm.signal,
          });
          if (identity.sha256 !== attempt.sha256) {
            throw new Error('The downloaded stage does not match the approved tarball.');
          }
          attempt.stageId = id;
          await save();
          log(
            'Verified stage ' +
              id +
              ' for ' +
              spec +
              '. Approve that entry on npmjs.com, then resume without stage arguments.',
          );
          throw new Error('The release is pending developer approval on npmjs.com.');
        }

        if (attempt) {
          log('Checking npm for ' + spec + '.');
          const observation = await reconcileRegistry(npm, entry, attempt, waitForPoll);
          if (observation === 'verified') {
            if (attempt.requiresStageEvidence && !attempt.stageId) {
              throw new Error(
                'Verified stage evidence is required for ' +
                  spec +
                  '. Resume with --stage-id and --staged-tarball.',
              );
            }
            attempt.isPublished = true;
            await save();
            log('Verified ' + spec + ' on npm.');
            continue;
          }
          if (observation === 'staged') {
            throw new Error(pendingStageMessage);
          }
          if (
            observation !== 'unused' ||
            attempt.isPublished ||
            options.retryUncertain !== entry.name ||
            !(await confirm(
              'Confirm the previous attempt for ' + spec + ' was definitively unaccepted',
              npm.signal,
            ))
          ) {
            throw new Error(
              'Publication of ' +
                spec +
                ' is unresolved. Reconcile the prior submission before retrying.',
            );
          }
        } else if (options.retryUncertain === entry.name) {
          throw new Error('--retry-uncertain requires a recorded first-publish attempt.');
        } else {
          await observeRegistry(npm, entry, undefined);
        }

        // check an unused name again immediately before submitting any bytes
        if (!confirmedAccount) {
          const account = await npm.login();
          const selection = entries.map(({ name, version }) => name + '@' + version).join(', ');
          if (
            !(await confirm('Use npm account ' + account + ' to publish ' + selection, npm.signal))
          ) {
            throw new Error('The developer did not confirm the isolated npm account.');
          }
          confirmedAccount = true;
        }
        if ((await observeRegistry(npm, entry, undefined)) !== 'unused') {
          throw new Error('The npm name is already occupied: ' + entry.name);
        }

        if (attempt) {
          delete attempt.stageId;
          attempt.requiresStageEvidence = false;
        } else {
          attempt = { ...entry, isPublished: false, requiresStageEvidence: false };
          state.attempts.push(attempt);
        }
        await save();
        npm.signal.throwIfAborted();
        const submitted = await npm.publish(join(npm.directory, entry.file));
        npm.signal.throwIfAborted();
        if (submitted.exitCode !== 0) {
          log(
            'npm exited before confirming ' +
              spec +
              '. Checking the registry without resubmitting.',
          );
        } else {
          log('Checking npm for ' + spec + ' while it processes the upload.');
        }
        const observation = await reconcileRegistry(npm, entry, attempt, waitForPoll);
        if (observation === 'staged') {
          throw new Error(pendingStageMessage);
        }
        if (observation !== 'verified') {
          throw new Error(
            'Publication of ' +
              spec +
              ' is unresolved. Reconcile the prior submission before retrying.',
          );
        }
        attempt.isPublished = true;
        await save();
        log('Verified ' + spec + ' on npm.');
      }
    });
  } finally {
    await lock.release();
  }
};
