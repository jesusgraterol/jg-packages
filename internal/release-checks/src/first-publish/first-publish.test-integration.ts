import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, isAbsolute, join, relative } from 'node:path';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { sha256 } from '../shared/release-files.ts';
import type { IReleaseManifestEntry } from '../shared/types.ts';

import { runFirstPublish } from './first-publish.ts';
import type { IFirstPublishOptions, IFirstPublishState } from './types.ts';

type ICatalogEntry = { versions: string[]; tarball?: string };
type IFakeNpmSettings = {
  mode: 'public' | 'interrupted' | 'staged';
  catalog: Record<string, ICatalogEntry>;
  failLogout?: boolean;
};
type IInvocation = {
  command: string;
  target: string;
  directory: string;
  userConfig: string;
  globalConfig: string;
  cache: string;
  registry: string;
  inheritedCredentials: boolean;
};

const VERSION = '0.1.0';
const FIRST = 'jg-first-fixture';
const SECOND = 'jg-second-fixture';
const FIRST_BYTES = 'original fixture tarball bytes';
const SECOND_BYTES = 'second fixture tarball bytes';
const BEHAVIORAL_FIXTURE = String.raw`
  const { appendFileSync, readFileSync, writeFileSync } = require('node:fs');
  const { basename, join } = require('node:path');
  const paths = JG_PATHS;
  const args = process.argv.slice(2);
  const option = (name) => args[args.indexOf(name) + 1];
  const index = args.findIndex((arg) => ['view','pack','login','whoami','publish','logout'].includes(arg));
  const command = args[index];
  const target = args[index + 1] ?? '';
  const userConfig = option('--userconfig');
  appendFileSync(paths.trace, JSON.stringify({
    command, target, userConfig,
    directory: process.cwd(), globalConfig: option('--globalconfig'),
    cache: option('--cache'), registry: option('--registry'),
    inheritedCredentials: ['NPM_TOKEN','NODE_AUTH_TOKEN','npm_config_userconfig','NPM_CONFIG_OTP','NODE_OPTIONS']
      .some((key) => key in process.env),
  }) + '\n');
  const settings = JSON.parse(readFileSync(paths.settings, 'utf8'));
  const registryMissing = () => {
    process.stderr.write('npm error E404\n');
    process.exit(1);
  };
  if (command === 'view') {
    const item = settings.catalog[target];
    if (!item) registryMissing();
    process.stdout.write(JSON.stringify(args[index + 2] === 'dist-tags' ? { latest: '0.1.0' } : item.versions));
  } else if (command === 'pack') {
    const [name, version] = target.split('@');
    const item = settings.catalog[name];
    if (item?.tarball === undefined) registryMissing();
    writeFileSync(join(option('--pack-destination'), name + '-' + version + '.tgz'), item.tarball);
    process.stdout.write('[]');
  } else if (command === 'login') {
    writeFileSync(userConfig, 'isolated fixture session\n');
  } else if (command === 'whoami') {
    if (readFileSync(userConfig, 'utf8') !== 'isolated fixture session\n') process.exit(2);
    process.stdout.write('fixture-owner\n');
  } else if (command === 'publish') {
    const label = basename(target).replace(/-0\.1\.0\.tgz$/, '');
    const journal = JSON.parse(readFileSync(paths.state, 'utf8'));
    if (!journal.attempts.some((attempt) => attempt.name === label && attempt.isPublished === false)) {
      process.exit(2);
    }
    if (settings.mode === 'interrupted') process.exit(130);
    settings.catalog[label] = settings.mode === 'staged'
      ? { versions: ['0.0.0-stage'] }
      : { versions: ['0.1.0'], tarball: readFileSync(target, 'utf8') };
    writeFileSync(paths.settings, JSON.stringify(settings));
  } else if (command === 'logout') {
    if (settings.failLogout) process.exit(1);
    writeFileSync(userConfig, '');
  } else {
    process.exit(2);
  }
`;

const fixtureEntry = (name: string, contents: string): IReleaseManifestEntry => ({
  name,
  version: VERSION,
  file: name + '-' + VERSION + '.tgz',
  sha256: sha256(Buffer.from(contents)),
});

