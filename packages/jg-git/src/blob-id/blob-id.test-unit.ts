// @vitest-environment node
import { expectToThrowCode } from 'jg-exception/testing';
import { expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';

import { calculateGitBlobObjectId } from './blob-id.js';

test.each([
  ['', 'sha1', 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391'],
  ['hello\n', 'sha1', 'ce013625030ba8dba906f756967f9e9ca394464a'],
  ['', 'sha256', '473a0f4c3be8a93681a267e3b1e9a7dcda1185436fe141f7749120a303721813'],
  ['hello\n', 'sha256', '2cf8d83d9ee29543b34a87727421fdecb7e3f3a183d337639025de576db9ebb4'],
] as const)('calculateGitBlobObjectId(%o, %s) -> %s', (content, algorithm, objectId) => {
  expect(calculateGitBlobObjectId(content, { algorithm })).toBe(objectId);
  expect(calculateGitBlobObjectId(new TextEncoder().encode(content), { algorithm })).toBe(objectId);
});

test('counts the bytes of text, not its characters', () => {
  // 'é' is two bytes in UTF-8, as git hash-object reads it
  expect(calculateGitBlobObjectId('é')).toBe(
    calculateGitBlobObjectId(new Uint8Array([0xc3, 0xa9])),
  );
  expect(calculateGitBlobObjectId('é')).not.toBe(calculateGitBlobObjectId('e'));
});

test('defaults to SHA-1', () => {
  expect(calculateGitBlobObjectId('hello\n')).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
});

test.each([
  ['content that is neither text nor bytes', 42, undefined],
  ['an algorithm Git does not use', 'hello\n', 'md5'],
])('rejects %s', (_description, content, algorithm) => {
  expectToThrowCode(
    () => calculateGitBlobObjectId(content as string, { algorithm: algorithm as 'sha1' }),
    ERRORS.GIT_INVALID_ARGUMENT,
  );
});
