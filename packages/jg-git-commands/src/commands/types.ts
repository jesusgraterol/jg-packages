import type { IRunGitOptions } from '../run-git/index.js';

// what every command helper takes besides its own arguments: runGit's options, but the working
// directory and stdin
export type IGitCommandOptions = Omit<IRunGitOptions, 'cwd' | 'input'>;

// what readFileAtRevision takes
export type IReadFileAtRevisionOptions = Omit<IGitCommandOptions, 'maxOutputBytes'> & {
  // the bytes the file may take. Defaults to 1 MiB
  maxBytes?: number | undefined;
};

// what fetchCommit takes
export type IFetchCommitOptions = IGitCommandOptions & {
  // the commits of history fetched, the pinned one included. Defaults to 1
  depth?: number | undefined;
};

// what readChangedPaths takes
export type IReadChangedPathsOptions = IGitCommandOptions & {
  // the revision the changes end at. Defaults to the working tree
  to?: string | undefined;
};

// what readIndexEntries and listUntrackedFiles take
export type IListPathsOptions = IGitCommandOptions & {
  // the paths to limit the list to, from the repository's root, read literally. Defaults to all
  paths?: readonly string[] | undefined;
};

/*
 * A path `git status` reports, with its two status letters: `M` modified, `T` type changed, `A`
 * added, `D` deleted, `R` renamed, `C` copied, `U` unmerged, `?` untracked, and a space for
 * unchanged. An unmerged path keeps the letters Git gives its conflict, such as `UU` or `AA`.
 */
export type IStatusEntry = {
  // the status in the index, against HEAD
  index: string;

  // the status in the working tree, against the index
  workingTree: string;

  // the path from the repository's root
  path: string;

  // the path before a rename or a copy, or null
  originalPath: string | null;
};

// the working tree's status: the commit HEAD points at, or null before the first commit, and the
// changed and untracked paths
export type IGitStatus = {
  commit: string | null;
  entries: IStatusEntry[];
};

// one entry of the index: its file mode, such as `100644`, its merge stage, 0 unless it's in a
// conflict, and its path from the repository's root
export type IIndexEntry = {
  mode: string;
  stage: 0 | 1 | 2 | 3;
  path: string;
};

// a Git version, such as 2.45.1
export type IGitVersion = {
  major: number;
  minor: number;
  patch: number;
};
