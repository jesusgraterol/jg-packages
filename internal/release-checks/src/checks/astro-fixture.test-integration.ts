import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { checkAstroFixture } from './astro-fixture.ts';
import type { IRunAstroFixtureCommand } from './astro-fixture-command/index.ts';
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

const PERSONAL_UI_DIRECTORY = resolve(
  import.meta.dirname,
  '../../../../packages/jg-personal-astro-ui',
);
const COMMAND_SUCCESS = { exitCode: 0, signalCode: null, stdout: '', stderr: '', durationMs: 0 };

// real gallery sources and configuration; only the installed-tool command boundary is replaced
const personalGalleryPackages = async (): Promise<IPackedPackage[]> => {
  const manifest = JSON.parse(
    await readFile(join(PERSONAL_UI_DIRECTORY, 'package.json'), 'utf8'),
  ) as IPackageManifest;
  const ui: IPackedPackage = {
    ...toPacked(manifest),
    workspacePackage: {
      name: manifest.name,
      version: manifest.version,
      directory: PERSONAL_UI_DIRECTORY,
      manifest,
    },
  };
  return [
    ui,
    ...new Set([
      'jg-process',
      'jg-playwright',
      ...Object.keys(manifest.dependencies ?? {}).filter((name) => name.startsWith('jg-')),
    ]),
  ].map((item) => (typeof item === 'string' ? toPacked({ name: item, version: '1.0.0' }) : item));
};

/** Emulates installation's filesystem output while leaving preparation and cleanup real. */
const writeInstalledClis = async (root: string): Promise<void> => {
  for (const name of ['astro', 'vite', 'pagefind', '@playwright/test']) {
    const directory = join(root, 'node_modules', name);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'package.json'), JSON.stringify({ name, bin: 'cli.mjs' }));
    await writeFile(join(directory, 'cli.mjs'), 'export {};');
  }
};

