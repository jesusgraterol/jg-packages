// one tarball in a release, in the order it must be published
export type IReleaseManifestEntry = {
  name: string;
  version: string;
  // the tarball's file name inside the release directory
  file: string;
  sha256: string;
};

// a version the publish command put on npm during its run
export type IPublishedEntry = {
  name: string;
  version: string;
};

// what a finished command printed and how it exited
export type ICommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

// runs one executable with its arguments, without a shell
export type IRunCommand = (
  executable: string,
  args: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv },
) => Promise<ICommandResult>;

// the package manifest fields the release commands read
export type IPackageManifest = {
  name: string;
  version: string;
  private?: boolean;
  files?: string[];
  exports?: unknown;
  bin?: string | Record<string, string>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
};
