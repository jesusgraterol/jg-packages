// the seconds a git command may run when the options don't say
export const DEFAULT_GIT_TIMEOUT_SECONDS = 30;

// the bytes a git command's output may take when the options don't say (1 MiB)
export const DEFAULT_GIT_MAX_OUTPUT_BYTES = 1_048_576;

/*
 * The config every git command runs with, whatever any config file says: no file system monitor,
 * which a repository's config can point at a program, no askpass program, no pager, no colors in
 * the output, and no recursing into submodules.
 */
export const FIXED_CONFIG_ARGS = [
  '-c',
  'core.fsmonitor=',
  '-c',
  'core.askPass=',
  '-c',
  'core.pager=cat',
  '-c',
  'color.ui=false',
  '-c',
  'submodule.recurse=false',
];

// the config that empties the credential helper list, the repository's included
export const NO_CREDENTIAL_HELPERS_ARGS = ['-c', 'credential.helper='];

// the Windows path length past which a working directory may fail to start a process
export const WINDOWS_MAX_PATH = 260;

// stderr that says the directory isn't in a repository, under the C locale
export const REPOSITORY_NOT_FOUND_PATTERN = /^fatal: not a git repository/mu;

// stderr that says Git refused the repository, for its ownership or a file's permissions
export const ACCESS_DENIED_PATTERN =
  /^fatal: (?:detected dubious ownership in repository at |.*: Permission denied\r?$)/mu;
