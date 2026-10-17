// types
export type {
  IApiEntryPoint,
  IApiMember,
  IApiParameter,
  IApiReference,
  IApiSignature,
  IApiSymbol,
  IApiSymbolKind,
  IUndocumentedSymbol,
} from './types.ts';

// extraction
export { extractApiReference } from './extract-api-reference.ts';

// documentation check
export { findUndocumentedSymbols } from './find-undocumented-symbols.ts';

// presentation, which the website and the Markdown renderer share
export {
  formatSignature,
  groupSymbols,
  KIND_GROUPS,
  MAX_SIGNATURE_LINE_LENGTH,
  parseExample,
  splitThrowsItem,
  toEntryPointAnchor,
  toImportSpecifier,
  toSymbolAnchor,
  type ISymbolGroup,
} from './presentation.ts';

// Markdown
export { renderApiMarkdown, type IRenderApiMarkdownOptions } from './render-api-markdown.ts';
export { API_MARKDOWN_FILE, writeApiMarkdown } from './api-markdown-file.ts';
