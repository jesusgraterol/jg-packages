// @vitest-environment node
import { afterEach, describe, expect, test, vi } from 'vitest';

import { DEFAULT_GIT_SSH_COMMAND } from './constants.js';
import { createGitEnvironment } from './environment.js';

// the variables every environment ends with, whatever it started from
const NON_INTERACTIVE = {
  GIT_TERMINAL_PROMPT: '0',
  GIT_ASKPASS: '',
  GIT_OPTIONAL_LOCKS: '0',
  GIT_NO_REPLACE_OBJECTS: '1',
  GIT_NO_LAZY_FETCH: '1',
  GIT_LITERAL_PATHSPECS: '1',
  GIT_ALLOW_PROTOCOL: '',
  LC_ALL: 'C',
  LANG: 'C',
  LANGUAGE: 'C',
  GIT_SSH_COMMAND: DEFAULT_GIT_SSH_COMMAND,
};

describe('createGitEnvironment', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('removes every inherited Git variable and the askpass ones, keeping the rest', () => {
    const env = createGitEnvironment({
      baseEnv: {
        PATH: '/usr/bin',
        HOME: '/home/user',
        GIT_DIR: '/elsewhere/.git',
        GIT_WORK_TREE: '/elsewhere',
        GIT_CONFIG_PARAMETERS: "'core.askpass'='/bin/askpass'",
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'credential.helper',
        GIT_CONFIG_VALUE_0: 'store',
        GIT_ASKPASS: '/bin/askpass',
        GIT_TERMINAL_PROMPT: '1',
        SSH_ASKPASS: '/bin/ssh-askpass',
        SSH_ASKPASS_REQUIRE: 'force',
        GIT_ALLOW_PROTOCOL: 'file:ext',
        LC_ALL: 'de_DE.UTF-8',
        LANG: 'de_DE.UTF-8',
      },
    });

    expect(env).toStrictEqual({ PATH: '/usr/bin', HOME: '/home/user', ...NON_INTERACTIVE });
  });

  // Git for Windows reads /dev/null as its null device, but can't open Node.js's os.devNull there
  test('isolates the config and system attributes only when asked, with the null device as Git names it everywhere', () => {
    expect(createGitEnvironment({ baseEnv: {}, isolateConfig: true })).toStrictEqual({
      ...NON_INTERACTIVE,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_ATTR_NOSYSTEM: '1',
    });
    expect(createGitEnvironment({ baseEnv: {} })).toStrictEqual(NON_INTERACTIVE);
  });

  test('uses the SSH command it is given', () => {
    expect(createGitEnvironment({ baseEnv: {}, sshCommand: 'ssh -i /keys/deploy' })).toStrictEqual({
      ...NON_INTERACTIVE,
      GIT_SSH_COMMAND: 'ssh -i /keys/deploy',
    });
  });

  test('starts from the process environment by default', () => {
    vi.stubEnv('JG_GIT_TEST_VARIABLE', 'kept');
    vi.stubEnv('GIT_DIR', '/elsewhere/.git');

    const env = createGitEnvironment();

    expect(env['JG_GIT_TEST_VARIABLE']).toBe('kept');
    expect(env['GIT_DIR']).toBeUndefined();
    expect(env['GIT_ASKPASS']).toBe('');
  });
});
