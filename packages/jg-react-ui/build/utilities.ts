import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyPatch, parsePatch } from 'diff';
import { build, type Metafile, type OutputFile } from 'esbuild';

// complete Git blob identities for the two ESM files in the pinned Moldea patch.
const VIEWER_FILES = {
  'lib/esm/src/index.js': [
    '1b406a013f342977f2b00d3f1b00e4dfeec07337',
    '67068dcc6c40b489c6a21bad819c3b7fbc976c67',
  ],
  'lib/esm/src/styles.js': [
    '0a443406bbe541409783f4a5051b8d6d56cce292',
    '2b812f90f0ecc2e5924a083d343c87d73da74c95',
  ],
} as const;

const gitBlobHash = (source: string): string =>
  createHash('sha1')
    .update(`blob ${Buffer.byteLength(source)}\0`)
    .update(source)
    .digest('hex');

/**
 * Applies every expected ESM hunk to pristine viewer files and verifies complete patched output.
 * @param patch The unchanged source patch, including its unused CommonJS sections.
 * @param sources Pristine ESM contents keyed by the two fixed package-relative paths.
 * @returns Checked patched sources; no dependency file is modified.
 * @throws
 * - Diff viewer patch does not contain exactly the expected ESM files.
 * - Diff viewer source is not pristine: {path}
 * - Diff viewer patch is stale or unapplied: {path}
 * - Diff viewer summary accessibility adaptation is stale.
 * - Diff viewer expand-button accessibility adaptation is stale.
 * - Diff viewer worker cache adaptation is stale.
 */
export const patchViewerSources = (
  patch: string,
  sources: Map<string, string>,
): Map<string, string> => {
  const patches = parsePatch(patch.replace(/\r\n/g, '\n')).filter((entry) =>
    entry.oldFileName?.startsWith('a/lib/esm/'),
  );
  if (
    patches.length !== Object.keys(VIEWER_FILES).length ||
    new Set(patches.map((entry) => entry.oldFileName)).size !== patches.length ||
    patches.some((entry) => {
      const path = entry.oldFileName?.slice(2);
      return path === undefined || !(path in VIEWER_FILES) || entry.newFileName !== `b/${path}`;
    })
  ) {
    throw new Error('Diff viewer patch does not contain exactly the expected ESM files.');
  }
  const patched = new Map<string, string>();
  for (const [path, [before, after]] of Object.entries(VIEWER_FILES)) {
    const source = sources.get(path);
    if (source === undefined || gitBlobHash(source) !== before) {
      throw new Error(`Diff viewer source is not pristine: ${path}`);
    }
    const entry = patches.find((candidate) => candidate.oldFileName === `a/${path}`);
    const result = entry === undefined ? false : applyPatch(source, entry, { fuzzFactor: 0 });
    if (result === false || gitBlobHash(result) !== after) {
      throw new Error(`Diff viewer patch is stale or unapplied: ${path}`);
    }
    // a viewer summary is local content, not the document's banner landmark.
    if (path === 'lib/esm/src/index.js') {
      const banner = 'role: "banner"';
      if (result.split(banner).length !== 2) {
        throw new Error('Diff viewer summary accessibility adaptation is stale.');
      }
      const expandButton = 'className: this.styles.allExpandButton,';
      if (result.split(expandButton).length !== 2) {
        throw new Error('Diff viewer expand-button accessibility adaptation is stale.');
      }
      const workerComputation =
        'const { lineInformation, diffLines } = await computeLineInformationWorker(oldValue, newValue, disableWordDiff, compareMethod, linesOffset, this.props.alwaysShowLines, shouldDeferWordDiff(this.props), this.props.disableWorker);';
      const cacheAssignment =
        'this.state.computedDiffResult[cacheKey] = { lineInformation, lineBlocks, blocks };';
      const cacheState = 'computedDiffResult: this.state.computedDiffResult,';
      const updateTrigger =
        'prevProps.linesOffset !== this.props.linesOffset ||\n            prevProps.disableWorker !== this.props.disableWorker';
      if (
        [workerComputation, cacheAssignment, cacheState, updateTrigger].some(
          (source) => result.split(source).length !== 2,
        )
      ) {
        throw new Error('Diff viewer worker cache adaptation is stale.');
      }
      patched.set(
        path,
        result
          .replace(banner, 'role: "group", "aria-label": "Code diff summary"')
          .replace(
            expandButton,
            `${expandButton} "aria-label": allExpanded ? "Fold all unchanged lines" : "Expand all unchanged lines", "aria-expanded": allExpanded,`,
          )
          .replace(
            workerComputation,
            `${workerComputation}\n        if (this.getMemoisedKey() !== cacheKey) return;`,
          )
          .replace(cacheAssignment, '')
          .replace(
            cacheState,
            'computedDiffResult: { [cacheKey]: { lineInformation, lineBlocks, blocks } },',
          )
          .replace(
            updateTrigger,
            'prevProps.linesOffset !== this.props.linesOffset ||\n            prevProps.alwaysShowLines !== this.props.alwaysShowLines ||\n            prevProps.extraLinesSurroundingDiff !== this.props.extraLinesSurroundingDiff ||\n            prevProps.disableWorker !== this.props.disableWorker',
          ),
      );
    } else {
      patched.set(path, result);
    }
  }
  return patched;
};

