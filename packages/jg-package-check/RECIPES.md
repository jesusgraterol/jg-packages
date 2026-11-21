# jg-package-check recipes

Inspect an npm bundle, then use a disposable consumer to check how the packed package installs and resolves its exports.

## Inspect and install a package produced by a build

```ts
import { readBoundedFile } from 'jg-fs';
import { inspectNpmTarball, withPackedConsumer, checkPackedExports } from 'jg-package-check';

const archivePath = '/path/to/jg-example-1.0.0.tgz';
const packedBytes = await readBoundedFile(archivePath, 16 * 1024 * 1024);
const files = await inspectNpmTarball(packedBytes);

if (!files.has('dist/index.d.ts')) throw new Error('Packed declarations are missing.');

const problems = await withPackedConsumer(
  { packageManager: 'npm', tarballs: [archivePath] },
  (consumer) =>
    checkPackedExports(consumer, {
      packageName: 'jg-example',
      importSubpaths: ['.'],
      privateSubpaths: ['./dist/internal.js'],
    }),
);

if (problems.length > 0) throw new Error(problems.join('\n'));
```

Use multiple `tarballs` in the same call when you need a package to resolve sibling releases.
Use `prepare` to supply a consumer's package-manager policy, then use the consumer's directory and environment for any additional checks.
