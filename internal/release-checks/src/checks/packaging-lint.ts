import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { publint } from 'publint';
import { formatMessage } from 'publint/utils';

import type { IRunCommand } from '../shared/types.ts';
import type { IPackedPackage } from './types.ts';

// packages that ship Astro and TypeScript sources, which `attw` can't evaluate
const SOURCE_ONLY_PACKAGES = new Set(['jg-personal-astro-ui']);

/**
 * Resolves the `attw` command-line entry of the installed `@arethetypeswrong/cli`.
 * @returns The absolute path of its JavaScript entry.
 */
const resolveAttwEntry = (): string => {
  const require = createRequire(import.meta.url);
  const manifestPath = require.resolve('@arethetypeswrong/cli/package.json');
  const manifest = require(manifestPath) as { bin: Record<string, string> };
  return join(dirname(manifestPath), manifest.bin['attw'] ?? 'dist/index.js');
};

/**
 * Check 3: `publint --strict` on the packed tarball, and `attw --profile esm-only` for packages
 * that ship compiled JavaScript and declarations.
 * @param packed The packed package.
 * @param runCommand Runs a command.
 * @returns A promise that resolves to one problem per publint message, and one for attw.
 */
export const checkPackagingLint = async (
  packed: IPackedPackage,
  runCommand: IRunCommand,
): Promise<string[]> => {
  const problems: string[] = [];
  const tarball = await readFile(packed.tarballPath);
  // publint reads the tarball's own files, so it lints exactly what ships
  const { messages, pkg } = await publint({
    pack: {
      tarball: tarball.buffer.slice(tarball.byteOffset, tarball.byteOffset + tarball.byteLength),
    },
    strict: true,
  });
  for (const message of messages) {
    if (message.type !== 'suggestion') {
      problems.push(`publint: ${formatMessage(message, pkg, { color: false }) ?? message.code}`);
    }
  }

  if (!SOURCE_ONLY_PACKAGES.has(packed.packedManifest.name)) {
    const result = await runCommand(process.execPath, [
      resolveAttwEntry(),
      packed.tarballPath,
      '--profile',
      'esm-only',
      '--format',
      'ascii',
      '--no-color',
      '--no-emoji',
    ]);
    if (result.exitCode !== 0) {
      problems.push(
        `attw found type resolution problems:\n${`${result.stdout}${result.stderr}`.trim()}`,
      );
    }
  }
  return problems;
};
