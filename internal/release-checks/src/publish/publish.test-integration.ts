import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import semver from 'semver';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { sha256, writeReleaseManifest } from '../shared/release-files.ts';
import { createTarball } from '../test-utils/tarball.ts';
import { publishRelease } from './publish.ts';
import type { ICommandResult, IPackageManifest, IReleaseManifestEntry } from '../shared/types.ts';

let releaseDirectory: string;

/*
 * A fake npm that serves versions from memory and records what it runs. `held` lists versions npm
 * already holds without serving them, by spec, with the views before it serves each; publishing
 * one is refused as npm refuses it. `refusals` holds a publish's error for a spec.
 */
const createFakeNpm = (
  registry: Map<string, string[]>,
  {
    visibleAfterPolls = 0,
    held = new Map<string, number>(),
    refusals = new Map<string, string>(),
  } = {},
) => {
  const publishes: string[][] = [];
  const calls: string[] = [];
  const pendingPolls = new Map<string, number>();
  for (const [spec, polls] of held) {
    const at = spec.lastIndexOf('@');
    const name = spec.slice(0, at);
    registry.set(name, [...(registry.get(name) ?? []), spec.slice(at + 1)]);
    pendingPolls.set(spec, polls);
  }
  const runNpm = (args: string[]): Promise<ICommandResult> => {
    calls.push(args.slice(0, 2).join(' '));
    const ok = (stdout: string): Promise<ICommandResult> =>
      Promise.resolve({ exitCode: 0, stdout, stderr: '' });
    const notFound = (): Promise<ICommandResult> =>
      Promise.resolve({ exitCode: 1, stdout: '', stderr: 'npm error code E404' });
    if (args[0] === 'view') {
      const spec = args[1] ?? '';
      const at = spec.lastIndexOf('@');
      const [name, range] = at > 0 ? [spec.slice(0, at), spec.slice(at + 1)] : [spec, undefined];
      const versions = registry.get(name);
      if (versions === undefined) {
        return notFound();
      }
      if (range === undefined) {
        return ok(JSON.stringify(versions.at(-1)));
      }
      const remaining = pendingPolls.get(spec) ?? 0;
      if (remaining > 0) {
        pendingPolls.set(spec, remaining - 1);
        return ok('');
      }
      // a version npm hasn't served yet matches no range either
      const matching = versions.filter(
        (version) =>
          (pendingPolls.get(`${name}@${version}`) ?? 0) === 0 && semver.satisfies(version, range),
      );
      return ok(
        matching.length === 0 ? '' : JSON.stringify(matching.length === 1 ? matching[0] : matching),
      );
    }
    if (args[0] === 'publish') {
      publishes.push(args.slice(1));
      const manifestName =
        (args[1] ?? '')
          .split('/')
          .at(-1)
          ?.replace(/-\d+\.\d+\.\d+(?:-[\w.]+)?\.tgz$/, '') ?? '';
      const version = /-(\d+\.\d+\.\d+(?:-[\w.]+)?)\.tgz$/.exec(args[1] ?? '')?.[1] ?? '';
      const spec = `${manifestName}@${version}`;
      const refusal = held.has(spec)
        ? `npm error code E409\nnpm error 409 Conflict - PUT https://registry.npmjs.org/${manifestName} - Cannot publish over previously staged version "${version}".`
        : refusals.get(spec);
      if (refusal !== undefined)
        return Promise.resolve({ exitCode: 1, stdout: '', stderr: refusal });
      registry.set(manifestName, [...(registry.get(manifestName) ?? []), version]);
      pendingPolls.set(`${manifestName}@${version}`, visibleAfterPolls);
      return ok('');
    }
    return Promise.reject(new Error(`unexpected npm command: ${args.join(' ')}`));
  };
  return { runNpm, publishes, calls };
};

// writes one tarball into the release directory and returns its manifest entry
const writeTarball = async (manifest: IPackageManifest): Promise<IReleaseManifestEntry> => {
  const file = `${manifest.name}-${manifest.version}.tgz`;
  const tarball = createTarball({
    'package.json': JSON.stringify(manifest),
    'dist/index.js': 'export {};\n',
  });
  await writeFile(join(releaseDirectory, file), tarball);
  return { name: manifest.name, version: manifest.version, file, sha256: sha256(tarball) };
};

