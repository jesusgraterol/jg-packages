// search metadata and structured data
export {
  type IListedPage,
  type IStructuredDataOptions,
  type IStructuredDataSite,
  type IStructuredDataSourceCode,
  SEARCH_TEXT_LIMITS,
  buildBreadcrumbStructuredData,
  buildStructuredData,
  serializeStructuredData,
} from './seo/index.js';

// llms.txt and llms-full.txt
export {
  type ILlmsFullTextOptions,
  type ILlmsTextLink,
  type ILlmsTextOptions,
  type ILlmsTextSection,
  buildLlmsFullText,
  buildLlmsText,
  escapeMarkdownLabel,
  normalizeDescription,
} from './llms-text/index.js';

// theme preferences
export {
  type IResolvedTheme,
  type IThemePreference,
  type IThemeStorage,
  THEME_PREFERENCES,
  parseThemePreference,
  readThemePreference,
  resolveThemePreference,
  writeThemePreference,
} from './theme/index.js';
