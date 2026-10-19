// @vitest-environment node
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { getErrorCode } from 'jg-exception';
import { expectToRejectCode } from 'jg-exception/testing';
import { type IProcessResult, ERRORS as PROCESS_ERRORS } from 'jg-process';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { ERRORS } from '../shared/index.js';
import {
  createHomeEnv,
  createTemporaryDirectory,
  git,
  initRepository,
  writeCommit,
  writeMarkerProgram,
} from '../shared/repository.test-utils.js';

import { runGit } from './run-git.js';
import type { IRunGitOptions } from './types.js';

// the marker programs are POSIX shell scripts
const IS_WINDOWS = process.platform === 'win32';

// the credentials the credential helper answers with
const BASIC_CREDENTIALS = `Basic ${Buffer.from('jg:secret').toString('base64')}`;

/**
 * Starts a server on 127.0.0.1 and a free port that answers every request with a handler.
 * @param handler What answers each request.
 * @returns A promise that resolves to the server.
 */
const startServer = async (handler: Parameters<typeof createServer>[1]): Promise<Server> => {
  const server = createServer(handler);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  return server;
};

/**
 * Stops a server, closing the connections it holds.
 * @param server The server.
 * @returns A promise that resolves once it's closed.
 */
const stopServer = async (server: Server): Promise<void> => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
};

