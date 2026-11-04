// a separator a long path or identifier may wrap after
const SEPARATOR_PATTERN = /(?<=[/\\_.-])/u;

/**
 * Splits a path or identifier after each separator, `/`, `\`, `_`, `.` and `-`, where it may
 * wrap.
 * @param path The path.
 * @returns The pieces, each ending at a separator but the last.
 */
export const splitAtSeparators = (path: string): string[] => path.split(SEPARATOR_PATTERN);
