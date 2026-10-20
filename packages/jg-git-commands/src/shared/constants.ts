/*
 * The null device as Git names it: Git for Windows reads `/dev/null` as `NUL`, but not Node.js's
 * `os.devNull`, `\\.\nul`, which it can't open, so a config or hooks path set to it would make
 * every git command fail there.
 */
export const GIT_NULL_DEVICE = '/dev/null';
