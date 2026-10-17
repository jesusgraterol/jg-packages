import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expectToRejectCode } from 'jg-exception/testing';
import { afterEach, beforeEach, describe, expect, expectTypeOf, test } from 'vitest';
import { z } from 'zod';

import { ERRORS, readJSONFile } from './index.js';
import { readJSONFile as readJSONFileSync } from './sync/index.js';

/*
 * Contract tests: readJSONFile validates with a real Zod schema, in both APIs, and lets the
 * schema's error through unchanged.
 */

// a schema that also transforms, so a test can tell its output from the file's content
const Config = z.object({
  port: z.number().int(),
  host: z.string().default('localhost'),
});
type IConfig = z.infer<typeof Config>;

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'jg-fs-schema-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe.each([
  ['jg-fs', readJSONFile],
  [
    'jg-fs/sync',
    (path: string, options?: Parameters<typeof readJSONFileSync<IConfig>>[1]) =>
      Promise.resolve().then(() => readJSONFileSync(path, options)),
  ],
])('%s readJSONFile', (_entry, read) => {
  test('returns what the schema returns', async () => {
    const path = join(root, 'config.json');
    await writeFile(path, '{ "port": 8080 }');

    await expect(read(path, { schema: Config })).resolves.toStrictEqual({
      port: 8080,
      host: 'localhost',
    });
  });

  test("lets the schema's error through unchanged", async () => {
    const path = join(root, 'config.json');
    await writeFile(path, '{ "port": "8080" }');

    await expect(read(path, { schema: Config })).rejects.toBeInstanceOf(z.ZodError);
  });

  test('reports content that is not JSON before the schema runs', async () => {
    const path = join(root, 'config.json');
    await writeFile(path, '{ port: 8080 }');

    await expectToRejectCode(
      read(path, { schema: Config }),
      ERRORS.FILE_CONTENT_IS_EMPTY_OR_INVALID,
    );
  });

  test('returns the parsed content as it is without a schema', async () => {
    const path = join(root, 'config.json');
    await writeFile(path, '{ "port": "anything" }');

    await expect(read(path)).resolves.toStrictEqual({ port: 'anything' });
  });
});

describe('types', () => {
  test('the result type comes from the schema, or is unknown without one', () => {
    // wrapped in functions, so nothing reads the files
    expectTypeOf(() => readJSONFile('x', { schema: Config })).returns.toEqualTypeOf<
      Promise<IConfig>
    >();
    expectTypeOf(() => readJSONFile('x')).returns.toEqualTypeOf<Promise<unknown>>();
    expectTypeOf(() => readJSONFile<{ port: number }>('x')).returns.toEqualTypeOf<
      Promise<{ port: number }>
    >();
    expectTypeOf(() => readJSONFileSync('x', { schema: Config })).returns.toEqualTypeOf<IConfig>();
    expectTypeOf(() => readJSONFileSync('x')).returns.toEqualTypeOf<unknown>();
  });
});
