import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Tells whether the module is the script Node.js was started with, such as a CLI file that should
 * run its command only when executed, not when a test imports it. It compares real paths, so a
 * script started through a symbolic link, such as an npm bin entry, still counts.
 * @param importMetaUrl The module's `import.meta.url`.
 * @returns Whether the module is the entry script, or false when either path can't be resolved.
 * @example
 * import { isMainModule } from 'jg-process';
 *
 * if (isMainModule(import.meta.url)) {
 *   // run the command
 * }
 */
export const isMainModule = (importMetaUrl: string): boolean => {
  const entry = process.argv[1];
  if (entry === undefined || entry === '') {
    return false;
  }
  try {
    return realpathSync.native(entry) === realpathSync.native(fileURLToPath(importMetaUrl));
  } catch {
    return false;
  }
};
