// the message each verify-build failure starts with, which its integration tests match
export const VERIFY_BUILD_ERROR_MESSAGES = {
  BreadcrumbHierarchyIncomplete: 'Breadcrumb hierarchy is incomplete',
  BrokenInternalLink: 'Broken internal link',
  BrokenInternalLlmsTextLink: 'Broken internal llms.txt link',
  CanonicalOnNotFoundPage: 'The 404 page must not name a canonical URL',
  CanonicalUrlMissingFromSitemap: 'Canonical URL is missing from the sitemap',
  DuplicateElementId: 'Page repeats an element ID',
  ForbiddenPackageName: 'The build names a package the site never mentions',
  IncompleteLlmsFullText: 'llms-full.txt is missing a package or its recipes',
  IncompletePackageItemList: 'Home page item list does not list every package',
  InvalidLlmsTextStructure: 'llms.txt does not follow the required structure',
  InvalidStructuredData: 'Invalid structured data',
  InvalidStructuredDataGraph: 'Structured data graph is invalid',
  MissingBuildPath: 'Missing build path',
  MissingFragmentTarget: 'Fragment link has no matching element ID',
  MissingMarkdownVersion: 'Page has no Markdown version',
  MissingOrDuplicatePageDescription: 'Missing or duplicate page description',
  MissingOrDuplicatePageTitle: 'Missing or duplicate page title',
  MissingPackagePage: 'Missing package page',
  MissingRequiredMetadata: 'Missing required metadata',
  MissingSoftwareSourceCode: 'Package page is missing its source code entity',
  MissingStructuredData: 'Missing structured data',
  NonObjectStructuredData: 'Structured data is not an object',
  PageDescriptionOutOfRange: 'Page description is not 70 to 160 characters long',
  PageTitleTooLong: 'Page title is longer than 60 characters',
  ProductionBuildContainsTestFile: 'Production build contains a test file',
  RobotsTextMissingSitemap: 'robots.txt does not name the sitemap index',
  SearchIndexableNotFoundPage: 'The 404 page must stay out of search indexes',
  StructuredDataDoesNotMatchPage: 'Structured data does not match the canonical page',
  UnsafePageMarkup: 'Page holds an event handler or a URL with a disallowed scheme',
} as const;

// the files every build has, besides each listed package's pages and each page's Markdown
// version, which their own checks require
export const REQUIRED_BUILD_PATHS = [
  '404.html',
  'favicon.svg',
  'index.html',
  'llms-full.txt',
  'llms.txt',
  'robots.txt',
  'sitemap-index.xml',
] as const;

// the packages the jg packages replaced, which the site never names
export const OLD_PACKAGE_NAMES = [
  'api-response-utils',
  'bignumber-utils',
  'browser-cache-async',
  'browser-keyval-stores',
  'clipboard-service',
  'error-message-utils',
  'fetch-request-browser',
  'fetch-request-node',
  'fs-utils-async',
  'fs-utils-sync',
  'localkit',
  'node-process-utils',
  'sw-builder',
  'sw-service',
  'web-utils-kit',
] as const;

// the build files scanned for forbidden package names: everything but images and fonts
export const TEXT_FILE_EXTENSIONS: ReadonlySet<string> = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.svg',
  '.txt',
  '.xml',
]);
