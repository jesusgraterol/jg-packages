import { GIT_NULL_DEVICE } from '../shared/index.js';

import { DEFAULT_GIT_SSH_COMMAND, NON_INTERACTIVE_VARIABLES } from './constants.js';
import type { IGitEnvironmentOptions } from './types.js';

/**
 * Builds the environment a git command runs in: the base environment without the variables that
 * change what Git does, every `GIT_*` one, such as `GIT_DIR` or `GIT_CONFIG_PARAMETERS`, and
 * `SSH_ASKPASS` with `SSH_ASKPASS_REQUIRE`, then the variables that keep it from prompting: `GIT_TERMINAL_PROMPT=0`, an empty
 * `GIT_ASKPASS`, which ends Git's askpass lookup before `core.askPass` and `SSH_ASKPASS`, and an
 * SSH command in batch mode. With `isolateConfig`, Git also ignores the system config and the
 * user's global config, which otherwise still apply.
 * @param options Whether to isolate the config, the SSH command, and the base environment.
 * @returns The environment.
 * @example
 * import { createGitEnvironment } from 'jg-git-commands';
 *
 * const env = createGitEnvironment({
 *   isolateConfig: true,
 *   baseEnv: { PATH: '/usr/bin', GIT_DIR: '/srv/other/.git' },
 * });
 * env['GIT_DIR']; // undefined
 * env['GIT_CONFIG_NOSYSTEM']; // '1'
 */
export const createGitEnvironment = ({
  isolateConfig = false,
  sshCommand = DEFAULT_GIT_SSH_COMMAND,
  baseEnv = process.env,
}: IGitEnvironmentOptions = {}): NodeJS.ProcessEnv => ({
  ...Object.fromEntries(
    Object.entries(baseEnv).filter(
      ([key]) => !key.startsWith('GIT_') && !key.startsWith('SSH_ASKPASS'),
    ),
  ),
  ...NON_INTERACTIVE_VARIABLES,
  GIT_SSH_COMMAND: sshCommand,
  ...(isolateConfig ? { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: GIT_NULL_DEVICE } : {}),
});
