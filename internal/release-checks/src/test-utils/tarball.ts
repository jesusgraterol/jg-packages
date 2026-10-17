import { gzipSync } from 'node:zlib';

// size of a tar header and of every data block
const BLOCK_SIZE = 512;

/**
 * Writes a string into a header field, NUL-padded.
 * @param header The header block.
 * @param value The field value.
 * @param start The field's offset.
 * @param length The field's length.
 */
const writeField = (header: Buffer, value: string, start: number, length: number): void => {
  header.write(value.slice(0, length), start, length, 'utf8');
};

/**
 * Builds one ustar header and its padded data blocks.
 * @param name The entry name, at most 100 bytes.
 * @param data The entry's contents.
 * @param type The entry type flag.
 * @returns The entry's blocks.
 */
const buildEntry = (name: string, data: Buffer, type: string): Buffer => {
  const header = Buffer.alloc(BLOCK_SIZE);
  writeField(header, name, 0, 100);
  writeField(header, '0000644 ', 100, 8);
  writeField(header, '0000000 ', 108, 8);
  writeField(header, '0000000 ', 116, 8);
  writeField(header, `${data.length.toString(8).padStart(11, '0')} `, 124, 12);
  writeField(header, '00000000000 ', 136, 12);
  writeField(header, type, 156, 1);
  writeField(header, 'ustar', 257, 6);
  writeField(header, '00', 263, 2);
  header.fill(0x20, 148, 156);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  writeField(header, `${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8);
  const padding = Buffer.alloc((BLOCK_SIZE - (data.length % BLOCK_SIZE)) % BLOCK_SIZE);
  return Buffer.concat([header, data, padding]);
};

/**
 * Builds a PAX `path` record, whose length prefix counts itself.
 * @param path The long path.
 * @returns The record.
 */
const buildPaxPathRecord = (path: string): Buffer => {
  const body = ` path=${path}\n`;
  let length = Buffer.byteLength(body) + 1;
  while (String(length).length + Buffer.byteLength(body) !== length) {
    length = String(length).length + Buffer.byteLength(body);
  }
  return Buffer.from(`${length}${body}`);
};

/**
 * Builds a gzipped npm-style tarball with every file under `package/`, using a PAX header for
 * paths longer than 100 bytes, the way npm and pnpm do.
 * @param files The files' contents by path inside the package.
 * @param directories Directory entries to add, to check they're skipped.
 * @returns The gzipped tarball.
 */
export const createTarball = (
  files: Record<string, string | Buffer>,
  directories: string[] = [],
): Buffer => {
  const blocks: Buffer[] = directories.map((directory) =>
    buildEntry(`package/${directory}/`, Buffer.alloc(0), '5'),
  );
  for (const [path, contents] of Object.entries(files)) {
    const fullPath = `package/${path}`;
    const data = typeof contents === 'string' ? Buffer.from(contents) : contents;
    if (Buffer.byteLength(fullPath) > 100) {
      blocks.push(buildEntry('PaxHeader', buildPaxPathRecord(fullPath), 'x'));
      blocks.push(buildEntry(fullPath.slice(0, 100), data, '0'));
    } else {
      blocks.push(buildEntry(fullPath, data, '0'));
    }
  }
  blocks.push(Buffer.alloc(BLOCK_SIZE * 2));
  return gzipSync(Buffer.concat(blocks));
};
