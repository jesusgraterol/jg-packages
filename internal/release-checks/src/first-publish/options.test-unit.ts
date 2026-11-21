import { expect, test } from 'vitest';

import { parseFirstPublishOptions } from './options.ts';

const COMMIT = 'a'.repeat(40);
const DIGEST = 'b'.repeat(64);
const IDENTITY = ['--source-commit', COMMIT, '--manifest-sha256', DIGEST];

test('requires an exact release identity and distinct package selections', () => {
  expect(
    parseFirstPublishOptions([...IDENTITY, '--package', 'jg-one', '--package', 'jg-two']),
  ).toStrictEqual({
    sourceCommit: COMMIT,
    manifestSha256: DIGEST,
    packages: ['jg-one', 'jg-two'],
  });
  expect(() => parseFirstPublishOptions(['--package', 'jg-one'])).toThrow(
    'approved --source-commit',
  );
  expect(() =>
    parseFirstPublishOptions([...IDENTITY, '--source-commit', COMMIT, '--package', 'jg-one']),
  ).toThrow('given more than once');
  expect(() =>
    parseFirstPublishOptions([...IDENTITY, '--package', 'jg-one', '--package', 'jg-one']),
  ).toThrow('distinct');
  expect(() => parseFirstPublishOptions([...IDENTITY, '--package', '../jg-one'])).toThrow(
    'distinct',
  );
});

test('requires paired stage evidence and confines recovery to a selected package', () => {
  const selection = [...IDENTITY, '--package', 'jg-one'];
  expect(
    parseFirstPublishOptions([
      ...selection,
      '--stage-id',
      'stage-1',
      '--staged-tarball',
      'stage.tgz',
    ]).stage,
  ).toStrictEqual({
    id: 'stage-1',
    tarball: 'stage.tgz',
  });
  expect(() => parseFirstPublishOptions([...selection, '--stage-id', 'stage-1'])).toThrow(
    'together',
  );
  expect(() => parseFirstPublishOptions([...selection, '--retry-uncertain', 'jg-two'])).toThrow(
    'selected',
  );
});
