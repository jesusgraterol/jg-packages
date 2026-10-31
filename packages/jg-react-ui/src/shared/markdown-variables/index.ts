// types
export type { IMarkdownVariableMatch } from './types.js';

// constants
export {
  MARKDOWN_VARIABLE_DATA_SLOT,
  MARKDOWN_VARIABLE_FALLBACK_NAME,
  MARKDOWN_VARIABLE_HIGHLIGHT_CLASS_NAMES,
  MARKDOWN_VARIABLE_PATTERN_SOURCE,
} from './constants.js';

// utilities
export {
  createEscapedMarkdownVariablePattern,
  createMarkdownVariablePattern,
  createMarkdownVariableToken,
  getEscapedMarkdownVariableMatches,
  getMarkdownVariableMatches,
  normalizeEscapedMarkdownVariableTokens,
  normalizeMarkdownVariableName,
  restoreMarkdownVariableText,
  restoreMarkdownVariableTokens,
} from './utilities.js';
