import { randomUUID } from 'node:crypto';
import {
  cp,
  glob,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { ERRORS as PROCESS_ERRORS, resolvePackageManagerCommand } from 'jg-process';

import { getRuntimeDependencyNames } from '../workspace/workspace.ts';
import type { IPackageManifest, IRunCommand } from '../shared/types.ts';

import {
  ASTRO_FIXTURE_LIMITS,
  createAstroFixtureScope,
  runAstroFixtureCommand,
  type IRunAstroFixtureCommand,
} from './astro-fixture-command/index.ts';
import type { IPackedPackage } from './types.ts';

// the peers an Astro package's fixture installs, besides the Tailwind CSS Vite plugin, which
// follows tailwindcss's range
const FIXTURE_PEERS = ['astro', 'tailwindcss'] as const;

// the most lines of a failed command's output a problem quotes
const MAX_OUTPUT_LINES = 20;
const MAX_OUTPUT_CHARACTERS = 8192;

// exact versions come from the owning manifest and the workspace's checked-in catalog
const GALLERY_TOOLS = [
  'astro',
  'tailwindcss',
  '@tailwindcss/vite',
  '@playwright/test',
  '@astrojs/markdown-satteri',
  '@axe-core/playwright',
  'pagefind',
];
const EXCLUDED_GALLERY_DIRECTORIES = new Set([
  '_archive',
  '_archives',
  '_backup',
  '_backups',
  'node_modules',
  'dist',
  '.astro',
  '.turbo',
  'coverage',
  'test-results',
  'playwright-report',
]);

// a packed package's export specifiers, by kind
export type IPackageExports = {
  components: string[];
  stylesheets: string[];
  modules: string[];
};

/**
 * Reads the default target of each `exports` subpath.
 * @param exportsMap The packed manifest's `exports`.
 * @returns Each subpath with its default target.
 */
const readExportTargets = (exportsMap: unknown): [string, string][] => {
  if (typeof exportsMap !== 'object' || exportsMap === null) {
    return [];
  }
  return Object.entries(exportsMap as Record<string, unknown>).flatMap(([subpath, target]) => {
    const defaultTarget =
      typeof target === 'object' && target !== null
        ? (target as { default?: unknown }).default
        : target;
    return typeof defaultTarget === 'string' ? [[subpath, defaultTarget] as [string, string]] : [];
  });
};

/**
 * Sorts a package's export specifiers into Astro components, stylesheets, and other modules.
 * @param name The package name.
 * @param exportsMap The packed manifest's `exports`.
 * @returns The specifiers of each kind, such as `jg-personal-astro-ui/badge`.
 */
export const classifyExports = (name: string, exportsMap: unknown): IPackageExports => {
  const result: IPackageExports = { components: [], stylesheets: [], modules: [] };
  for (const [subpath, target] of readExportTargets(exportsMap)) {
    const specifier = subpath === '.' ? name : `${name}/${subpath.replace(/^\.\//, '')}`;
    if (target.endsWith('.astro')) {
      result.components.push(specifier);
    } else if (target.endsWith('.css')) {
      result.stylesheets.push(specifier);
    } else {
      result.modules.push(specifier);
    }
  }
  return result;
};

/**
 * Writes the fixture site's page, which imports every component and module so Astro compiles
 * each one, and its stylesheet, which imports Tailwind CSS and every stylesheet.
 * @param exports The package's exports.
 * @returns The page's and the stylesheet's source.
 */
export const buildFixtureSources = ({
  components,
  modules,
  stylesheets,
}: IPackageExports): { page: string; stylesheet: string } => {
  const componentNames = components.map((_, index) => `Component${index}`);
  const moduleNames = modules.map((_, index) => `module${index}`);
  const page = [
    '---',
    "import '../styles/global.css';",
    ...components.map((specifier, index) => `import ${componentNames[index]} from '${specifier}';`),
    ...modules.map((specifier, index) => `import * as ${moduleNames[index]} from '${specifier}';`),
    // referencing every import keeps it, so the compiler can't drop an unused one
    `const imported = [${[...componentNames, ...moduleNames].join(', ')}];`,
    '---',
    '',
    '<p>{imported.length}</p>',
    '',
  ].join('\n');
  const stylesheet = [
    "@import 'tailwindcss';",
    ...stylesheets.map((specifier) => `@import '${specifier}';`),
    '',
  ].join('\n');
  return { page, stylesheet };
};

/**
 * Keeps the last lines of a failed command's output, where the error usually is.
 * @param output The command's standard error and output.
 * @returns The trimmed lines.
 */
const lastLines = (output: string): string =>
  output.trim().slice(-MAX_OUTPUT_CHARACTERS).split('\n').slice(-MAX_OUTPUT_LINES).join('\n');

/**
 * Builds one Astro package's fixture site: installs its tarball, the siblings it depends on, and
 * its peers into a temporary project, then runs `astro build`.
 * @param packed The Astro package.
 * @param packages Every packed package, for the siblings it depends on.
 * @param runCommand Runs a command.
 * @returns A promise that resolves to the problems.
 */
const buildFixture = async (
  packed: IPackedPackage,
  packages: IPackedPackage[],
  runCommand: IRunCommand,
): Promise<string[]> => {
  const { dependencies = {}, name, peerDependencies = {} } = packed.packedManifest;
  const siblings = packages.filter(({ packedManifest }) => packedManifest.name in dependencies);
  const projectDirectory = await mkdtemp(join(tmpdir(), 'jg-release-astro-fixture-'));
  try {
    const { page, stylesheet } = buildFixtureSources(
      classifyExports(name, packed.packedManifest.exports),
    );
    await mkdir(join(projectDirectory, 'src', 'pages'), { recursive: true });
    await mkdir(join(projectDirectory, 'src', 'styles'), { recursive: true });
    await writeFile(
      join(projectDirectory, 'package.json'),
      JSON.stringify({ name: 'release-check-astro-fixture', private: true, type: 'module' }),
    );
    await writeFile(
      join(projectDirectory, 'astro.config.mjs'),
      [
        "import tailwindcss from '@tailwindcss/vite';",
        "import { defineConfig } from 'astro/config';",
        '',
        'export default defineConfig({ vite: { plugins: [tailwindcss()] } });',
        '',
      ].join('\n'),
    );
    await writeFile(join(projectDirectory, 'src', 'pages', 'index.astro'), page);
    await writeFile(join(projectDirectory, 'src', 'styles', 'global.css'), stylesheet);

    const install = await runCommand(
      'npm',
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--no-package-lock',
        packed.tarballPath,
        ...siblings.map(({ tarballPath }) => tarballPath),
        `astro@${peerDependencies['astro']}`,
        `tailwindcss@${peerDependencies['tailwindcss']}`,
        `@tailwindcss/vite@${peerDependencies['tailwindcss']}`,
      ],
      { cwd: projectDirectory },
    );
    if (install.exitCode !== 0) {
      return [`couldn't install its Astro fixture site: ${lastLines(install.stderr)}`];
    }
    const build = await runCommand(
      join(projectDirectory, 'node_modules', '.bin', 'astro'),
      ['build'],
      { cwd: projectDirectory },
    );
    return build.exitCode === 0
      ? []
      : [`its Astro fixture site doesn't build: ${lastLines(`${build.stdout}\n${build.stderr}`)}`];
  } finally {
    await rm(projectDirectory, { recursive: true, force: true });
  }
};