// writes a release with the given manifests, in order
const writeRelease = async (manifests: IPackageManifest[]): Promise<IReleaseManifestEntry[]> => {
  const entries: IReleaseManifestEntry[] = [];
  for (const manifest of manifests) {
    entries.push(await writeTarball(manifest));
  }
  await writeReleaseManifest(releaseDirectory, entries);
  return entries;
};

// runs the publish command with a fake npm and records sleeps and log lines
const publish = async (fakeNpm: ReturnType<typeof createFakeNpm>) => {
  const sleeps: number[] = [];
  const logs: string[] = [];
  const published = await publishRelease(releaseDirectory, {
    runNpm: fakeNpm.runNpm,
    sleep: (milliseconds) => {
      sleeps.push(milliseconds);
      return Promise.resolve();
    },
    log: (message) => logs.push(message),
  });
  return { published, sleeps, logs };
};

beforeEach(async () => {
  releaseDirectory = await mkdtemp(join(tmpdir(), 'jg-release-publish-'));
});

afterEach(async () => {
  await rm(releaseDirectory, { recursive: true, force: true });
});

describe('publishRelease', () => {
  test('publishes new versions in order, skips published ones and packages not on npm yet', async () => {
    await writeRelease([
      { name: 'jg-exception', version: '1.0.0' },
      { name: 'jg-utils', version: '1.1.0', dependencies: { 'jg-exception': '^1.0.0' } },
      { name: 'jg-brand-new', version: '1.0.0' },
      { name: 'jg-fetch', version: '0.2.0-beta.0', dependencies: { 'jg-utils': '^1.1.0' } },
    ]);
    const fakeNpm = createFakeNpm(
      new Map([
        ['jg-exception', ['1.0.0']],
        ['jg-utils', ['1.0.0']],
        ['jg-fetch', ['0.1.0']],
      ]),
    );

    const { published, logs } = await publish(fakeNpm);

    // the release's versions on npm, the one published before included, so tag can tag it
    expect(published).toStrictEqual([
      { name: 'jg-exception', version: '1.0.0' },
      { name: 'jg-utils', version: '1.1.0' },
      { name: 'jg-fetch', version: '0.2.0-beta.0' },
    ]);
    expect(fakeNpm.publishes).toStrictEqual([
      [join(releaseDirectory, 'jg-utils-1.1.0.tgz'), '--access', 'public'],
      [join(releaseDirectory, 'jg-fetch-0.2.0-beta.0.tgz'), '--access', 'public', '--tag', 'next'],
    ]);
    expect(logs).toContain('Skipped jg-exception@1.0.0: already on npm');
    expect(logs).toContain('Published jg-utils@1.1.0');
    expect(logs).toContain('jg-fetch@0.2.0-beta.0 is on npm');
    expect(logs).toContain(
      "Warning: skipped jg-brand-new@1.0.0: jg-brand-new isn't on npm yet, and its first publish is manual",
    );
    expect(
      JSON.parse(await readFile(join(releaseDirectory, 'published.json'), 'utf8')),
    ).toStrictEqual(published);
  });

  test('publishes every version, a dependent right after its sibling, then waits for npm to serve them', async () => {
    await writeRelease([
      { name: 'jg-exception', version: '1.1.0' },
      { name: 'jg-utils', version: '1.1.0', dependencies: { 'jg-exception': '^1.1.0' } },
    ]);
    const fakeNpm = createFakeNpm(
      new Map([
        ['jg-exception', ['1.0.0']],
        ['jg-utils', ['1.0.0']],
      ]),
      { visibleAfterPolls: 2 },
    );

    const { published, sleeps } = await publish(fakeNpm);

    expect(published).toStrictEqual([
      { name: 'jg-exception', version: '1.1.0' },
      { name: 'jg-utils', version: '1.1.0' },
    ]);
    // jg-utils is published right after jg-exception, without waiting for npm to serve it
    const publishCalls = fakeNpm.calls.flatMap((call, index) =>
      call.startsWith('publish') ? [index] : [],
    );
    expect(publishCalls).toHaveLength(2);
    expect(fakeNpm.calls.slice(publishCalls[0], publishCalls[1])).not.toContain(
      'view jg-exception@1.1.0',
    );
    expect(sleeps).toStrictEqual([15_000, 15_000]);
  });

  test('fails, without writing published.json, when npm never serves a version', async () => {
    await writeRelease([{ name: 'jg-utils', version: '1.1.0' }]);
    const fakeNpm = createFakeNpm(new Map([['jg-utils', ['1.0.0']]]), { visibleAfterPolls: 999 });

    await expect(publish(fakeNpm)).rejects.toThrow(
      "npm accepted jg-utils@1.1.0 but didn't serve them within 15 minutes. Re-run the publish job once they're on npm; it skips and tags them.",
    );
    await expect(readFile(join(releaseDirectory, 'published.json'), 'utf8')).rejects.toThrow();
  });

  test('waits for a version npm already holds from an earlier run, instead of failing on its refusal', async () => {
    await writeRelease([
      { name: 'jg-react', version: '0.6.1' },
      { name: 'jg-react-ui', version: '0.3.4', dependencies: { 'jg-react': '^0.6.1' } },
    ]);
    // an earlier run published jg-react@0.6.1, which npm serves after two more views
    const fakeNpm = createFakeNpm(
      new Map([
        ['jg-react', ['0.6.0']],
        ['jg-react-ui', ['0.3.3']],
      ]),
      { held: new Map([['jg-react@0.6.1', 2]]) },
    );

    const { published, logs, sleeps } = await publish(fakeNpm);

    expect(published).toStrictEqual([
      { name: 'jg-react', version: '0.6.1' },
      { name: 'jg-react-ui', version: '0.3.4' },
    ]);
    expect(logs).toContain(
      'npm already holds jg-react@0.6.1, which an earlier run published; waiting for npm to serve it',
    );
    expect(logs).toContain('Published jg-react-ui@0.3.4');
    expect(logs).toContain('jg-react@0.6.1 is on npm');
    expect(sleeps).toStrictEqual([15_000]);
  });

  test('fails on any other refused publish', async () => {
    await writeRelease([{ name: 'jg-utils', version: '1.1.0' }]);
    const fakeNpm = createFakeNpm(new Map([['jg-utils', ['1.0.0']]]), {
      refusals: new Map([['jg-utils@1.1.0', 'npm error code E403\nnpm error 403 Forbidden']]),
    });

    await expect(publish(fakeNpm)).rejects.toThrow(
      'npm publish jg-utils-1.1.0.tgz failed: npm error code E403\nnpm error 403 Forbidden',
    );
    await expect(readFile(join(releaseDirectory, 'published.json'), 'utf8')).rejects.toThrow();
  });

  test('fails instead of skipping when a sibling range has no version on npm', async () => {
    await writeRelease([
      { name: 'jg-brand-new', version: '1.0.0' },
      { name: 'jg-utils', version: '1.1.0', dependencies: { 'jg-brand-new': '^1.0.0' } },
    ]);
    const fakeNpm = createFakeNpm(new Map([['jg-utils', ['1.0.0']]]));

    await expect(publish(fakeNpm)).rejects.toThrow(
      'jg-utils@1.1.0 depends on jg-brand-new@^1.0.0, which has no version on npm. Release jg-brand-new first.',
    );
    expect(fakeNpm.publishes).toStrictEqual([]);
  });

  test('refuses a tarball that changed after it was packed, before publishing anything', async () => {
    await writeRelease([
      { name: 'jg-exception', version: '1.1.0' },
      { name: 'jg-utils', version: '1.1.0' },
    ]);
    await writeFile(join(releaseDirectory, 'jg-utils-1.1.0.tgz'), 'tampered');
    const fakeNpm = createFakeNpm(
      new Map([
        ['jg-exception', ['1.0.0']],
        ['jg-utils', ['1.0.0']],
      ]),
    );

    await expect(publish(fakeNpm)).rejects.toThrow(
      "The tarball doesn't match the release manifest checksum: jg-utils-1.1.0.tgz",
    );
    expect(fakeNpm.publishes).toStrictEqual([]);
  });
});
