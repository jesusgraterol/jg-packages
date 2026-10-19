// what createGitEnvironment takes
export type IGitEnvironmentOptions = {
  // whether Git ignores the system config and the user's global config, such as for a repository
  // or a URL the caller doesn't trust. Defaults to false
  isolateConfig?: boolean | undefined;

  // the SSH command Git runs for ssh:// remotes. Defaults to DEFAULT_GIT_SSH_COMMAND
  sshCommand?: string | undefined;

  // the environment to start from, without its Git variables. Defaults to process.env
  baseEnv?: NodeJS.ProcessEnv | undefined;
};