/**
 * Reads exact gallery tool versions from the checked-in UI manifest and catalog, failing rather
 * than choosing a registry's latest version when a required version is missing.
 * @param uiDirectory The source package that owns the maintained gallery.
 * @returns The exact install specifiers.
 * @throws
 * - No exact workspace version is configured for gallery tool {name}.
 */
const readGalleryTools = async (uiDirectory: string, react: boolean): Promise<string[]> => {
  const manifest = JSON.parse(
    await readFile(join(uiDirectory, 'package.json'), 'utf8'),
  ) as IPackageManifest;
  const workspace = await readFile(resolve(uiDirectory, '..', '..', 'pnpm-workspace.yaml'), 'utf8');
  const catalog = workspace.split('\ncatalog:\n')[1]?.split(/\n\S/u)[0]?.split('\n') ?? [];
  const tools = react
    ? [
        'vite',
        'react',
        'react-dom',
        'tailwindcss',
        '@tailwindcss/vite',
        '@playwright/test',
        '@axe-core/playwright',
      ]
    : GALLERY_TOOLS;
  return tools.map((name) => {
    const declared = manifest.devDependencies?.[name];
    const catalogLine = catalog.find(
      (line) => line.startsWith(`  '${name}': `) || line.startsWith(`  ${name}: `),
    );
    const version =
      declared === 'catalog:'
        ? catalogLine?.slice(catalogLine.lastIndexOf(':') + 1).trim()
        : declared;
    if (version === undefined || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/u.test(version)) {
      throw new Error(`No exact workspace version is configured for gallery tool ${name}.`);
    }
    return `${name}@${version}`;
  });
};

