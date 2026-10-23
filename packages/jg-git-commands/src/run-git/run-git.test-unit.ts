// @vitest-environment node
import type * as FileSystemModule from 'node:fs/promises';
import { Exception } from 'jg-exception';
import { expectToRejectCode } from 'jg-exception/testing';
import type * as ProcessModule from 'jg-process';
import { ERRORS as PROCESS_ERRORS, runProcess } from 'jg-process';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { ERRORS } from '../shared/index.js';

import { runGit } from './run-git.js';

vi.mock('jg-process', async (importOriginal) => ({
  ...(await importOriginal<typeof ProcessModule>()),
  runProcess: vi.fn(),
}));

// every working directory exists, so the start failure is the only one
vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof FileSystemModule>()),
  stat: vi.fn(() => Promise.resolve({ isDirectory: () => true })),
}));

const originalPlatform = process.platform;

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: originalPlatform });
  vi.mocked(runProcess).mockReset();
});

/**
 * Makes the next run fail to start the way a missing program does.
 */
const failToStart = (): void => {
  const missing = Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' });
  vi.mocked(runProcess).mockRejectedValueOnce(
    new Exception("Unable to start 'git'.", {
      code: PROCESS_ERRORS.PROCESS_START_FAILED,
      cause: missing,
    }),
  );
};

describe('runGit on Windows', () => {
  test('refuses a working directory past the path limit that Windows reports as a missing program', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    failToStart();

    await expectToRejectCode(
      runGit(['status'], { cwd: `C:\\${'a'.repeat(260)}` }),
      ERRORS.GIT_INVALID_ARGUMENT,
    );
  });

  test('reports a missing Git for a short working directory', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    failToStart();

    await expectToRejectCode(runGit(['status'], { cwd: 'C:\\repo' }), ERRORS.GIT_NOT_FOUND);
  });
});

describe('runGit environment', () => {
  test('ignores the prompt variables the caller passes, whatever their case', async () => {
    vi.mocked(runProcess).mockResolvedValueOnce({
      stdout: '',
      stderr: '',
      exitCode: 0,
      signalCode: null,
      durationMs: 1,
    });

    await runGit(['status'], {
      cwd: '/srv/app',
      env: {
        git_askpass: '/bin/askpass',
        Git_Terminal_Prompt: '1',
        ssh_askpass: '/bin/ssh-askpass',
        Gcm_Interactive: 'always',
        GIT_SSL_CAINFO: '/certs/ca.pem',
      },
    });

    const env = vi.mocked(runProcess).mock.calls[0]?.[0].env ?? {};
    expect(env['git_askpass']).toBeUndefined();
    expect(env['Git_Terminal_Prompt']).toBeUndefined();
    expect(env['ssh_askpass']).toBeUndefined();
    expect(env['Gcm_Interactive']).toBeUndefined();
    expect(env['GIT_SSL_CAINFO']).toBe('/certs/ca.pem');
    expect(env['GIT_ASKPASS']).toBe('');
    expect(env['GIT_TERMINAL_PROMPT']).toBe('0');
    expect(env['GCM_INTERACTIVE']).toBe('never');
  });
});
