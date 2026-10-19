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
  runGit,
} from './run-git/index.js';

// typed commands
export {
  type IFetchCommitOptions,
  type IGitCommandOptions,
  type IReadFileAtRevisionOptions,
  type IStatusEntry,
  fetchCommit,
  getRemoteUrl,
  isWorkingTreeClean,
  readFileAtRevision,
  readRemoteRefs,
  readStatus,
  resolveCommit,
} from './commands/index.js';

// blob object IDs
export {
  type ICalculateGitBlobObjectIdOptions,
  type IGitObjectFormat,
  calculateGitBlobObjectId,
} from './blob-id/index.js';
