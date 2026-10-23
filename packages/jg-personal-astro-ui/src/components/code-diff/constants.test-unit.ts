import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';

import { MAX_DIFF_EDIT_LENGTH, MAX_WORD_LINE_LENGTH } from './constants.ts';

test('documented comparison bounds match the owning constants', async () => {
  const guide = await readFile(
    new URL('../../../../../docs/personal-astro-ui.md', import.meta.url),
    'utf8',
  );
  expect(guide).toContain(`\`maxEditLength: ${MAX_DIFF_EDIT_LENGTH}\``);
  expect(guide).toContain(`at most ${MAX_WORD_LINE_LENGTH} UTF-16 code units`);
});
