import { promisify } from 'node:util';
import { gunzip } from 'node:zlib';
import { Header } from 'tar';

import { packageCheckError } from '../errors.js';

import type { INpmTarballLimits } from './types.js';

const PACKAGE_ROOT = 'package/';
const BLOCK_BYTES = 512;
const MAX_EXPANDED_BYTES = 256 * 1024 * 1024;
const DEFAULT_LIMITS: INpmTarballLimits = {
  compressedBytes: 16 * 1024 * 1024,
  expandedBytes: 32 * 1024 * 1024,
  entryBytes: 8 * 1024 * 1024,
  entries: 4096,
};
// eslint-disable-next-line no-control-regex -- control bytes are unsafe in archive paths
const UNSAFE_COMPONENT = /[\u0000-\u001f\u007f<>:"\\|?*]|[ .]$/u;
const RESERVED_COMPONENT = /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu;

const decompress = promisify(gunzip);

type IArchivePath = { name: string; isFile: boolean };

/**
 * Registers file paths and their implicit directories, including case-insensitive aliases.
 * @param path The parser's name.
 * @param paths The names already used, keyed by portable spelling.
 * @returns The relative archive path.
 */
const registerPath = (path: string, paths: Map<string, IArchivePath>): string => {
  if (!path.startsWith(PACKAGE_ROOT)) throw new Error('A tar entry is outside package/.');
  const name = path.slice(PACKAGE_ROOT.length);
  const parts = name.split('/');
  let relative = '';
  for (const [index, part] of parts.entries()) {
    if (!part || UNSAFE_COMPONENT.test(part) || RESERVED_COMPONENT.test(part))
      throw new Error(`Unsafe tar path: ${JSON.stringify(path)}`);
    relative += index === 0 ? part : `/${part}`;
    const key = relative.normalize('NFC').toLowerCase();
    const isFile = index === parts.length - 1;
    const prior = paths.get(key);
    if (prior && (prior.name !== relative || prior.isFile || isFile))
      throw new Error(`Colliding tar path: ${JSON.stringify(path)}`);
    if (!prior) paths.set(key, { name: relative, isFile });
  }
  return name;
};

/**
 * Parses a bounded npm tarball in memory without extracting it. Requires a gzip archive containing
 * regular files below `package/`, including `package/package.json`. Returned file names omit
 * `package/` and the file bytes are views into the bounded decompressed buffer.
 * @param compressed The complete gzip tarball bytes.
 * @param limits Limits in bytes and entries. Defaults to 16 MiB compressed, 32 MiB expanded,
 * 8 MiB per file and 4096 files. Expanded size is capped at 256 MiB.
 * @returns A map of relative file names to their contents in archive order.
 * @throws
 * - INVALID_NPM_TARBALL: The npm tarball is invalid.
 */
export const inspectNpmTarball = async (
  compressed: Uint8Array,
  limits: Partial<INpmTarballLimits> = {},
): Promise<Map<string, Buffer>> => {
  try {
    const { compressedBytes, expandedBytes, entryBytes, entries } = {
      ...DEFAULT_LIMITS,
      ...limits,
    };
    if (
      [compressedBytes, expandedBytes, entryBytes, entries].some(
        (limit) => !Number.isSafeInteger(limit) || limit < 1,
      ) ||
      expandedBytes > MAX_EXPANDED_BYTES
    )
      throw new Error('Invalid archive limits.');
    if (compressed.byteLength > compressedBytes) throw new Error('Compressed byte limit exceeded.');

    const expanded = await decompress(compressed, { maxOutputLength: expandedBytes });
    const files = new Map<string, Buffer>();
    const paths = new Map<string, IArchivePath>();
    let offset = 0;
    while (offset + BLOCK_BYTES * 2 <= expanded.byteLength) {
      const header = new Header(expanded, offset);
      if (header.nullBlock) {
        if (
          !files.has('package.json') ||
          expanded.byteLength % BLOCK_BYTES !== 0 ||
          expanded.subarray(offset).some((byte) => byte !== 0)
        )
          throw new Error('The package manifest or clean tar end blocks are missing.');
        return files;
      }
      if (!header.cksumValid || header.type !== 'File' || header.linkpath || !header.path)
        throw new Error('Invalid or unsupported tar entry.');
      if (files.size >= entries) throw new Error('Entry count limit exceeded.');
      const { size } = header;
      if (size === undefined || !Number.isSafeInteger(size) || size < 0 || size > entryBytes)
        throw new Error('Entry byte limit exceeded.');
      const name = registerPath(header.path, paths);
      const start = offset + BLOCK_BYTES;
      const end = start + size;
      if (end > expanded.byteLength) throw new Error('Truncated tar entry.');
      files.set(name, expanded.subarray(start, end));
      offset = start + Math.ceil(size / BLOCK_BYTES) * BLOCK_BYTES;
    }
    throw new Error('Clean tar end blocks are missing.');
  } catch (cause) {
    throw packageCheckError('INVALID_NPM_TARBALL', cause);
  }
};
