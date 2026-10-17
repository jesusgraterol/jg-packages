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
