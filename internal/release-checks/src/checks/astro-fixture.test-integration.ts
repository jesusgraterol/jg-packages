import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { checkAstroFixture } from './astro-fixture.ts';
import type { ICommandResult, IPackageManifest, IRunCommand } from '../shared/types.ts';
import type { IPackedPackage } from './types.ts';

// one command the fake runner received, with the fixture's page as it was when the command ran
type IRecordedCommand = { executable: string; args: string[]; page: string };

// builds a packed package from its manifest; the check reads only the manifest and the tarball path
const toPacked = (manifest: IPackageManifest): IPackedPackage =>
  ({
    tarballPath: `/release/${manifest.name}-${manifest.version}.tgz`,
    packedManifest: manifest,
  }) as IPackedPackage;

const UI_PACKAGE = toPacked({
  name: 'jg-ui',
  version: '0.1.0',
  exports: {
    './styles/theme.css': './src/styles/theme.css',
    './badge': './src/components/badge/badge.astro',
  },
  dependencies: { 'jg-exception': '^1.0.0', shiki: '^4.5.0' },
  peerDependencies: { astro: '^7.4.0', tailwindcss: '^4.3.0' },
});
const SIBLING = toPacked({ name: 'jg-exception', version: '1.0.1' });
const UNRELATED = toPacked({ name: 'jg-fs', version: '1.0.1' });

/**
 * Creates a command runner that records each command and answers with the given results.
 * @param results The result of each command, in order.
 * @returns The runner and the commands it received.
 */
const createRunner = (
  results: ICommandResult[],
): { runCommand: IRunCommand; commands: IRecordedCommand[] } => {
  const commands: IRecordedCommand[] = [];
  const runCommand: IRunCommand = async (executable, args, options = {}) => {
    const page = await readFile(join(options.cwd ?? '', 'src', 'pages', 'index.astro'), 'utf8');
    commands.push({ executable, args, page });
    return results[commands.length - 1] ?? { exitCode: 0, stdout: '', stderr: '' };
  };
  return { runCommand, commands };
};

describe('checkAstroFixture', () => {
  test('installs the tarball, its siblings, and its peers, then builds the site', async () => {
    const { runCommand, commands } = createRunner([]);

    const problems = await checkAstroFixture([SIBLING, UI_PACKAGE, UNRELATED], runCommand);

    expect(problems).toStrictEqual(new Map([['jg-ui', []]]));
    expect(commands.map(({ args }) => args.filter((arg) => !arg.startsWith('--')))).toStrictEqual([
      [
        'install',
        '/release/jg-ui-0.1.0.tgz',
        '/release/jg-exception-1.0.1.tgz',
        'astro@^7.4.0',
        'tailwindcss@^4.3.0',
        '@tailwindcss/vite@^4.3.0',
      ],
      ['build'],
    ]);
    expect(commands[1]?.executable).toMatch(/node_modules\/\.bin\/astro$/);
    expect(commands[1]?.page).toContain("import Component0 from 'jg-ui/badge';");
  });

  test('skips packages without Astro components', async () => {
    const { runCommand, commands } = createRunner([]);

    expect(await checkAstroFixture([SIBLING, UNRELATED], runCommand)).toStrictEqual(new Map());
    expect(commands).toStrictEqual([]);
  });

  test('reports a failed build with the end of its output', async () => {
    const { runCommand } = createRunner([
      { exitCode: 0, stdout: '', stderr: '' },
      { exitCode: 1, stdout: 'building\n[ERROR] Could not resolve "./missing.ts"', stderr: '' },
    ]);

    const problems = await checkAstroFixture([UI_PACKAGE], runCommand);

    expect(problems.get('jg-ui')).toStrictEqual([
      `its Astro fixture site doesn't build: building\n[ERROR] Could not resolve "./missing.ts"`,
    ]);
  });

  test('reports a failed install', async () => {
    const { runCommand, commands } = createRunner([
      { exitCode: 1, stdout: '', stderr: 'npm error 404 Not Found - astro@^99.0.0' },
    ]);

    const problems = await checkAstroFixture([UI_PACKAGE], runCommand);

    expect(problems.get('jg-ui')).toStrictEqual([
      "couldn't install its Astro fixture site: npm error 404 Not Found - astro@^99.0.0",
    ]);
    expect(commands).toHaveLength(1);
  });

  test('reports components shipped without the astro and tailwindcss peers', async () => {
    const { runCommand, commands } = createRunner([]);
    const withoutPeers = toPacked({ ...UI_PACKAGE.packedManifest, peerDependencies: {} });

    expect((await checkAstroFixture([withoutPeers], runCommand)).get('jg-ui')).toStrictEqual([
      'ships Astro components without the peer dependencies astro and tailwindcss',
    ]);
    expect(commands).toStrictEqual([]);
  });
});
