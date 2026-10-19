// the seconds a git command may run when the options don't say
export const DEFAULT_GIT_TIMEOUT_SECONDS = 30;

// the bytes a git command's output may take when the options don't say (1 MiB)
export const DEFAULT_GIT_MAX_OUTPUT_BYTES = 1_048_576;

/*
 * The config every git command runs with, whatever any config file says: no file system monitor,
 * which a repository's config can point at a program, no askpass program, and no pager.
 */
export const FIXED_CONFIG_ARGS = [
  '-c',
  'core.fsmonitor=',
  '-c',
  'core.askPass=',
  '-c',
  'core.pager=cat',
];

// the config that empties the credential helper list, the repository's included
export const NO_CREDENTIAL_HELPERS_ARGS = ['-c', 'credential.helper='];
