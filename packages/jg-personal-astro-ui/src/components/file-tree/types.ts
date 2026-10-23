import type { IFileTreeEntry } from '../../contracts/index.ts';

// a bounded, acyclic render model with an honest omission indicator
export interface IFileTreePreview {
  entries: IFileTreeEntry[];
  isPartial: boolean;
}
