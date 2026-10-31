import { readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

import { bundleViewer, patchViewerSources } from './utilities.ts';

const packageRoot = resolve(import.meta.dirname, '..');
const viewerRoot = resolve(
  dirname(fileURLToPath(import.meta.resolve('react-diff-viewer-continued'))),
  '../../..',
);
const patch = await readFile(resolve(import.meta.dirname, 'diff-viewer.patch'), 'utf8');
const sources = new Map(
  await Promise.all(
    ['lib/esm/src/index.js', 'lib/esm/src/styles.js'].map(
      async (path) => [path, await readFile(resolve(viewerRoot, path), 'utf8')] as const,
    ),
  ),
);

test('the exact patch applies without modifying pristine dependencies and rejects already-patched input', () => {
  const original = new Map(sources);
  const patched = patchViewerSources(patch, sources);
  expect(sources).toStrictEqual(original);
  expect(patched.get('lib/esm/src/index.js')).toContain('getDerivedStateFromProps');
  expect(patched.get('lib/esm/src/index.js')).toContain(
    'role: "group", "aria-label": "Code diff summary"',
  );
  expect(patched.get('lib/esm/src/index.js')).not.toContain('role: "banner"');
  expect(patched.get('lib/esm/src/index.js')).toContain(
    'if (this.getMemoisedKey() !== cacheKey) return;',
  );
  expect(patched.get('lib/esm/src/index.js')).not.toContain(
    'computedDiffResult: this.state.computedDiffResult,',
  );
  expect(patched.get('lib/esm/src/index.js')).toContain(
    '"aria-label": allExpanded ? "Fold all unchanged lines" : "Expand all unchanged lines"',
  );
  expect(() => patchViewerSources(patch, patched)).toThrow('Diff viewer source is not pristine');
});

test.each([
  ['stale hunk', patch.replaceAll('getDerivedStateFromProps', 'getDerivedStateFromOtherProps')],
  [
    'unapplied hunk',
    patch.replaceAll('static getDerivedStateFromProps', 'static getDerivedStateFromOtherProps'),
  ],
  ['missing ESM file', patch.slice(0, patch.indexOf('diff --git a/lib/esm/src/styles.js'))],
  ['unexpected ESM path', patch.replaceAll('a/lib/esm/src/styles.js', 'a/lib/esm/src/other.js')],
  ['changed target', patch.replaceAll('b/lib/esm/src/styles.js', 'b/lib/esm/src/other.js')],
])('rejects %s before producing a viewer', (_description, invalidPatch) => {
  expect(() => patchViewerSources(invalidPatch, sources)).toThrow(/Diff viewer patch/);
});

test('rejects missing or altered pristine files', () => {
  expect(() => patchViewerSources(patch, new Map())).toThrow('Diff viewer source is not pristine');
  const altered = new Map(sources);
  altered.set('lib/esm/src/styles.js', `${sources.get('lib/esm/src/styles.js')}\n`);
  expect(() => patchViewerSources(patch, altered)).toThrow('Diff viewer source is not pristine');
});

test('actual bundle retains lazy workers, external React, patched code and all committed notices', async () => {
  const bundle = await bundleViewer(packageRoot);
  expect(bundle.notices).toBe(
    await readFile(resolve(packageRoot, 'THIRD-PARTY-NOTICES.md'), 'utf8'),
  );
  expect(bundle.notices).toContain('react-diff-viewer-continued@4.2.2');
  expect(bundle.notices).toContain('diff@9.0.0');
  expect(bundle.notices).toContain('js-yaml@');
  const entry = bundle.outputFiles.find((file) => basename(file.path) === 'diff-viewer.js');
  expect(entry?.text).toContain('getDerivedStateFromProps');
  expect(entry?.text).toMatch(/import\(.+diff-viewer-/);
  expect(
    Object.values(bundle.metafile.outputs)
      .flatMap((output) => output.imports)
      .some((item) => item.external && item.path.startsWith('react-diff-viewer-continued')),
  ).toBe(false);
  for (const file of bundle.outputFiles) {
    expect(file.path).not.toMatch(/\.map$/);
    expect(file.text).not.toContain(packageRoot);
    expect(file.text).not.toContain('sourceMappingURL');
  }
  const reactImports = Object.values(bundle.metafile.outputs)
    .flatMap((output) => output.imports)
    .filter((entry) => entry.path === 'react');
  expect(reactImports.length).toBeGreaterThan(0);
  expect(reactImports.every((entry) => entry.external)).toBe(true);
});

test('a CRLF checkout patch produces the identical checked ESM sources', () => {
  const lfPatch = patch.replace(/\r\n/g, '\n');
  expect(patchViewerSources(lfPatch.replace(/\n/g, '\r\n'), sources)).toStrictEqual(
    patchViewerSources(lfPatch, sources),
  );
});
