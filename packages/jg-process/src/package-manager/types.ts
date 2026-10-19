// the package managers resolvePackageManagerCommand finds
export type IPackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun';

// the options resolvePackageManagerCommand takes
export type IResolvePackageManagerOptions = {
  /*
   * The package manager to run. Defaults to the one running the current package script, which
   * npm_execpath names; without one, a package manager has to be named.
   */
  packageManager?: IPackageManager | undefined;

  // the environment that holds npm_execpath and PATH. Defaults to process.env
  env?: NodeJS.ProcessEnv | undefined;

  // the directory a local install is resolved from. Defaults to the current one
  cwd?: string | undefined;
};

// a command to spawn without a shell, which runProcess and startProcess take as they are
export type IPackageManagerCommand = {
  command: string;
  args: string[];
};
