// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, beforeAll, expect, test } from 'vitest';

import { runGit } from '../run-git/index.js';
import { createTemporaryDirectory, git } from '../shared/repository.test-utils.js';

import { calculateGitBlobObjectId } from './blob-id.js';

let directory: string;

beforeAll(async () => {
  directory = await createTemporaryDirectory('blob-id');
  for (const algorithm of ['sha1', 'sha256']) {
    await mkdir(join(directory, algorithm));
    await git(join(directory, algorithm), ['init', '--quiet', `--object-format=${algorithm}`]);
  }
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

test.each(['sha1', 'sha256'] as const)(
  'matches git hash-object for random bytes in a %s repository',
  async (algorithm) => {
    const content = randomBytes(4096);

    const result = await runGit(['hash-object', '--stdin'], {
      cwd: join(directory, algorithm),
      isolateConfig: true,
      input: content,
    });

    expect(calculateGitBlobObjectId(content, { algorithm })).toBe(result.stdout.trim());
  },
);
