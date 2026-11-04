// error codes
export { ERRORS } from './shared/index.js';

// environments
export {
  DEFAULT_GIT_SSH_COMMAND,
  type IGitEnvironmentOptions,
  createGitEnvironment,
} from './environment/index.js';

// git commands
export {
  DEFAULT_GIT_MAX_OUTPUT_BYTES,
  DEFAULT_GIT_TIMEOUT_SECONDS,
  type IRunGitOptions,
  assertGitSucceeded,
  runGit,
} from './run-git/index.js';

// typed commands
export {
  type IFetchCommitOptions,
  type IGitCommandOptions,
  type IGitStatus,
  type IGitVersion,
  type IIndexEntry,
  type IListPathsOptions,
  type IReadChangedPathsOptions,
  type IReadFileAtRevisionOptions,
  type IStatusEntry,
  fetchCommit,
  getRemoteUrl,
  isAncestor,
  isWorkingTreeClean,
  listUntrackedFiles,
  readChangedPaths,
  readCommonDirectory,
  readConfigBoolean,
  readFileAtRevision,
  readGitVersion,
  readIndexEntries,
  readRemoteDefaultBranch,
  readRemoteRefs,
  readStatus,
  readTopLevel,
  resolveCommit,
} from './commands/index.js';

// remote URLs
export { type IRemoteRepository, parseRemoteRepository } from './remote/index.js';

// blob object IDs
export {
  type ICalculateGitBlobObjectIdOptions,
  type IGitObjectFormat,
  calculateGitBlobObjectId,
} from './blob-id/index.js';
