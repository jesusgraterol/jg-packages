import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { extractApiReference } from './extract-api-reference.ts';
import { renderApiMarkdown } from './render-api-markdown.ts';

// the file every package ships its API reference in, at its root
export const API_MARKDOWN_FILE = 'API.md';

/**
 * Writes a package's API.md: its API reference, extracted from its TSDoc and rendered as Markdown.
 * @param packageDirectory The package directory.
 * @returns A promise that resolves to the file's path.
 * @example
 * await writeApiMarkdown('packages/jg-fs'); // 'packages/jg-fs/API.md'
 */
export const writeApiMarkdown = async (packageDirectory: string): Promise<string> => {
  const path = join(packageDirectory, API_MARKDOWN_FILE);
  await writeFile(path, renderApiMarkdown(await extractApiReference(packageDirectory)));
  return path;
};
