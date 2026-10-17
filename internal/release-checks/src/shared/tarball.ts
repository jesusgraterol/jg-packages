import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

import { MAX_TARBALL_BYTES, MAX_TARBALL_ENTRIES } from './constants.ts';

// size of a tar header and of every data block
const BLOCK_SIZE = 512;

/**
 * Reads a NUL-terminated string field of a tar header.
 * @param header The header block.
 * @param start The field's offset.
 * @param length The field's length.
 * @returns The field's text.
 */
const readField = (header: Buffer, start: number, length: number): string => {
  const field = header.subarray(start, start + length);
  const end = field.indexOf(0);
  return field.subarray(0, end === -1 ? field.length : end).toString('utf8');
};

/**
 * Reads the `path` record of a PAX extended header, which holds paths longer than 100 bytes.
 * @param data The extended header's data.
 * @returns The path, or `undefined` when the header sets none.
 */
const readPaxPath = (data: Buffer): string | undefined => {
  let offset = 0;
  while (offset < data.length) {
    const space = data.indexOf(0x20, offset);
    const length = Number.parseInt(data.subarray(offset, space).toString('utf8'), 10);
    if (space === -1 || !Number.isInteger(length) || length <= 0) {
      return undefined;
    }
    const record = data.subarray(space + 1, offset + length - 1).toString('utf8');
    if (record.startsWith('path=')) {
      return record.slice('path='.length);
    }
    offset += length;
  }
  return undefined;
};

/**
 * Reads the files of a gzipped npm tarball into memory, keyed by their path inside the package
 * (without the leading `package/`). Directories and links are left out. Reading stops with an
 * error when the archive is larger than the release limits.
 * @param tarball The gzipped tarball, or the path of one.
 * @returns A promise that resolves to the files' contents by path.
 * @throws
 * - The tarball is not a valid tar archive.
 * - The tarball has more entries than the release limit allows.
 */
export const readTarballFiles = async (tarball: Buffer | string): Promise<Map<string, Buffer>> => {
  const compressed = typeof tarball === 'string' ? await readFile(tarball) : tarball;
  const archive = gunzipSync(compressed, { maxOutputLength: MAX_TARBALL_BYTES });
  const files = new Map<string, Buffer>();
  let offset = 0;
  let entries = 0;
  let pendingPath: string | undefined;
  while (offset + BLOCK_SIZE <= archive.length) {
    const header = archive.subarray(offset, offset + BLOCK_SIZE);
    if (header.every((byte) => byte === 0)) {
      break;
    }
    entries += 1;
    if (entries > MAX_TARBALL_ENTRIES) {
      throw new Error('The tarball has more entries than the release limit allows.');
    }
    const size = Number.parseInt(readField(header, 124, 12).trim() || '0', 8);
    const type = readField(header, 156, 1);
    const dataStart = offset + BLOCK_SIZE;
    if (!Number.isInteger(size) || size < 0 || dataStart + size > archive.length) {
      throw new Error('The tarball is not a valid tar archive.');
    }
    const data = archive.subarray(dataStart, dataStart + size);
    offset = dataStart + Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE;

    if (type === 'x') {
      pendingPath = readPaxPath(data);
      continue;
    }
    if (type === 'L') {
      pendingPath = data.toString('utf8').replace(/\0+$/, '');
      continue;
    }
    const prefix = readField(header, 345, 155);
    const name = readField(header, 0, 100);
    const path = pendingPath ?? (prefix === '' ? name : `${prefix}/${name}`);
    pendingPath = undefined;
    if (type === '0' || type === '' || type === '7') {
      files.set(path.replace(/^package\//, ''), Buffer.from(data));
    }
  }
  return files;
};