describe('runGit', () => {
  let directory: string;
  let repository: string;
  let home: string;
  let homeEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    directory = await createTemporaryDirectory('run');
    repository = join(directory, 'repository');
    home = join(directory, 'home');
    await mkdir(repository);
    await mkdir(home);
    await initRepository(repository);
    homeEnv = createHomeEnv(home);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  });

  test('resolves with the exit code and the output, whatever the exit code', async () => {
    const commit = await writeCommit(repository, { 'README.md': 'hello\n' });
    await git(repository, ['update-ref', 'refs/heads/main', commit]);

    await expect(
      runGit(['rev-parse', 'main'], { cwd: repository, env: homeEnv }),
    ).resolves.toMatchObject({ exitCode: 0, stdout: `${commit}\n` });
    await expect(
      runGit(['rev-parse', '--verify', '--quiet', 'missing'], { cwd: repository, env: homeEnv }),
    ).resolves.toMatchObject({ exitCode: 1, stdout: '' });
  });

  test('writes its input to stdin', async () => {
    const result = await runGit(['hash-object', '--stdin'], {
      cwd: repository,
      env: homeEnv,
      input: 'hello\n',
    });

    expect(result.stdout.trim()).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
  });

  test('ignores the inherited variables that point Git at another repository or config', async () => {
    const other = join(directory, 'other');
    await git(directory, ['init', '--quiet', other]);
    vi.stubEnv('GIT_DIR', join(other, '.git'));
    vi.stubEnv('GIT_WORK_TREE', other);
    vi.stubEnv('GIT_INDEX_FILE', join(other, 'index'));
    vi.stubEnv('GIT_OBJECT_DIRECTORY', join(other, '.git', 'objects'));
    vi.stubEnv('GIT_CONFIG_PARAMETERS', "'user.name'='inherited'");
    vi.stubEnv('GIT_CONFIG_COUNT', '1');
    vi.stubEnv('GIT_CONFIG_KEY_0', 'user.email');
    vi.stubEnv('GIT_CONFIG_VALUE_0', 'inherited@example.com');

    const topLevel = await runGit(['rev-parse', '--show-toplevel'], {
      cwd: repository,
      env: homeEnv,
    });
    const name = await runGit(['config', '--get', 'user.name'], { cwd: repository, env: homeEnv });
    const email = await runGit(['config', '--get', 'user.email'], {
      cwd: repository,
      env: homeEnv,
    });

    expect(topLevel.stdout.trim()).toBe(repository);
    expect(name).toMatchObject({ exitCode: 1, stdout: '' });
    expect(email).toMatchObject({ exitCode: 1, stdout: '' });
  });

  describe('global config', () => {
    let bareUrl: string;
    let aliasUrl: string;
    let commit: string;

    beforeEach(async () => {
      const bare = join(directory, 'remote.git');
      await git(directory, ['init', '--quiet', '--bare', '--initial-branch=main', bare]);
      commit = await writeCommit(bare, { 'README.md': 'hello\n' });
      await git(bare, ['update-ref', 'refs/heads/main', commit]);
      bareUrl = pathToFileURL(bare).href;
      aliasUrl = pathToFileURL(join(directory, 'alias.git')).href;
      await writeFile(join(home, '.gitconfig'), `[url "${bareUrl}"]\n\tinsteadOf = ${aliasUrl}\n`);
    });

    test('applies by default, such as a url.<base>.insteadOf rewrite', async () => {
      const result = await runGit(['ls-remote', '--refs', aliasUrl, 'refs/heads/main'], {
        cwd: repository,
        env: homeEnv,
      });

      expect(result).toMatchObject({ exitCode: 0, stdout: `${commit}\trefs/heads/main\n` });
    });

    test('is ignored with isolateConfig', async () => {
      const result = await runGit(['ls-remote', '--refs', aliasUrl, 'refs/heads/main'], {
        cwd: repository,
        env: homeEnv,
        isolateConfig: true,
      });

      expect(result.exitCode).toBe(128);
      expect(result.stdout).toBe('');
    });
  });

  describe('a remote that asks for credentials', () => {
    let server: Server;
    let url: string;
    let authorizations: (string | null)[];

    beforeAll(async () => {
      server = await startServer((request, response) => {
        authorizations.push(request.headers.authorization ?? null);
        response.writeHead(401, { 'WWW-Authenticate': 'Basic realm="jg-git-commands"' });
        response.end();
      });
      url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/repository.git`;
    });

    afterAll(async () => {
      await stopServer(server);
    });

    beforeEach(() => {
      authorizations = [];
    });

    /**
     * Lists the remote's refs, which the server refuses.
     * @param options runGit's options besides the working directory.
     * @returns A promise that resolves to the result.
     */
    const listRefs = (options: Omit<IRunGitOptions, 'cwd'> = {}): Promise<IProcessResult> =>
      runGit(['ls-remote', '--end-of-options', url], {
        cwd: repository,
        timeoutSeconds: 10,
        ...options,
        env: { ...homeEnv, ...options.env },
      });

    test('fails without prompting when nothing answers for the credentials', async () => {
      const result = await listRefs();

      expect(result.exitCode).toBe(128);
      expect(authorizations).toStrictEqual([null]);
    });

    test('sends a header the caller passes as config through env, outside the arguments', async () => {
      const result = await listRefs({
        env: {
          GIT_CONFIG_COUNT: '1',
          GIT_CONFIG_KEY_0: 'http.extraHeader',
          GIT_CONFIG_VALUE_0: 'Authorization: Bearer test-token',
        },
      });

      expect(result.exitCode).toBe(128);
      expect(authorizations).toStrictEqual(['Bearer test-token']);
    });

    test.skipIf(IS_WINDOWS)(
      'never runs an askpass program from the repository config, the global config, or the environment',
      async () => {
        const repositoryAskpass = await writeMarkerProgram(directory, 'repository-askpass', 'x');
        const globalAskpass = await writeMarkerProgram(directory, 'global-askpass', 'x');
        const inheritedAskpass = await writeMarkerProgram(directory, 'inherited-askpass', 'x');
        const passedAskpass = await writeMarkerProgram(directory, 'passed-askpass', 'x');
        await git(repository, ['config', 'core.askPass', repositoryAskpass.path]);
        await writeFile(join(home, '.gitconfig'), `[core]\n\taskPass = ${globalAskpass.path}\n`);
        vi.stubEnv('GIT_ASKPASS', inheritedAskpass.path);
        vi.stubEnv('SSH_ASKPASS', inheritedAskpass.path);
        vi.stubEnv('SSH_ASKPASS_REQUIRE', 'force');

        const result = await listRefs({
          env: { GIT_ASKPASS: passedAskpass.path, SSH_ASKPASS: passedAskpass.path },
        });

        expect(result.exitCode).toBe(128);
        expect(authorizations).toStrictEqual([null]);
        for (const program of [repositoryAskpass, globalAskpass, inheritedAskpass, passedAskpass]) {
          expect(existsSync(program.markerPath)).toBe(false);
        }
      },
    );

    test.skipIf(IS_WINDOWS)(
      'never runs a credential helper from the repository config or the global config by default',
      async () => {
        const repositoryHelper = await writeMarkerProgram(
          directory,
          'repository-helper',
          'username=jg\npassword=secret\n',
        );
        const globalHelper = await writeMarkerProgram(
          directory,
          'global-helper',
          'username=jg\npassword=secret\n',
        );
        await git(repository, ['config', 'credential.helper', repositoryHelper.path]);
        await writeFile(
          join(home, '.gitconfig'),
          `[credential]\n\thelper = ${globalHelper.path}\n`,
        );

        const result = await listRefs();

        expect(result.exitCode).toBe(128);
        expect(authorizations).toStrictEqual([null]);
        expect(existsSync(repositoryHelper.markerPath)).toBe(false);
        expect(existsSync(globalHelper.markerPath)).toBe(false);
      },
    );

    test.skipIf(IS_WINDOWS)(
      'runs the configured credential helpers with useCredentialHelpers, still without askpass',
      async () => {
        const helper = await writeMarkerProgram(
          directory,
          'helper',
          'username=jg\npassword=secret\n',
        );
        const askpass = await writeMarkerProgram(directory, 'askpass', 'x');
        await git(repository, ['config', 'credential.helper', helper.path]);
        await git(repository, ['config', 'core.askPass', askpass.path]);

        const result = await listRefs({ useCredentialHelpers: true });

        expect(result.exitCode).toBe(128);
        expect(authorizations).toStrictEqual([null, BASIC_CREDENTIALS]);
        expect(await readFile(helper.markerPath, 'utf8')).toMatch(/^run get\n/);
        expect(existsSync(askpass.markerPath)).toBe(false);
      },
    );

    test.skipIf(IS_WINDOWS)(
      'asks no askpass program for what a credential helper leaves out',
      async () => {
        const helper = await writeMarkerProgram(directory, 'helper', 'username=jg\n');
        const askpass = await writeMarkerProgram(directory, 'askpass', 'x');
        await git(repository, ['config', 'credential.helper', helper.path]);
        await git(repository, ['config', 'core.askPass', askpass.path]);
        vi.stubEnv('GIT_ASKPASS', askpass.path);

        const result = await listRefs({ useCredentialHelpers: true });

        expect(result.exitCode).toBe(128);
        expect(authorizations).toStrictEqual([null]);
        expect(await readFile(helper.markerPath, 'utf8')).toBe('run get\n');
        expect(existsSync(askpass.markerPath)).toBe(false);
      },
    );
  });

  test("passes jg-process's timeout through for a remote that never answers", async () => {
    const server = await startServer(() => {
      // never answers
    });
    try {
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/repository.git`;

      await expectToRejectCode(
        runGit(['ls-remote', url], { cwd: repository, env: homeEnv, timeoutSeconds: 1 }),
        PROCESS_ERRORS.PROCESS_TIMED_OUT,
      );
    } finally {
      await stopServer(server);
    }
  });

  test('stops the command when its signal aborts, rejecting with the reason', async () => {
    const server = await startServer(() => {
      // never answers
    });
    try {
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/repository.git`;
      const controller = new AbortController();
      const reason = new Error('the caller stopped waiting');
      setTimeout(() => controller.abort(reason), 200);

      await expect(
        runGit(['ls-remote', url], { cwd: repository, env: homeEnv, signal: controller.signal }),
      ).rejects.toBe(reason);
    } finally {
      await stopServer(server);
    }
  });

  test.skipIf(IS_WINDOWS)('throws GIT_NOT_FOUND when git is not on the PATH', async () => {
    const empty = join(directory, 'empty');
    await mkdir(empty);

    await expectToRejectCode(
      runGit(['--version'], { cwd: repository, env: { PATH: empty } }),
      ERRORS.GIT_NOT_FOUND,
    );
  });

  test.skipIf(IS_WINDOWS)(
    "passes jg-process's start failure through for any other reason",
    async () => {
      const bin = join(directory, 'bin');
      await mkdir(bin);
      // a git that isn't executable
      await writeFile(join(bin, 'git'), '#!/bin/sh\n', { mode: 0o644 });

      let error: unknown;
      try {
        await runGit(['--version'], { cwd: repository, env: { PATH: bin } });
      } catch (caught) {
        error = caught;
      }

      expect(getErrorCode(error)).toBe(PROCESS_ERRORS.PROCESS_START_FAILED);
    },
  );

  test.skipIf(IS_WINDOWS)(
    "gives git the caller's variables, but never the ones that would let a prompt through",
    async () => {
      // a git that prints the variables it was given
      const bin = join(directory, 'bin');
      await mkdir(bin);
      await writeFile(
        join(bin, 'git'),
        '#!/bin/sh\nprintf "%s|%s|%s|%s|%s" "$GIT_TERMINAL_PROMPT" "$GIT_ASKPASS" "${SSH_ASKPASS-unset}" "$GIT_SSL_CAINFO" "$*"\n',
        { mode: 0o755 },
      );

      const result = await runGit(['status'], {
        cwd: repository,
        env: {
          PATH: bin,
          GIT_TERMINAL_PROMPT: '1',
          GIT_ASKPASS: '/bin/askpass',
          SSH_ASKPASS: '/bin/askpass',
          GIT_SSL_CAINFO: '/etc/ssl/internal.pem',
        },
      });

      expect(result.stdout).toBe(
        '0||unset|/etc/ssl/internal.pem|-c core.fsmonitor= -c core.askPass= -c core.pager=cat -c credential.helper= --no-pager status',
      );
    },
  );

  test.each([
    ['arguments that are not an array', 'status', () => repository],
    ['an argument with a null character', ['status\0'], () => repository],
    ['an argument that is not a string', [42], () => repository],
    ['an empty working directory', ['status'], () => ''],
    ['a working directory that does not exist', ['status'], () => join(directory, 'missing')],
    ['a working directory that is a file', ['status'], () => join(repository, '.git', 'HEAD')],
  ])('rejects %s', async (_description, args, cwd) => {
    await expectToRejectCode(
      runGit(args as string[], { cwd: cwd(), env: homeEnv }),
      ERRORS.GIT_INVALID_ARGUMENT,
    );
  });
});