/**
 * Includes the UI's runtime closure and gallery-only JG tools from this release's tarballs.
 * @param packed The UI tarball.
 * @param packages The release's tarballs.
 * @returns The required tarballs, without duplicates.
 * @throws
 * - The Astro gallery needs the packed dependency {name}.
 */
const galleryTarballs = (packed: IPackedPackage, packages: IPackedPackage[]): string[] => {
  const byName = new Map(packages.map((item) => [item.packedManifest.name, item]));
  const selected = new Map([[packed.packedManifest.name, packed]]);
  const pending = [
    'jg-process',
    'jg-playwright',
    ...getRuntimeDependencyNames(packed.packedManifest).filter(
      (name) => byName.has(name) || name.startsWith('jg-'),
    ),
  ];
  for (const name of pending) {
    if (selected.has(name)) continue;
    const sibling = byName.get(name);
    if (sibling === undefined)
      throw new Error(`The Astro gallery needs the packed dependency ${name}.`);
    selected.set(name, sibling);
    pending.push(
      ...getRuntimeDependencyNames(sibling.packedManifest).filter(
        (dependency) => byName.has(dependency) || dependency.startsWith('jg-'),
      ),
    );
  }
  return [...selected.values()].map(({ tarballPath }) => tarballPath);
};

/**
 * Locates a JavaScript CLI in this consumer's installation, without PATH or NODE_PATH fallback.
 * @param root The installed consumer.
 * @param name The dependency name.
 * @param command Its bin name.
 * @returns The absolute JavaScript entry point.
 * @throws
 * - The installed gallery tool {name} has no {command} CLI.
 * - The installed gallery tool {name} points its CLI outside its package.
 */
const galleryCli = async (root: string, name: string, command: string): Promise<string> => {
  const packageRoot = join(root, 'node_modules', name);
  const manifest = JSON.parse(
    await readFile(join(packageRoot, 'package.json'), 'utf8'),
  ) as IPackageManifest;
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.[command];
  if (bin === undefined)
    throw new Error(`The installed gallery tool ${name} has no ${command} CLI.`);
  const entry = resolve(packageRoot, bin);
  const path = relative(packageRoot, entry);
  if (path === '' || isAbsolute(path) || path === '..' || path.startsWith(`..${sep}`)) {
    throw new Error(`The installed gallery tool ${name} points its CLI outside its package.`);
  }
  const resolved = await realpath(entry);
  const resolvedPackageRoot = await realpath(packageRoot);
  const resolvedPath = relative(resolvedPackageRoot, resolved);
  if (isAbsolute(resolvedPath) || resolvedPath === '..' || resolvedPath.startsWith(`..${sep}`)) {
    throw new Error(`The installed gallery tool ${name} points its CLI outside its package.`);
  }
  return resolved;
};

/**
 * Builds and exercises the maintained gallery using only the exact installed UI and sibling
 * tarballs. A command finishes teardown before this boundary removes the consumer. Failed
 * process-tree teardown preserves its root and reports the original diagnostic and known PID.
 * @param packed The UI tarball and its source gallery owner.
 * @param packages Every tarball in this release.
 * @param executor The bounded command boundary.
 * @returns A promise that resolves to stage-specific problems.
 * @throws
 * - PROCESS_INTERRUPTED: The process was interrupted by {signal}.
 */
