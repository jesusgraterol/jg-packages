import { gzipSync } from 'node:zlib';
import { expectToRejectCode } from 'jg-exception/testing';
import { Header } from 'tar';
import { expect, test } from 'vitest';

import { ERRORS, inspectNpmTarball } from '../index.js';

const NUL_BLOCK = Buffer.alloc(512);
const FILES = [
  ['package/package.json', '{}'],
  ['package/dist/index.js', 'export const x = 1;'],
  ['package/dist/empty.js', ''],
] as const;

const entry = (path: string, source: string, type: Header['type'] = 'File'): Buffer => {
  const body = Buffer.from(source);
  const header = Buffer.alloc(512);
  new Header({
    path,
    type,
    size: body.byteLength,
    ...(type === 'SymbolicLink' ? { linkpath: 'package/package.json' } : {}),
  }).encode(header);
  return Buffer.concat([
    header,
    body,
    NUL_BLOCK.subarray(0, (512 - (body.byteLength % 512)) % 512),
  ]);
};

const archive = (files: ReadonlyArray<readonly [string, string, Header['type']?]>): Buffer =>
  gzipSync(
    Buffer.concat([
      ...files.map(([path, body, type]) => entry(path, body, type)),
      NUL_BLOCK,
      NUL_BLOCK,
    ]),
  );

test('returns raw regular-file bytes in archive order', async () => {
  expect(await inspectNpmTarball(archive(FILES))).toStrictEqual(
    new Map([
      ['package.json', Buffer.from('{}')],
      ['dist/index.js', Buffer.from('export const x = 1;')],
      ['dist/empty.js', Buffer.alloc(0)],
    ]),
  );
});

test.each([
  ['outside npm root', '../../../README.md', 'File'],
  ['dot traversal', 'package/../report.txt', 'File'],
  ['backslash traversal', 'package/dist\\report.txt', 'File'],
  ['empty component', 'package/dist//report.txt', 'File'],
  ['device name', 'package/Con.txt', 'File'],
  ['Windows alternate data stream', 'package/dist/index.js:stream', 'File'],
  ['case alias', 'package/Dist/report.txt', 'File'],
  ['implicit directory collision', 'package/dist', 'File'],
  ['file as directory', 'package/package.json/report.txt', 'File'],
  ['duplicate path', 'package/dist/index.js', 'File'],
  ['symbolic link', 'package/link', 'SymbolicLink'],
  ['directory entry', 'package/docs/', 'Directory'],
  ['PAX metadata', 'package/metadata', 'ExtendedHeader'],
] as const)('rejects %s', async (_case, path, type) => {
  await expectToRejectCode(
    inspectNpmTarball(archive([...FILES, [path, 'q', type]])),
    ERRORS.INVALID_NPM_TARBALL,
    'The npm tarball is invalid.',
  );
});

test.each([
  ['compressed bytes', { compressedBytes: 8 }, 'Compressed byte limit'],
  ['expanded bytes', { expandedBytes: 1024 }, 'The npm tarball is invalid.'],
  ['file bytes', { entryBytes: 8 }, 'Entry byte limit'],
  ['entry count', { entries: 2 }, 'Entry count limit'],
  ['invalid limit', { entries: 0 }, 'Invalid archive limits'],
])('enforces %s', async (_case, limits, message) => {
  await expectToRejectCode(
    inspectNpmTarball(archive(FILES), limits),
    ERRORS.INVALID_NPM_TARBALL,
    message,
  );
});

test.each([
  ['plain tar', NUL_BLOCK],
  ['nested gzip', gzipSync(archive(FILES))],
  ['missing manifest', archive([['package/index.js', 'export {};']])],
  ['truncated tar', gzipSync(Buffer.concat([entry(...FILES[0]), NUL_BLOCK]))],
  [
    'trailing tar entry',
    gzipSync(Buffer.concat([entry(...FILES[0]), NUL_BLOCK, NUL_BLOCK, entry(...FILES[1])])),
  ],
  [
    'interior null block',
    gzipSync(
      Buffer.concat([entry(...FILES[0]), NUL_BLOCK, entry(...FILES[1]), NUL_BLOCK, NUL_BLOCK]),
    ),
  ],
])('rejects %s', async (_case, bytes) => {
  await expectToRejectCode(inspectNpmTarball(bytes), ERRORS.INVALID_NPM_TARBALL);
});
