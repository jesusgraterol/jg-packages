import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { expect, test } from 'vitest';

test.each(['jg-mark.svg', 'jg-favicon.svg'])(
  'the supported %s path forwards canonical artwork',
  async (name) => {
    const local = await readFile(new URL(name, import.meta.url), 'utf8');
    const canonical = await readFile(
      fileURLToPath(import.meta.resolve(`jg-personal-ui/${name}`)),
      'utf8',
    );
    expect(local.replace(/\r\n/g, '\n')).toBe(canonical.replace(/\r\n/g, '\n'));
  },
);
