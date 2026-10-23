import type { IFileTreeEntry } from '../../contracts/index.ts';

import { MAX_FILE_TREE_DEPTH, MAX_FILE_TREE_ENTRIES } from './constants.ts';
import type { IFileTreePreview } from './types.ts';

/**
 * Builds an acyclic file preview without traversing omitted entries or counting a total.
 * Root entries occupy level one. An ancestor cycle renders its supplied directory name once
 * at that position, then omits its children. Shared references in separate branches remain valid.
 * @param entries Dense, caller-owned file and directory arrays.
 * @returns A preview within the fixed entry/depth budgets, plus whether anything was omitted.
 */
export const buildFileTreePreview = (entries: readonly IFileTreeEntry[]): IFileTreePreview => {
  let visited = 0;
  let isPartial = false;
  const ancestors = new Set<IFileTreeEntry>();

  /** Copies only the supported entries while sharing the total visit budget across branches. */
  const visit = (source: readonly IFileTreeEntry[], level: number): IFileTreeEntry[] => {
    const result: IFileTreeEntry[] = [];
    for (let index = 0; index < source.length; index++) {
      if (visited === MAX_FILE_TREE_ENTRIES) {
        isPartial = true;
        break;
      }
      // the index is inside a dense input array; never read the next entry after the budget
      const entry = source[index] as IFileTreeEntry;
      visited++;
      const common = { name: entry.name, href: entry.href, status: entry.status };
      if (entry.kind === 'file') {
        result.push({ ...common, kind: 'file' });
        continue;
      }
      const children: IFileTreeEntry[] = [];
      result.push({ ...common, kind: 'directory', children });
      if (ancestors.has(entry)) {
        isPartial = true;
        continue;
      }
      if (level === MAX_FILE_TREE_DEPTH) {
        if (entry.children.length > 0) isPartial = true;
        continue;
      }
      ancestors.add(entry);
      children.push(...visit(entry.children, level + 1));
      ancestors.delete(entry);
    }
    return result;
  };

  const previewEntries = visit(entries, 1);
  return { entries: previewEntries, isPartial };
};
