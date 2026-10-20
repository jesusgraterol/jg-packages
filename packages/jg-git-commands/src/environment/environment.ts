import { GIT_NULL_DEVICE } from '../shared/index.js';

import { DEFAULT_GIT_SSH_COMMAND, NON_INTERACTIVE_VARIABLES } from './constants.js';
import type { IGitEnvironmentOptions } from './types.js';

// the variables the environment sets itself, which the base environment's spellings can't override
const SET_VARIABLES = new Set(Object.keys(NON_INTERACTIVE_VARIABLES));

/**
 * Checks whether a base environment variable is kept: any but the Git and askpass ones, and the
 * ones the environment sets, whatever their case.
 * @param key The variable's name.
 * @returns Whether it's kept.
 */
const isBaseVariableKept = (key: string): boolean => {
  const name = key.toUpperCase();
  return !name.startsWith('GIT_') && !name.startsWith('SSH_ASKPASS') && !SET_VARIABLES.has(name);
};

/**
 * Builds the environment a git command runs in: the base environment without the variables that
 * change what Git does, every `GIT_*` one, such as `GIT_DIR` or `GIT_CONFIG_PARAMETERS`, and
 * `SSH_ASKPASS` with `SSH_ASKPASS_REQUIRE`, then the variables that keep it from prompting:
 * `GIT_TERMINAL_PROMPT=0`, an empty `GIT_ASKPASS`, which ends Git's askpass lookup before
 * `core.askPass` and `SSH_ASKPASS`, and an SSH command in batch mode. It also allows no transport,
 * with an empty `GIT_ALLOW_PROTOCOL`, so reading a partial clone never fetches a missing object,
 * and sets the C locale, so Git's messages are in English. Names are compared without case, as
 * Windows does, so a `git_dir` or `Lc_All` from the base environment can't stand in for the
 * variables it removes or sets. With `isolateConfig`, Git also ignores the system config, the
 * user's global config, and the system attributes file, which otherwise still apply.
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
 * env['GIT_ALLOW_PROTOCOL']; // ''
 */
export const createGitEnvironment = ({
  isolateConfig = false,
  sshCommand = DEFAULT_GIT_SSH_COMMAND,
  baseEnv = process.env,
}: IGitEnvironmentOptions = {}): NodeJS.ProcessEnv => ({
  ...Object.fromEntries(Object.entries(baseEnv).filter(([key]) => isBaseVariableKept(key))),
  ...NON_INTERACTIVE_VARIABLES,
  GIT_SSH_COMMAND: sshCommand,
  ...(isolateConfig
    ? { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: GIT_NULL_DEVICE, GIT_ATTR_NOSYSTEM: '1' }
    : {}),
});
