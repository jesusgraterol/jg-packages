import type { IPackageManifest } from '../shared/types.ts';
import type { IWorkspacePackage } from '../workspace/workspace.ts';

// a workspace package after `pnpm pack`, with the files its tarball holds
export type IPackedPackage = {
  workspacePackage: IWorkspacePackage;
  tarballPath: string;
  sha256: string;
  // the tarball's files by path, without the leading `package/`
  files: Map<string, Buffer>;
  // the manifest as it ships, with workspace and catalog ranges replaced
  packedManifest: IPackageManifest;
};

// the registry facts check 7 needs about one package
export type IRegistryPackage = {
  versions: string[];
  distTags: Record<string, string>;
};

// read access to the npm registry, injected so checks run offline in tests
export type IRegistry = {
  // resolves to `undefined` when the package isn't on npm
  getPackage: (name: string) => Promise<IRegistryPackage | undefined>;
  /**
   * Downloads the gzipped tarball for a published version.
   * @returns The compressed package bytes.
   * @throws
   * - NON_EXISTENT_FILE: The file '<path>' does not exist.
   * - NOT_A_FILE: The file '<path>' is a symbolic link.
   * - NOT_A_FILE: The path '<path>' is not a file.
   * - FILE_TOO_LARGE: The file '<path>' is larger than <maxBytes> bytes.
   */
  downloadTarball: (name: string, version: string) => Promise<Buffer>;
};