describe.skipIf(process.platform === 'win32')(
  'first-publish with an isolated npm executable',
  () => {
    let directory: string;
    let repository: string;
    let releaseDirectory: string;
    let trace: string;
    let settings: string;
    let state: string;
    let sentinel: string;
    let environment: NodeJS.ProcessEnv;
    let options: IFirstPublishOptions;
    const confirm = vi.fn<(prompt: string, signal: AbortSignal) => Promise<boolean>>();
    const log = vi.fn();

    const setRegistry = (value: IFakeNpmSettings): Promise<void> =>
      writeFile(settings, JSON.stringify(value));
    const readState = async (): Promise<IFirstPublishState> =>
      JSON.parse(await readFile(state, 'utf8')) as IFirstPublishState;
    const calls = async (): Promise<IInvocation[]> =>
      (await readFile(trace, 'utf8'))
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as IInvocation);
    const run = (
      overrides?: Partial<IFirstPublishOptions>,
      prompt: (message: string, signal: AbortSignal) => Promise<boolean> = confirm,
      waitForPoll: () => Promise<boolean> = () => Promise.resolve(false),
    ): Promise<void> =>
      runFirstPublish(
        repository,
        { ...options, ...overrides },
        {
          environment,
          confirm: prompt,
          log,
          waitForPoll,
        },
      );
    const git = (args: string[]): string =>
      execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim();

    beforeEach(async () => {
      confirm.mockReset().mockResolvedValue(true);
      log.mockClear();
      directory = await mkdtemp(join(tmpdir(), 'jg-first-publish-test-'));
      repository = join(directory, 'checkout');
      releaseDirectory = join(repository, '.release');
      trace = join(directory, 'npm-trace.jsonl');
      settings = join(directory, 'registry.json');
      state = join(releaseDirectory, 'first-publish-state.json');
      sentinel = join(directory, 'normal.npmrc');
      const bin = join(directory, 'bin');
      await mkdir(releaseDirectory, { recursive: true });
      await mkdir(bin);
      await writeFile(sentinel, 'normal config remains unchanged\n');
      await writeFile(trace, '');
      await writeFile(join(repository, '.gitignore'), '.release/\n');
      git(['init', '--quiet', '--initial-branch=main']);
      git(['add', '.gitignore']);
      git([
        '-c',
        'user.name=Fixture',
        '-c',
        'user.email=fixture@example.test',
        '-c',
        'commit.gpgSign=false',
        'commit',
        '-qm',
        'fixture',
      ]);
      git(['remote', 'add', 'origin', 'https://github.com/jesusgraterol/jg-packages.git']);
      const sourceCommit = git(['rev-parse', 'HEAD']);
      git(['update-ref', 'refs/remotes/origin/main', sourceCommit]);

      const first = fixtureEntry(FIRST, FIRST_BYTES);
      const second = fixtureEntry(SECOND, SECOND_BYTES);
      const manifest = JSON.stringify([first, second]);
      await writeFile(join(releaseDirectory, first.file), FIRST_BYTES);
      await writeFile(join(releaseDirectory, second.file), SECOND_BYTES);
      await writeFile(join(releaseDirectory, 'release-manifest.json'), manifest);
      options = { sourceCommit, manifestSha256: sha256(Buffer.from(manifest)), packages: [FIRST] };

      const script = BEHAVIORAL_FIXTURE.replace(
        'JG_PATHS',
        JSON.stringify({ trace, settings, state }),
      );
      await writeFile(join(bin, 'npm'), '#!' + process.execPath + '\n' + script, { mode: 0o700 });
      environment = {
        ...process.env,
        PATH: bin + delimiter + process.env['PATH'],
        npm_config_userconfig: sentinel,
        NPM_TOKEN: 'fixture-ambient-token',
        NODE_AUTH_TOKEN: 'fixture-other-token',
        NPM_CONFIG_OTP: 'fixture-otp',
        NODE_OPTIONS: '--no-warnings',
      };
      await setRegistry({ mode: 'public', catalog: {} });
    });

    afterEach(async () => {
      await rm(directory, { recursive: true, force: true });
    });

    test('stages exact selected bytes, submits in manifest order and isolates login and revocation', async () => {
      await run({ packages: [SECOND, FIRST] });
      const invocations = await calls();
      expect(
        invocations
          .filter(({ command }) => ['login', 'whoami', 'publish', 'logout'].includes(command))
          .map(({ command }) => command),
      ).toStrictEqual(['login', 'whoami', 'publish', 'publish', 'logout']);
      expect(
        invocations
          .filter(({ command }) => command === 'publish')
          .map(({ target }) => relative(invocations[0]!.directory, target)),
      ).toStrictEqual([FIRST + '-' + VERSION + '.tgz', SECOND + '-' + VERSION + '.tgz']);
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(confirm.mock.calls[0]?.[0]).toContain('fixture-owner');
      const cwd = invocations[0]!.directory;
      expect(
        invocations.every(
          (call) =>
            call.directory === cwd &&
            call.userConfig === join(cwd, 'user.npmrc') &&
            call.globalConfig === join(cwd, 'global.npmrc') &&
            call.cache === join(cwd, 'cache') &&
            call.registry === 'https://registry.npmjs.org/' &&
            !call.inheritedCredentials,
        ),
      ).toBe(true);
      expect(isAbsolute(cwd)).toBe(true);
      expect(cwd.startsWith(repository + '/')).toBe(false);
      await expect(readdir(cwd)).rejects.toHaveProperty('code', 'ENOENT');
      expect(await readFile(sentinel, 'utf8')).toBe('normal config remains unchanged\n');
      expect((await readState()).attempts.map(({ isPublished }) => isPublished)).toStrictEqual([
        true,
        true,
      ]);
      expect(await readdir(releaseDirectory)).not.toContain('first-publish.lock');
    });

    test('rejects a wrong commit and a stale but internally consistent manifest and tarball pair before npm', async () => {
      await expect(run({ sourceCommit: '0'.repeat(40) })).rejects.toThrow('approved commit');
      const oldBytes = 'stale but consistent tarball bytes';
      const oldEntry = fixtureEntry(FIRST, oldBytes);
      await writeFile(join(releaseDirectory, oldEntry.file), oldBytes);
      await writeFile(join(releaseDirectory, 'release-manifest.json'), JSON.stringify([oldEntry]));
      await expect(run()).rejects.toThrow('manifest SHA-256');
      expect(await calls()).toStrictEqual([]);
    });

    test('rejects tarball tampering before login and refuses an occupied name without submitting', async () => {
      const tarball = join(releaseDirectory, fixtureEntry(FIRST, FIRST_BYTES).file);
      await writeFile(tarball, 'changed bytes');
      await expect(run()).rejects.toThrow('differs from the approved release');
      expect(await calls()).toStrictEqual([]);
      await writeFile(tarball, FIRST_BYTES);
      await setRegistry({ mode: 'public', catalog: { [FIRST]: { versions: ['0.0.0-stage'] } } });
      await expect(run()).rejects.toThrow('already occupied');
      expect((await calls()).map(({ command }) => command)).toStrictEqual(['view']);
    });

    test('logs out and removes private configuration when the developer refuses the account', async () => {
      confirm.mockResolvedValue(false);
      await expect(run()).rejects.toThrow('did not confirm');
      const invocations = await calls();
      expect(invocations.map(({ command }) => command)).toStrictEqual([
        'view',
        'login',
        'whoami',
        'logout',
      ]);
      await expect(readdir(invocations[0]!.directory)).rejects.toHaveProperty('code', 'ENOENT');
      expect(await readdir(releaseDirectory)).not.toContain('first-publish-state.json');
    });

    test('reports uncertain revocation and removes the isolated config after logout fails', async () => {
      await setRegistry({ mode: 'public', catalog: {}, failLogout: true });
      await run();
      expect(log).toHaveBeenCalledWith(expect.stringContaining('revocation could not be verified'));
      const invocations = await calls();
      await expect(readdir(invocations[0]!.directory)).rejects.toHaveProperty('code', 'ENOENT');
      expect(await readFile(sentinel, 'utf8')).toBe('normal config remains unchanged\n');
    });

    test('interrupted submission remains unresolved until the exact public tarball appears across invocations', async () => {
      await setRegistry({ mode: 'interrupted', catalog: {} });
      await expect(run()).rejects.toThrow('unresolved');
      expect((await readState()).attempts[0]?.isPublished).toBe(false);
      await expect(run()).rejects.toThrow('unresolved');
      await setRegistry({ mode: 'public', catalog: { [FIRST]: { versions: [VERSION] } } });
      await expect(run()).rejects.toThrow('unresolved');
      await setRegistry({
        mode: 'public',
        catalog: { [FIRST]: { versions: [VERSION], tarball: 'different bytes' } },
      });
      await expect(run()).rejects.toThrow('bytes conflict');
      await setRegistry({
        mode: 'public',
        catalog: { [FIRST]: { versions: [VERSION], tarball: FIRST_BYTES } },
      });
      await run();
      expect((await calls()).filter(({ command }) => command === 'publish')).toHaveLength(1);
      expect((await readState()).attempts[0]?.isPublished).toBe(true);
    });

    test('waits through a processing placeholder and verifies the public archive without resubmitting', async () => {
      await setRegistry({ mode: 'staged', catalog: {} });
      const waitForPoll = vi.fn(async () => {
        await setRegistry({
          mode: 'public',
          catalog: { [FIRST]: { versions: ['0.0.0-stage', VERSION], tarball: FIRST_BYTES } },
        });
        return true;
      });

      await run(undefined, confirm, waitForPoll);

      expect(waitForPoll).toHaveBeenCalledTimes(1);
      expect((await calls()).filter(({ command }) => command === 'publish')).toHaveLength(1);
      expect((await readState()).attempts[0]).toMatchObject({ isPublished: true });
    });

    test('reconciles an ambiguous placeholder once the exact public archive appears', async () => {
      await setRegistry({ mode: 'staged', catalog: {} });
      await expect(run()).rejects.toThrow('Verify its stage bytes');
      expect((await readState()).attempts[0]?.requiresStageEvidence).toBe(false);
      await setRegistry({
        mode: 'public',
        catalog: { [FIRST]: { versions: ['0.0.0-stage', VERSION], tarball: 'different bytes' } },
      });
      await expect(run()).rejects.toThrow('bytes conflict');
      await setRegistry({
        mode: 'public',
        catalog: { [FIRST]: { versions: ['0.0.0-stage', VERSION], tarball: FIRST_BYTES } },
      });

      await run();

      expect((await calls()).filter(({ command }) => command === 'publish')).toHaveLength(1);
      expect((await readState()).attempts[0]).toMatchObject({ isPublished: true });
    });

    test('keeps a placeholder unresolved if it briefly disappears during polling', async () => {
      await setRegistry({ mode: 'staged', catalog: {} });
      const waitForPoll = vi.fn<() => Promise<boolean>>().mockResolvedValue(false);
      waitForPoll.mockImplementationOnce(async () => {
        await setRegistry({ mode: 'public', catalog: {} });
        return true;
      });

      await expect(run(undefined, confirm, waitForPoll)).rejects.toThrow('Verify its stage bytes');
      expect((await calls()).filter(({ command }) => command === 'publish')).toHaveLength(1);
      expect((await readState()).attempts[0]).toMatchObject({
        isPublished: false,
        requiresStageEvidence: false,
      });
    });

    test('staged submission accepts matching dashboard download evidence before approval', async () => {
      await setRegistry({ mode: 'staged', catalog: {} });
      await expect(run()).rejects.toThrow('Verify its stage bytes');
      await expect(run()).rejects.toThrow('Verify its stage bytes');
      const staged = join(directory, 'staged.tgz');
      await writeFile(staged, 'wrong staged bytes');
      const evidence = { stage: { id: 'stage-1', tarball: staged } };
      await expect(run(evidence)).rejects.toThrow('does not match the approved tarball');
      const pending = (await readState()).attempts[0];
      expect(pending?.requiresStageEvidence).toBe(true);
      expect(pending?.stageId).toBeUndefined();
      await setRegistry({
        mode: 'public',
        catalog: { [FIRST]: { versions: ['0.0.0-stage', VERSION], tarball: FIRST_BYTES } },
      });
      await expect(run()).rejects.toThrow('Verified stage evidence is required');
      expect((await readState()).attempts[0]?.isPublished).toBe(false);
      await setRegistry({
        mode: 'public',
        catalog: { [FIRST]: { versions: [VERSION], tarball: FIRST_BYTES } },
      });
      await expect(run()).rejects.toThrow('Verified stage evidence is required');
      await writeFile(staged, FIRST_BYTES);
      await expect(run(evidence)).rejects.toThrow('pending developer approval');
      expect((await readState()).attempts[0]?.stageId).toBe('stage-1');
      await setRegistry({
        mode: 'public',
        catalog: { [FIRST]: { versions: ['0.0.0-stage', VERSION], tarball: FIRST_BYTES } },
      });
      await run();
      expect((await calls()).filter(({ command }) => command === 'publish')).toHaveLength(1);
      expect((await readState()).attempts[0]?.isPublished).toBe(true);
    });

    test('requires operator confirmation before retrying a definitively unaccepted attempt', async () => {
      await setRegistry({ mode: 'interrupted', catalog: {} });
      await expect(run()).rejects.toThrow('unresolved');
      await setRegistry({ mode: 'public', catalog: {} });
      confirm.mockResolvedValueOnce(false);
      await expect(run({ retryUncertain: FIRST })).rejects.toThrow('unresolved');
      expect((await calls()).filter(({ command }) => command === 'publish')).toHaveLength(1);
      await run({ retryUncertain: FIRST });
      expect((await calls()).filter(({ command }) => command === 'publish')).toHaveLength(2);
    });

    test('concurrent submissions are refused while the first run holds the release lock', async () => {
      let entered: () => void;
      let approve: (value: boolean) => void;
      const promptActive = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const response = new Promise<boolean>((resolve) => {
        approve = resolve;
      });
      const first = run(
        undefined,
        vi.fn(() => {
          entered();
          return response;
        }),
      );
      try {
        await Promise.race([promptActive, first]);
        await expect(run()).rejects.toHaveProperty('code', 'LOCK_BUSY');
      } finally {
        approve!(true);
        await first;
      }
      expect((await calls()).filter(({ command }) => command === 'publish')).toHaveLength(1);
    });
  },
);
