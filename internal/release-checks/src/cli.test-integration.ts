import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { PUBLISHED_FILE } from './shared/constants.ts';
import { sha256, writeReleaseManifest } from './shared/release-files.ts';
import { runCommand } from './shared/run-command.ts';

// runs the command-line tool with the given arguments
const runCli = (args: string[]) =>
  runCommand(process.execPath, [join(import.meta.dirname, 'cli.ts'), ...args]);

describe('the release command-line tool', () => {
  test.each([
    [['publish'], 'Missing --from.'],
    [['tag', '--from', 'release'], 'Missing --published.'],
    [['pack'], 'Missing --out.'],
    [['release'], 'Unknown command: release'],
    [[], 'Unknown command: (none)'],
    [['verify', 'extra'], 'Unexpected arguments: extra'],
  ])('cli(%o) -> prints the problem and the usage, and exits 2', async (args, message) => {
    const { exitCode, stderr } = await runCli(args);

    expect(exitCode).toBe(2);
    expect(stderr).toContain(message);
    expect(stderr).toContain('Usage: node internal/release-checks/src/cli.ts <command>');
  });

  test('rejects options it does not know', async () => {
    const { exitCode, stderr } = await runCli(['publish', '--from', 'release', '--force']);

    expect(exitCode).toBe(2);
    expect(stderr).toContain("Unknown option '--force'");
  });
});

const TRUSTED_SOURCE = [
  'cli.ts',
  'publish/publish.ts',
  'tag/tag.ts',
  'shared/constants.ts',
  'shared/release-files.ts',
  'shared/run-command.ts',
  'shared/tarball.ts',
  'shared/types.ts',
  'shared/versions.ts',
];

/**
 * Qualifies the actual trusted CLI from a checkout without any workspace package dependencies.
 * npm is a local executable with an explicit simulated registry. Git tags go to a local remote.
 */
test.skipIf(process.platform === 'win32')(
  'publishes and tags a fixture without installing workspace dependencies',
  async () => {
    const fixture = await mkdtemp(join(tmpdir(), 'jg-trusted-cli-'));
    try {
      const checkout = join(fixture, 'checkout');
      const bareRemote = join(fixture, 'remote.git');
      const source = join(checkout, 'internal', 'release-checks', 'src');
      const bin = join(fixture, 'bin');
      const release = join(fixture, 'release');
      const receipt = join(fixture, 'published-npm.json');
      const packageDirectory = join(fixture, 'package');
      await Promise.all(
        [bin, release, packageDirectory].map(async (directory) => mkdir(directory)),
      );
      await Promise.all(
        TRUSTED_SOURCE.map(async (file) => {
          const destination = join(source, file);
          await mkdir(dirname(destination), { recursive: true });
          await cp(join(import.meta.dirname, file), destination);
        }),
      );

      const name = 'jg-trusted-cli-fixture';
      const version = '1.0.0';
      const tarballName = `${name}-${version}.tgz`;
      const tarball = join(release, tarballName);
      await writeFile(join(packageDirectory, 'package.json'), JSON.stringify({ name, version }));
      const pack = await runCommand(
        'npm',
        ['pack', '--ignore-scripts', '--offline', '--pack-destination', release],
        { cwd: packageDirectory },
      );
      expect(pack.exitCode, pack.stderr).toBe(0);
      const digest = sha256(await readFile(tarball));
      await writeReleaseManifest(release, [{ name, version, file: tarballName, sha256: digest }]);

      await writeFile(
        join(bin, 'npm'),
        `#!${process.execPath}
const fs=require('node:fs');
const {createHash}=require('node:crypto');
const assert=require('node:assert/strict');
const receipt=${JSON.stringify(receipt)};
const [action,spec,...args]=process.argv.slice(2);
if(action==='view'){
  assert.deepEqual(args,['version','--json']);
  if(spec===${JSON.stringify(name)}) console.log('"0.9.0"');
  else if(spec===${JSON.stringify(`${name}@${version}`)} && fs.existsSync(receipt)) console.log('"${version}"');
  else { process.stderr.write('E404'); process.exitCode=1; }
}else if(action==='publish'){
  assert.equal(spec,${JSON.stringify(tarball)});
  assert.deepEqual(args,['--access','public']);
  assert.equal(createHash('sha256').update(fs.readFileSync(spec)).digest('hex'),${JSON.stringify(digest)});
  fs.writeFileSync(receipt,JSON.stringify({name:${JSON.stringify(name)},version:${JSON.stringify(version)}}),{flag:'wx'});
}else throw new Error('Unexpected npm call: '+action);
`,
        { mode: 0o700 },
      );
      const env = {
        ...process.env,
        PATH: [bin, process.env['PATH'] ?? ''].join(delimiter),
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_TERMINAL_PROMPT: '0',
      };
      const git = async (...args: string[]): Promise<string> => {
        const result = await runCommand('git', args, { cwd: checkout, env });
        expect(result.exitCode, result.stderr).toBe(0);
        return result.stdout.trim();
      };
      await git('init', '--quiet', '--bare', bareRemote);
      await git('init', '--quiet');
      await git('remote', 'add', 'origin', bareRemote);
      await git(
        '-c',
        'user.name=Release Fixture',
        '-c',
        'user.email=fixture@example.com',
        'commit',
        '--quiet',
        '--allow-empty',
        '-m',
        'Fixture baseline',
      );
      const head = await git('rev-parse', 'HEAD');

      const cli = join(source, 'cli.ts');
      const publish = await runCommand(process.execPath, [cli, 'publish', '--from', release], {
        cwd: checkout,
        env,
      });
      expect(publish.exitCode, publish.stderr).toBe(0);
      expect(publish.stdout).toContain(`Published ${name}@${version}`);
      expect(JSON.parse(await readFile(receipt, 'utf8'))).toStrictEqual({ name, version });
      const publishedFile = join(release, PUBLISHED_FILE);
      expect(JSON.parse(await readFile(publishedFile, 'utf8'))).toStrictEqual([{ name, version }]);

      const tag = `${name}-v${version}`;
      const tagged = await runCommand(
        process.execPath,
        [cli, 'tag', '--from', release, '--published', publishedFile],
        { cwd: checkout, env },
      );
      expect(tagged.exitCode, tagged.stderr).toBe(0);
      expect(tagged.stdout).toContain(`Pushed ${tag}`);
      expect(await git('--git-dir', bareRemote, 'rev-parse', `refs/tags/${tag}^{}`)).toBe(head);
    } finally {
      await rm(fixture, { recursive: true, force: true });
    }
  },
  30_000,
);
