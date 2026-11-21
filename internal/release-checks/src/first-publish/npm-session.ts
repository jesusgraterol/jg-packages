import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, isAbsolute, join } from 'node:path';

import { isPathWithin } from 'jg-fs';
import {
  createShutdownSignal,
  type IForegroundProcessResult,
  type IProcessResult,
  resolvePackageManagerCommand,
  runForegroundProcess,
  runProcess,
} from 'jg-process';

const REGISTRY = 'https://registry.npmjs.org/';
const CAPTURE_TIMEOUT_SECONDS = 120;
const NPM_OUTPUT_BYTES = 256 * 1024;
const SYSTEM_ENVIRONMENT_KEYS = [
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'TERM',
  'COLORTERM',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'DISPLAY',
  'WAYLAND_DISPLAY',
  'XDG_RUNTIME_DIR',
  'DBUS_SESSION_BUS_ADDRESS',
  'SystemRoot',
  'ComSpec',
  'PATHEXT',
  'USERPROFILE',
  'HOMEDRIVE',
  'HOMEPATH',
] as const;

export type INpmSession = {
  directory: string;
  signal: AbortSignal;
  capture: (args: string[], deadline?: AbortSignal) => Promise<IProcessResult>;
  publish: (tarball: string) => Promise<IForegroundProcessResult>;
  login: () => Promise<string>;
};

/**
 * Creates the environment needed by the executable and its browser flow.
 * @param inherited The operator's environment.
 * @returns The child environment without ambient npm authentication or config.
 */
const npmEnvironment = (inherited: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
  const inheritedPath = inherited['PATH'] ?? inherited['Path'] ?? '';
  const env: NodeJS.ProcessEnv = {
    PATH: inheritedPath.split(delimiter).filter(isAbsolute).join(delimiter),
  };
  for (const name of SYSTEM_ENVIRONMENT_KEYS) {
    const value = inherited[name];
    if (value !== undefined) {
      env[name] = value;
    }
  }
  return env;
};

/**
 * Gives a first-publish operation private npm configuration and revokes its login on exit.
 * @param root The qualified checkout.
 * @param environment The operator's environment.
 * @param log Reports release status without logging npm credentials or debug output.
 * @param run Runs the operation with the isolated npm session.
 * @returns The result of the operation.
 */
export const withIsolatedNpm = async <T>(
  root: string,
  environment: NodeJS.ProcessEnv,
  log: (message: string) => void,
  run: (npm: INpmSession) => Promise<T>,
): Promise<T> => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), 'jg-first-publish-'));
  const shutdown = createShutdownSignal({ signals: ['SIGINT'], setExitCode: false });
  try {
    if (isPathWithin(await realpath(root), directory)) {
      throw new Error('The temporary npm directory must be outside the repository.');
    }
    const userconfig = join(directory, 'user.npmrc');
    const globalconfig = join(directory, 'global.npmrc');
    await writeFile(userconfig, '', { flag: 'wx', mode: 0o600 });
    await writeFile(globalconfig, '', { flag: 'wx', mode: 0o600 });
    const env = npmEnvironment(environment);
    const { command, args: prefix } = resolvePackageManagerCommand([], {
      packageManager: 'npm',
      cwd: directory,
      env,
    });
    const configuration = [
      '--registry',
      REGISTRY,
      '--userconfig',
      userconfig,
      '--globalconfig',
      globalconfig,
      '--cache',
      join(directory, 'cache'),
      '--prefix',
      directory,
      '--prefer-online',
      '--fetch-timeout',
      String(CAPTURE_TIMEOUT_SECONDS * 1000),
      '--fetch-retries',
      '0',
    ];
    const foreground = (args: string[]): Promise<IForegroundProcessResult> =>
      runForegroundProcess(command, [...prefix, ...configuration, ...args], {
        cwd: directory,
        env,
      });
    const capture = (args: string[], deadline?: AbortSignal): Promise<IProcessResult> =>
      runProcess({
        command,
        args: [...prefix, ...configuration, ...args],
        cwd: directory,
        env,
        timeoutSeconds: CAPTURE_TIMEOUT_SECONDS,
        maxOutputBytes: NPM_OUTPUT_BYTES,
        signal: deadline ? AbortSignal.any([shutdown.signal, deadline]) : shutdown.signal,
      });
    let loginAttempted = false;
    try {
      return await run({
        directory,
        signal: shutdown.signal,
        capture,
        publish: (tarball) =>
          foreground(['publish', tarball, '--access', 'public', '--ignore-scripts']),
        login: async () => {
          shutdown.signal.throwIfAborted();
          loginAttempted = true;
          const result = await foreground(['login', '--auth-type=web']);
          shutdown.signal.throwIfAborted();
          if (result.exitCode !== 0) {
            throw new Error('Isolated npm login failed.');
          }
          const identity = await capture(['whoami']);
          const account = identity.stdout.trim();
          if (identity.exitCode !== 0 || !/^[a-zA-Z0-9_-]{1,50}$/.test(account)) {
            throw new Error('Could not verify the isolated npm account.');
          }
          return account;
        },
      });
    } finally {
      if (loginAttempted) {
        const revocationWarning =
          'Temporary npm session revocation could not be verified. Revoke the temporary session in your npm account.';
        try {
          const result = await foreground(['logout']);
          if (result.exitCode !== 0) {
            log(revocationWarning);
          }
        } catch {
          log(revocationWarning);
        }
      }
    }
  } finally {
    shutdown.dispose();
    await rm(directory, { recursive: true, force: true });
  }
};
