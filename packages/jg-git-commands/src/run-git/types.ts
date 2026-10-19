// what runGit takes
export type IRunGitOptions = {
  // the directory git runs in, such as the repository's working tree
  cwd: string;

  // the seconds the command may run before it's stopped. Defaults to 30
  timeoutSeconds?: number | undefined;

  // the bytes stdout and stderr may hold together. Defaults to 1 MiB
  maxOutputBytes?: number | undefined;

  // the data written to git's stdin
  input?: string | Uint8Array | undefined;

  // stops the command when it aborts
  signal?: AbortSignal | undefined;

  // whether Git ignores the system config and the user's global config. Defaults to false
  isolateConfig?: boolean | undefined;

  // whether the configured credential helpers run, such as for authenticated HTTPS; they still
  // can't use an askpass program or the terminal. Defaults to false, which empties their list
  useCredentialHelpers?: boolean | undefined;

  // more variables, such as GIT_SSL_CAINFO, set after the inherited Git variables are removed; an
  // undefined value unsets one. GIT_ASKPASS, GIT_TERMINAL_PROMPT, SSH_ASKPASS, and
  // SSH_ASKPASS_REQUIRE are ignored, so nothing the caller passes lets a prompt through
  env?: NodeJS.ProcessEnv | undefined;
};