describe('the installed personal UI gallery', () => {
  test('retains the Astro and Tailwind peer contract for the personal UI', async () => {
    const packages = await personalGalleryPackages();
    const ui = packages[0];
    if (ui === undefined) throw new Error('The UI fixture is missing.');
    ui.packedManifest = { ...ui.packedManifest, peerDependencies: {} };
    let calls = 0;
    const runner: IRunAstroFixtureCommand = () => {
      calls++;
      return Promise.resolve(COMMAND_SUCCESS);
    };
    expect(
      (await checkAstroFixture(packages, createRunner([]).runCommand, runner)).get(
        'jg-personal-astro-ui',
      ),
    ).toStrictEqual(['ships Astro components without the peer dependencies astro and tailwindcss']);
    expect(calls).toBe(0);
  });
  test('copies the maintained gallery, installs exact tools and tarballs, and runs every stage', async () => {
    const packages = await personalGalleryPackages();
    const commands: {
      executable: string;
      args: string[];
      options: Parameters<IRunAstroFixtureCommand>[2];
    }[] = [];
    const runner: IRunAstroFixtureCommand = async (executable, args, options) => {
      commands.push({ executable, args, options });
      if (commands.length === 1) {
        expect(
          await readFile(join(options.cwd, 'src', 'pages', 'interactions.astro'), 'utf8'),
        ).toContain("from 'jg-personal-astro-ui/tabs'");
        expect(await readFile(join(options.cwd, 'playwright.config.ts'), 'utf8')).toContain(
          'reuseExistingServer: false',
        );
        await expect(
          access(join(options.cwd, 'component-tests', 'tabs', 'tabs.test-e2e.ts')),
        ).resolves.toBeUndefined();
        expect(
          await readFile(
            join(options.cwd, 'component-tests', 'copy-button', 'copy-button.test-utils.ts'),
            'utf8',
          ),
        ).toContain('export const captureCopiedText');
        expect(JSON.parse(await readFile(join(options.cwd, 'package.json'), 'utf8'))).toStrictEqual(
          { name: 'release-check-astro-gallery', private: true, type: 'module' },
        );
        await writeInstalledClis(options.cwd);
      }
      expect(options.env?.['JG_UI_GALLERY_ROOT']).toBe(options.cwd);
      expect(options.signal.aborted).toBe(false);
      return COMMAND_SUCCESS;
    };
    const legacy = createRunner([]);
    expect(await checkAstroFixture(packages, legacy.runCommand, runner)).toStrictEqual(
      new Map([['jg-personal-astro-ui', []]]),
    );
    expect(legacy.commands).toStrictEqual([]);
    expect(commands).toHaveLength(4);
    expect(commands[0]?.args).toEqual(
      expect.arrayContaining([
        'astro@7.4.0',
        'tailwindcss@4.3.3',
        '@playwright/test@1.64.1',
        'pagefind@1.5.2',
        '/release/jg-process-1.0.0.tgz',
        '/release/jg-playwright-1.0.0.tgz',
      ]),
    );
    expect(commands.slice(1).map(({ executable }) => executable)).toStrictEqual([
      process.execPath,
      process.execPath,
      process.execPath,
    ]);
    expect(commands.slice(1).map(({ args }) => args.slice(1))).toStrictEqual([
      ['build'],
      ['--site', 'dist'],
      ['test', '--retries=0'],
    ]);
    expect(commands.map(({ options }) => Math.ceil(options.timeoutSeconds))).toStrictEqual([
      300, 300, 60, 600,
    ]);
    await expect(access(commands[0]?.options.cwd ?? '')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test.each([
    [{ exitCode: 7, signalCode: null, stdout: '', stderr: 'failed build' }, '7: failed build'],
    [{ exitCode: null, signalCode: 'SIGTERM' as const, stdout: '', stderr: '' }, 'SIGTERM:'],
  ])(
    'reports actual build termination %o and removes partial setup',
    async (result, diagnostic) => {
      const roots: string[] = [];
      const runner: IRunAstroFixtureCommand = async (_command, _args, options) => {
        roots.push(options.cwd);
        if (roots.length === 1) {
          await writeInstalledClis(options.cwd);
          return COMMAND_SUCCESS;
        }
        return { ...result, durationMs: 0 };
      };
      const problems = await checkAstroFixture(
        await personalGalleryPackages(),
        createRunner([]).runCommand,
        runner,
      );
      expect(problems.get('jg-personal-astro-ui')?.[0]).toContain(
        `Astro gallery build failed: command exited with ${diagnostic}`,
      );
      expect(roots).toHaveLength(2);
      await expect(access(roots[0] ?? '')).rejects.toMatchObject({ code: 'ENOENT' });
    },
  );

  test('bounds one-line command diagnostics and starts no later stage', async () => {
    let calls = 0;
    const runner: IRunAstroFixtureCommand = () => {
      calls++;
      return Promise.resolve({ ...COMMAND_SUCCESS, exitCode: 1, stderr: 'x'.repeat(16_384) });
    };
    const problems = await checkAstroFixture(
      await personalGalleryPackages(),
      createRunner([]).runCommand,
      runner,
    );
    expect(calls).toBe(1);
    expect(problems.get('jg-personal-astro-ui')?.[0]).toHaveLength(
      'Astro gallery install failed: '.length + 8192,
    );
  });

  test('keeps the final diagnostic from output with many short lines', async () => {
    const runner: IRunAstroFixtureCommand = () =>
      Promise.resolve({
        ...COMMAND_SUCCESS,
        exitCode: 1,
        stderr: `${'context\n'.repeat(262_144)}final diagnostic`,
      });
    const problems = await checkAstroFixture(
      await personalGalleryPackages(),
      createRunner([]).runCommand,
      runner,
    );
    const message = problems.get('jg-personal-astro-ui')?.[0] ?? '';
    expect(message).toBe(
      `Astro gallery install failed: command exited with 1: ${'context\n'.repeat(19)}final diagnostic`,
    );
  });

  test('rejects an installed CLI that escapes its owning package', async () => {
    let calls = 0;
    let consumer = '';
    const runner: IRunAstroFixtureCommand = async (_command, _args, options) => {
      calls++;
      consumer = options.cwd;
      await writeInstalledClis(consumer);
      await writeFile(
        join(consumer, 'node_modules', 'astro', 'package.json'),
        JSON.stringify({ name: 'astro', bin: '../../outside.js' }),
      );
      return COMMAND_SUCCESS;
    };
    const problems = await checkAstroFixture(
      await personalGalleryPackages(),
      createRunner([]).runCommand,
      runner,
    );
    expect(problems.get('jg-personal-astro-ui')).toStrictEqual([
      'Astro gallery build failed: The installed gallery tool astro points its CLI outside its package.',
    ]);
    expect(calls).toBe(1);
    await expect(access(consumer)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('requires every packed component to have a catalog example before installation', async () => {
    const packages = await personalGalleryPackages();
    const ui = packages[0];
    expect(ui).toBeDefined();
    if (ui === undefined) return;
    ui.packedManifest = {
      ...ui.packedManifest,
      exports: {
        ...(ui.packedManifest.exports as Record<string, string>),
        './unrepresented': './src/components/unrepresented/unrepresented.astro',
      },
    };
    let calls = 0;
    const runner: IRunAstroFixtureCommand = () => {
      calls++;
      return Promise.resolve(COMMAND_SUCCESS);
    };
    const problems = await checkAstroFixture(packages, createRunner([]).runCommand, runner);
    expect(problems.get('jg-personal-astro-ui')?.[0]).toContain(
      'The gallery has no rendered example for jg-personal-astro-ui/unrepresented.',
    );
    expect(calls).toBe(0);
  });

  test('reports incomplete preparation without running an install', async () => {
    const root = join(tmpdir(), `jg-ui-setup-${randomUUID()}`);
    const uiDirectory = join(root, 'packages', 'ui');
    await mkdir(uiDirectory, { recursive: true });
    try {
      await writeFile(join(root, 'pnpm-workspace.yaml'), 'catalog:\n');
      await writeFile(join(uiDirectory, 'package.json'), JSON.stringify({ devDependencies: {} }));
      const packages = await personalGalleryPackages();
      const ui = packages[0];
      if (ui === undefined) throw new Error('The UI fixture is missing.');
      ui.workspacePackage.directory = uiDirectory;
      let calls = 0;
      const runner: IRunAstroFixtureCommand = () => {
        calls++;
        return Promise.resolve(COMMAND_SUCCESS);
      };
      const problems = await checkAstroFixture(packages, createRunner([]).runCommand, runner);
      expect(problems.get('jg-personal-astro-ui')?.[0]).toContain(
        'Astro gallery preparation failed: No exact workspace version is configured for gallery tool astro.',
      );
      expect(calls).toBe(0);
    } finally {
      await rm(root, { recursive: true });
    }
  });

  test('preserves and reports a consumer when the executor cannot confirm teardown', async () => {
    let consumer = '';
    const runner: IRunAstroFixtureCommand = (_command, _args, options) => {
      consumer = options.cwd;
      return Promise.reject(
        Object.assign(
          new Error('The process tree of pid 123 is still running after it was force-stopped.'),
          { code: 'PROCESS_TREE_SURVIVED' },
        ),
      );
    };
    try {
      const problems = await checkAstroFixture(
        await personalGalleryPackages(),
        createRunner([]).runCommand,
        runner,
      );
      expect(problems.get('jg-personal-astro-ui')?.[0]).toContain(
        `consumer preserved at ${consumer}`,
      );
      expect(problems.get('jg-personal-astro-ui')?.[0]).toContain('pid 123');
      await expect(access(consumer)).resolves.toBeUndefined();
    } finally {
      if (consumer !== '') await rm(consumer, { recursive: true });
    }
  });
});

test('the installed React gallery uses the packed closure, exact tools, identity probe, and shared teardown', async () => {
  const names = [
    'jg-personal-react-ui',
    'jg-personal-ui',
    'jg-react-ui',
    'jg-utilities',
    'jg-exception',
    'jg-process',
    'jg-playwright',
  ];
  const packages = await Promise.all(
    names.map(async (name) => {
      const directory = resolve(import.meta.dirname, '../../../../packages', name);
      const manifest = JSON.parse(
        await readFile(join(directory, 'package.json'), 'utf8'),
      ) as IPackageManifest;
      return {
        ...toPacked(manifest),
        workspacePackage: { name, version: manifest.version, directory, manifest },
      };
    }),
  );
  const commands: string[][] = [];
  let consumer = '';
  const runner: IRunAstroFixtureCommand = async (_executable, args, options) => {
    consumer = options.cwd;
    expect(options.env?.['JG_REACT_UI_GALLERY_ROOT']).toBe(consumer);
    commands.push(args);
    if (commands.length === 1) {
      expect(await readFile(join(consumer, 'src/gallery.component.tsx'), 'utf8')).toContain(
        "from 'jg-personal-react-ui'",
      );
      await access(join(consumer, 'src/gallery.component.test-e2e.tsx'));
      await access(join(consumer, 'vite.config.ts'));
      await writeInstalledClis(consumer);
    }
    return COMMAND_SUCCESS;
  };
  expect(
    (await checkAstroFixture(packages, createRunner([]).runCommand, runner)).get(
      'jg-personal-react-ui',
    ),
  ).toStrictEqual([]);
  expect(commands).toHaveLength(4);
  expect(commands[0]).toEqual(
    expect.arrayContaining([
      'vite@8.3.4',
      'react@19.2.4',
      'react-dom@19.2.4',
      'tailwindcss@4.3.3',
      '/release/jg-personal-ui-0.1.0.tgz',
      '/release/jg-react-ui-0.1.0.tgz',
    ]),
  );
  expect(commands[1]?.at(-1)).toBe('build');
  expect(commands[2]).toEqual(expect.arrayContaining(['--input-type=module', '--eval']));
  expect(commands[2]?.at(-1)).toContain('assert.equal(base.Button, personal.Button)');
  expect(commands[3]?.slice(1)).toStrictEqual(['test', '--retries=0']);
  await expect(access(consumer)).rejects.toThrow();
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
