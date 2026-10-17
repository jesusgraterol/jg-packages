import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { IRunCommand } from '../shared/types.ts';
import type { IPackedPackage } from './types.ts';

// the peers an Astro package's fixture installs, besides the Tailwind CSS Vite plugin, which
// follows tailwindcss's range
const FIXTURE_PEERS = ['astro', 'tailwindcss'] as const;

// the most lines of a failed command's output a problem quotes
const MAX_OUTPUT_LINES = 20;

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
  output.trim().split('\n').slice(-MAX_OUTPUT_LINES).join('\n');

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
  const missingPeers = FIXTURE_PEERS.filter((peer) => peerDependencies[peer] === undefined);
  if (missingPeers.length > 0) {
    return [`ships Astro components without the peer dependencies ${missingPeers.join(' and ')}`];
  }
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
 * Check 4: for each package that ships Astro components, a temporary Astro site installed from the
 * tarball imports every component, stylesheet, and module, and `astro build` must pass.
 * @param packages The packed packages.
 * @param runCommand Runs a command.
 * @returns A promise that resolves to each Astro package's problems, by name.
 */
export const checkAstroFixture = async (
  packages: IPackedPackage[],
  runCommand: IRunCommand,
): Promise<Map<string, string[]>> => {
  const problems = new Map<string, string[]>();
  for (const packed of packages) {
    const { name, exports: exportsMap } = packed.packedManifest;
    if (classifyExports(name, exportsMap).components.length > 0) {
      problems.set(name, await buildFixture(packed, packages, runCommand));
    }
  }
  return problems;
};
