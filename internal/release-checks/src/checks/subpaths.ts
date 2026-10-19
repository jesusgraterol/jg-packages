/**
 * Lists a manifest's `exports` subpaths with their targets, or none when it has no subpath map.
 * @param exportsMap The packed manifest's `exports`.
 * @returns Each subpath, such as `.`, with its target.
 */
const listSubpaths = (exportsMap: unknown): [string, unknown][] =>
  typeof exportsMap === 'object' && exportsMap !== null
    ? Object.entries(exportsMap as Record<string, unknown>)
    : [];

/**
 * Checks whether a subpath's default target is JavaScript: the target itself when it's a path,
 * otherwise its `default` condition.
 * @param target The subpath's `exports` value.
 * @returns Whether it ends in `.js` or `.mjs`.
 */
const hasJavaScriptDefault = (target: unknown): boolean => {
  const defaultTarget =
    typeof target === 'object' && target !== null
      ? (target as { default?: unknown }).default
      : target;
  return typeof defaultTarget === 'string' && /\.m?js$/.test(defaultTarget);
};

/**
 * Lists the `exports` subpaths a Node.js consumer can import: those whose default target is
 * JavaScript, leaving out stylesheets and source-only targets such as Astro components.
 * @param exportsMap The packed manifest's `exports`.
 * @returns The importable subpaths, such as `.` and `./sync`.
 */
export const getImportableSubpaths = (exportsMap: unknown): string[] =>
  listSubpaths(exportsMap)
    .filter(([, target]) => hasJavaScriptDefault(target))
    .map(([subpath]) => subpath);

/**
 * Lists the `exports` subpaths whose default target isn't JavaScript, such as stylesheets: every
 * subpath getImportableSubpaths leaves out.
 * @param exportsMap The packed manifest's `exports`.
 * @returns The subpaths, such as `./styles.css`.
 */
export const getNonJavaScriptSubpaths = (exportsMap: unknown): string[] =>
  listSubpaths(exportsMap)
    .filter(([, target]) => !hasJavaScriptDefault(target))
    .map(([subpath]) => subpath);
