import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { bundleViewer } from './utilities.ts';

const { values } = parseArgs({ options: { 'write-notices': { type: 'boolean', default: false } } });
const packageRoot = resolve(import.meta.dirname, '..');
const result = await bundleViewer(packageRoot);
const noticesPath = resolve(packageRoot, 'THIRD-PARTY-NOTICES.md');
if (values['write-notices']) {
  await writeFile(noticesPath, result.notices);
} else if ((await readFile(noticesPath, 'utf8')).replace(/\r\n/g, '\n') !== result.notices) {
  throw new Error('Diff viewer notices are stale. Run pnpm build:viewer --write-notices.');
}
for (const file of result.outputFiles) {
  await mkdir(dirname(file.path), { recursive: true });
  await writeFile(file.path, file.contents);
}