const buildGalleryFixture = async (
  packed: IPackedPackage,
  packages: IPackedPackage[],
  executor: IRunAstroFixtureCommand,
): Promise<string[]> => {
  const scope = createAstroFixtureScope(executor);
  const projectDirectory = join(tmpdir(), `jg-ui-fixture-${randomUUID()}`);
  const problems: string[] = [];
  let stage = 'preparation';
  let canRemove = true;
  let ownsProject = false;
  try {
    scope.signal.throwIfAborted();
    await mkdir(projectDirectory);
    ownsProject = true;
    const uiDirectory = packed.workspacePackage.directory;
    const react = packed.packedManifest.name === 'jg-personal-react-ui';
    const tools = await readGalleryTools(uiDirectory, react);
    const tarballs = galleryTarballs(packed, packages);
    await cp(join(uiDirectory, 'gallery'), projectDirectory, {
      recursive: true,
      filter: async (path) => {
        if (EXCLUDED_GALLERY_DIRECTORIES.has(basename(path))) return false;
        scope.signal.throwIfAborted();
        if ((await lstat(path)).isSymbolicLink())
          throw new Error(`The gallery source contains a symbolic link: ${path}`);
        return true;
      },
    });
    await cp(
      join(uiDirectory, 'playwright.config.ts'),
      join(projectDirectory, 'playwright.config.ts'),
    );
    // scenarios and their adjacent test support retain relative imports in the installed consumer
    for await (const path of glob(
      ['src/components/**/*.test-e2e.ts', 'src/components/**/*.test-utils.ts'],
      {
        cwd: uiDirectory,
        exclude: [...EXCLUDED_GALLERY_DIRECTORIES].map((name) => `**/${name}/**`),
      },
    )) {
      scope.signal.throwIfAborted();
      const source = join(uiDirectory, path);
      if ((await realpath(source)) !== resolve(source))
        throw new Error(`The component test uses a symbolic link: ${source}`);
      const target = join(
        projectDirectory,
        'component-tests',
        relative(join(uiDirectory, 'src', 'components'), source),
      );
      await mkdir(dirname(target), { recursive: true });
      await cp(source, target);
    }
    await writeFile(
      join(projectDirectory, 'package.json'),
      JSON.stringify({ name: 'release-check-astro-gallery', private: true, type: 'module' }),
    );
    if (react)
      await cp(join(uiDirectory, 'vite.config.ts'), join(projectDirectory, 'vite.config.ts'));
    if (!react) {
      const catalog = (await import(
        pathToFileURL(join(projectDirectory, 'src', 'catalog', 'index.ts')).href
      )) as { GALLERY_EXAMPLES: { subpath: string }[] };
      const represented = new Set(
        catalog.GALLERY_EXAMPLES.map(({ subpath }) => `${packed.packedManifest.name}/${subpath}`),
      );
      const missing = classifyExports(
        packed.packedManifest.name,
        packed.packedManifest.exports,
      ).components.filter((specifier) => !represented.has(specifier));
      if (missing.length > 0)
        throw new Error(`The gallery has no rendered example for ${missing.join(', ')}.`);
    }

    /**
     * Runs a stage within both deadlines and rejects unexpected command termination.
     * @param name The stage whose limit and failure diagnostic apply.
     * @param executable The executable, without a shell.
     * @param args Its arguments.
     * @returns A promise that resolves after a successful command and its teardown.
     * @throws
     * - INVALID_PROCESS_OPTIONS: The timeout must be a positive number of at most 2,147,483 seconds, and the output limit a positive safe integer.
     * - PROCESS_START_FAILED: Unable to start the command
     * - PROCESS_TIMED_OUT: The process didn't finish within the timeout
     * - PROCESS_OUTPUT_TOO_LARGE: The process wrote more output than allowed
     * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped
     * - The Astro gallery exceeded its overall deadline.
     * - command exited with {exitCodeOrSignal}: {diagnostic}
     * - The cancellation signal's reason.
     */
    const runStage = async (
      name: Exclude<keyof typeof ASTRO_FIXTURE_LIMITS, 'total'>,
      executable: string,
      args: string[],
    ): Promise<void> => {
      stage = name;
      scope.signal.throwIfAborted();
      const result = await scope.run(executable, args, {
        cwd: projectDirectory,
        env: {
          ...process.env,
          ...(react
            ? { JG_REACT_UI_GALLERY_ROOT: projectDirectory }
            : { JG_UI_GALLERY_ROOT: projectDirectory }),
        },
        signal: scope.signal,
        timeoutSeconds: ASTRO_FIXTURE_LIMITS[name],
      });
      if (result.signalCode !== null || result.exitCode !== 0) {
        throw new Error(
          `command exited with ${result.signalCode ?? String(result.exitCode)}: ${lastLines(`${result.stdout}\n${result.stderr}`)}`,
        );
      }
    };
    stage = 'install';
    const npm = resolvePackageManagerCommand(
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--no-package-lock',
        ...tarballs,
        ...tools,
      ],
      { packageManager: 'npm', cwd: projectDirectory },
    );
    await runStage('install', npm.command, npm.args);
    stage = 'build';
    await runStage('build', process.execPath, [
      await galleryCli(projectDirectory, react ? 'vite' : 'astro', react ? 'vite' : 'astro'),
      'build',
    ]);
    if (react) {
      await runStage('build', process.execPath, [
        '--input-type=module',
        '--eval',
        `
        import assert from 'node:assert/strict';
        import {createRequire} from 'node:module';
        import * as base from 'jg-react-ui';
        import * as personal from 'jg-personal-react-ui';
        assert.equal(base.Button, personal.Button);
        for (const name of Object.keys(base)) {
          assert.notEqual(base[name], undefined, name + ' must be public');
          assert.equal(base[name], personal[name], name + ' must share its implementation');
        }
        const { createElement } = await import('react');
        const { renderToStaticMarkup } = await import('react-dom/server');
        const markup = renderToStaticMarkup(createElement(personal.JgMark, { className: 'size-8' }));
        assert.match(markup, /aria-hidden="true"/u);
        assert.match(markup, /focusable="false"/u);
        assert.match(markup, /viewBox="0 0 64 64"/u);
        assert.match(markup, /fill="#111827"/u);
        assert.match(markup, /fill="#6EE7B7"/u);
        const script = renderToStaticMarkup(createElement(personal.ThemeInitializationScript, { storageId: 'installed-gallery', nonce: 'fixture-nonce' }));
        assert.match(script, /jg-storage:installed-gallery/u);
        assert.match(script, /nonce="fixture-nonce"/u);
        assert.equal(base.getUiPreferencesStorageKey(), 'jg-storage:jg-ui-preferences');
        const baseRequire = createRequire(import.meta.resolve('jg-react-ui'));
        const personalRequire = createRequire(import.meta.resolve('jg-personal-react-ui'));
        assert.equal(baseRequire.resolve('react'), personalRequire.resolve('react'));
      `,
      ]);
    } else {
      stage = 'index';
      await runStage('index', process.execPath, [
        await galleryCli(projectDirectory, 'pagefind', 'pagefind'),
        '--site',
        'dist',
      ]);
    }
    stage = 'browser';
    await runStage('browser', process.execPath, [
      await galleryCli(projectDirectory, '@playwright/test', 'playwright'),
      'test',
      '--retries=0',
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    canRemove = !(
      error instanceof Error &&
      'code' in error &&
      error.code === PROCESS_ERRORS.PROCESS_TREE_SURVIVED
    );
    if (!canRemove) {
      const diagnostic = `Astro gallery ${stage} teardown could not be confirmed; consumer preserved at ${projectDirectory}: ${lastLines(message)}`;
      problems.push(diagnostic);
      if (scope.isInterrupted()) console.error(diagnostic);
    } else {
      problems.push(`Astro gallery ${stage} failed: ${lastLines(message)}`);
    }
  } finally {
    if (canRemove && ownsProject) {
      try {
        await rm(projectDirectory, { recursive: true, force: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const diagnostic = `Astro gallery consumer could not be removed at ${projectDirectory}: ${lastLines(message)}`;
        problems.push(diagnostic);
        if (scope.isInterrupted()) console.error(diagnostic);
      }
    }
    scope.dispose();
  }
  if (scope.isInterrupted()) throw scope.interruptionReason();
  return problems;
};

/**
 * Check 4: for each package that ships Astro components, a temporary Astro site installed from the
 * tarball imports every component, stylesheet, and module, and `astro build` must pass. The
 * personal Astro and React UI packages instead render their maintained galleries and run the
 * installed browser suites.
 * @param packages The packed packages.
 * @param runCommand Runs a command.
 * @param runGalleryCommand Runs the installed UI fixture with bounded process ownership.
 * @returns A promise that resolves to each Astro package's problems, by name.
 * @throws
 * - PROCESS_INTERRUPTED: The process was interrupted by {signal}.
 */
export const checkAstroFixture = async (
  packages: IPackedPackage[],
  runCommand: IRunCommand,
  runGalleryCommand: IRunAstroFixtureCommand = runAstroFixtureCommand,
): Promise<Map<string, string[]>> => {
  const problems = new Map<string, string[]>();
  for (const packed of packages) {
    const { name, exports: exportsMap } = packed.packedManifest;
    if (
      name === 'jg-personal-astro-ui' ||
      name === 'jg-personal-react-ui' ||
      classifyExports(name, exportsMap).components.length > 0
    ) {
      const missingPeers = (
        name === 'jg-personal-react-ui' ? ['react', 'react-dom', 'tailwindcss'] : FIXTURE_PEERS
      ).filter((peer) => packed.packedManifest.peerDependencies?.[peer] === undefined);
      problems.set(
        name,
        missingPeers.length > 0
          ? [`ships Astro components without the peer dependencies ${missingPeers.join(' and ')}`]
          : await (name === 'jg-personal-astro-ui' || name === 'jg-personal-react-ui'
              ? buildGalleryFixture(packed, packages, runGalleryCommand)
              : buildFixture(packed, packages, runCommand)),
      );
    }
  }
  return problems;
};