/**
 * Finds a dependency's owning manifest, skipping nested module-format declarations.
 * @returns The package directory.
 * @throws
 * - Unable to locate the bundled dependency manifest.
 */
const findPackageRoot = async (file: string): Promise<string> => {
  let directory = dirname(file);
  while (directory !== parse(directory).root) {
    if ((await readdir(directory)).includes('package.json')) {
      const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')) as {
        name?: unknown;
        version?: unknown;
      };
      if (typeof manifest.name === 'string' && typeof manifest.version === 'string')
        return directory;
    }
    directory = dirname(directory);
  }
  throw new Error('Unable to locate the bundled dependency manifest.');
};

/**
 * Collects complete licenses for the finite set of packages actually included by esbuild.
 * @returns Deterministically ordered license notices.
 * @throws
 * - Unable to locate the bundled dependency manifest.
 * - Missing bundled license: {name}
 */
const collectNotices = async (inputs: string[], packageRoot: string): Promise<string> => {
  const roots = new Set<string>();
  for (const input of inputs) roots.add(await findPackageRoot(resolve(packageRoot, input)));
  const notices: string[] = [];
  for (const root of roots) {
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
      name: string;
      version: string;
    };
    const licenseNames = (await readdir(root)).filter((name) =>
      /^licen[sc]e(?:\.[a-z]+)?$/i.test(name),
    );
    if (licenseNames.length === 0) throw new Error(`Missing bundled license: ${manifest.name}`);
    const licenses = await Promise.all(
      licenseNames.sort().map((name) => readFile(join(root, name), 'utf8')),
    );
    notices.push(
      `## ${manifest.name}@${manifest.version}\n\n\`\`\`text\n${licenses.join('\n').replace(/\r\n/g, '\n').trim()}\n\`\`\`\n`,
    );
  }
  return `# Third-party notices\n\nGenerated from the patched diff viewer bundle by \`pnpm build:viewer --write-notices\`.\n\n${notices.sort().join('\n')}`;
};

/**
 * Bundles the exact pristine build dependency with checked patches and lazy worker chunks.
 * @param packageRoot The owning jg-react-ui directory.
 * @returns Bundle output and deterministic license notices, before writing any output.
 * @throws
 * - Unable to locate the bundled dependency manifest.
 * - Missing bundled license: {name}
 * - Diff viewer build requires pristine version 4.2.2.
 * - Diff viewer patch does not contain exactly the expected ESM files.
 * - Diff viewer source is not pristine: {path}
 * - Diff viewer patch is stale or unapplied: {path}
 * - Diff viewer summary accessibility adaptation is stale.
 * - Diff viewer expand-button accessibility adaptation is stale.
 * - Diff viewer worker cache adaptation is stale.
 * - React must remain external to the diff viewer bundle.
 * - Diff viewer worker code must remain dynamically loaded.
 */
export const bundleViewer = async (
  packageRoot: string,
): Promise<{
  outputFiles: OutputFile[];
  metafile: Metafile;
  notices: string;
}> => {
  const entry = fileURLToPath(import.meta.resolve('react-diff-viewer-continued'));
  const root = await findPackageRoot(entry);
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
    version: string;
  };
  if (manifest.version !== '4.2.2')
    throw new Error('Diff viewer build requires pristine version 4.2.2.');
  const sources = new Map<string, string>();
  for (const path of Object.keys(VIEWER_FILES))
    sources.set(path, await readFile(join(root, path), 'utf8'));
  const patch = await readFile(join(packageRoot, 'build', 'diff-viewer.patch'), 'utf8');
  const patched = patchViewerSources(patch, sources);
  const result = await build({
    absWorkingDir: packageRoot,
    entryPoints: { 'diff-viewer': entry },
    outdir: join(packageRoot, 'dist', 'vendor'),
    chunkNames: 'diff-viewer-[hash]',
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    conditions: ['module'],
    external: ['react', 'react/*', 'react-dom', 'react-dom/*'],
    target: 'es2022',
    sourcemap: false,
    legalComments: 'inline',
    metafile: true,
    write: false,
    plugins: [
      {
        name: 'checked-viewer-patch',
        setup(builder) {
          builder.onLoad({ filter: /[\\/](?:index|styles)\.js$/ }, (args) => {
            for (const [path, contents] of patched) {
              if (resolve(args.path) === resolve(root, path)) {
                return { contents, loader: 'js', resolveDir: dirname(args.path) };
              }
            }
            return undefined;
          });
        },
      },
    ],
  });
  const inputs = Object.keys(result.metafile.inputs);
  if (inputs.some((input) => /(?:^|\/)node_modules\/(?:react|react-dom)\//.test(input))) {
    throw new Error('React must remain external to the diff viewer bundle.');
  }
  if (
    !Object.values(result.metafile.outputs).some((output) =>
      output.imports.some((item) => item.kind === 'dynamic-import'),
    )
  ) {
    throw new Error('Diff viewer worker code must remain dynamically loaded.');
  }
  return {
    outputFiles: result.outputFiles,
    metafile: result.metafile,
    notices: await collectNotices(inputs, packageRoot),
  };
};
