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

/*
 * A path `git status` reports, with its two status letters from the porcelain v1 format: `M`
 * modified, `T` type changed, `A` added, `D` deleted, `R` renamed, `C` copied, `U` unmerged, `?`
 * untracked, and a space for unchanged.
 */
export type IStatusEntry = {
  // the status in the index, against HEAD
  index: string;

  // the status in the working tree, against the index
  workingTree: string;

  // the path from the repository's root; an untracked directory's ends with a `/`
  path: string;

  // the path before a rename or a copy, or null
  originalPath: string | null;
};
