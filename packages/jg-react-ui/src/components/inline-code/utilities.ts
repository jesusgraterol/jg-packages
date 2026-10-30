// a break may follow a separator only between two non-separator characters,
// and never directly before a final file extension, so `cache.ts` stays whole
const BREAK_AFTER_SEPARATOR = /(?<=[^/_.-][/_.-])(?=[^/_.-])(?!(?<=\.)[^/_.-]+$)/u;

/**
 * Splits inline code after path and identifier separators so it can wrap without breaking words.
 * @param value The inline code text.
 * @returns The text segments, each ending at a permitted break.
 * @example
 * splitCodeSegments('/src/answer-cache.ts'); // ['/src/', 'answer-', 'cache.ts']
 */
export const splitCodeSegments = (value: string): string[] => value.split(BREAK_AFTER_SEPARATOR);

/**
 * Formats a root-relative repository path for display by removing one leading slash.
 * Copied values and native output keep the exact path.
 * @param path The repository path, such as `/workspace/project.md`.
 * @returns The display path, such as `workspace/project.md`.
 * @example
 * import { formatRepositoryPath } from 'jg-react-ui/components/inline-code';
 * const path = formatRepositoryPath('/workspace/project.md');
 */
export const formatRepositoryPath = (path: string): string =>
  path.startsWith('/') ? path.slice(1) : path;
