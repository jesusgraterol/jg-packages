import { access, readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { SEARCH_TEXT_LIMITS } from 'jg-site';
import { verifyStaticSite } from 'jg-site-checks';

import { PACKAGE_CATALOG, SITE_CONFIG } from '../../site.config.ts';
import { toMarkdownPath } from '../markdown-pages/index.ts';
import { UNLISTED_PACKAGES } from '../package-catalog/index.ts';
import { decodeHtmlEntities, findUnsafeAttributes } from '../rendered-html/index.ts';
import {
  OLD_PACKAGE_NAMES,
  REQUIRED_BUILD_PATHS,
  TEXT_FILE_EXTENSIONS,
  VERIFY_BUILD_ERROR_MESSAGES as MESSAGES,
} from './constants.ts';

/*
 * The checks every build of the site must pass, run after `astro build`. They port jg-skills'
 * generic checks and add the site's own. Each failure throws an Error whose message starts with
 * one of VERIFY_BUILD_ERROR_MESSAGES.
 */

// the directory `astro build` writes
const DEFAULT_BUILD_DIRECTORY = resolve(import.meta.dirname, '..', '..', '..', 'dist');
const PRIVATE_BUILD_DIRECTORIES = new Set(['_archive', '_archives', '_backup', '_backups']);

/**
 * Checks whether a description fits search results.
 * @param description The description, as written in the page.
 * @returns Whether it's 70 to 160 characters once decoded.
 */
const isDescriptionInRange = (description: string): boolean => {
  const { length } = decodeHtmlEntities(description);
  return (
    length >= SEARCH_TEXT_LIMITS.descriptionMinLength &&
    length <= SEARCH_TEXT_LIMITS.descriptionMaxLength
  );
};

/**
 * Escapes text for use inside a regular expression.
 * @param input The literal text.
 * @returns The escaped pattern.
 */
const escapeRegularExpression = (input: string): string =>
  input.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/**
 * Checks whether a JSON value is an object.
 * @param input The value.
 * @returns Whether it's a non-array object.
 */
const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === 'object' && input !== null && !Array.isArray(input);

/**
 * Checks whether a JSON value is an array of objects.
 * @param input The value.
 * @returns Whether it is.
 */
const isRecordArray = (input: unknown): input is Record<string, unknown>[] =>
  Array.isArray(input) && input.every(isRecord);

/**
 * Lists every file under a directory, as sorted POSIX paths relative to the build.
 * @param directory The directory.
 * @param root The build directory the paths are relative to.
 * @returns A promise that resolves to the paths.
 */
const listBuildFiles = async (directory: string, root = directory): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() && !PRIVATE_BUILD_DIRECTORIES.has(entry.name)
        ? listBuildFiles(path, root)
        : [relative(root, path).split('\\').join('/')];
    }),
  );
  return files.flat().toSorted();
};

/**
 * Gives the site-relative path of the page a build file serves.
 * @param htmlPath The page's file, such as `packages/jg-fs/index.html`.
 * @returns The path, such as `/packages/jg-fs/`.
 */
const toPagePath = (htmlPath: string): string =>
  htmlPath === 'index.html' ? '/' : `/${htmlPath.slice(0, -'index.html'.length)}`;

/**
 * Lists the element IDs a page declares, in document order.
 * @param html The page.
 * @returns The IDs.
 */
const listElementIds = (html: string): string[] =>
  [...html.matchAll(/\sid="([^"]+)"/gu)].map((match) => match[1] ?? '');

/**
 * Reads a page's single JSON-LD object.
 * @param html The page.
 * @param htmlPath The page's file, for the message.
 * @returns The object.
 * @throws
 * - Missing structured data in {htmlPath}
 * - Invalid structured data in {htmlPath}
 * - Structured data is not an object in {htmlPath}
 */
const parseStructuredData = (html: string, htmlPath: string): Record<string, unknown> => {
  const serialized = /<script type="application\/ld\+json">([^<]+)<\/script>/u.exec(html)?.[1];
  if (serialized === undefined) {
    throw new Error(`${MESSAGES.MissingStructuredData} in ${htmlPath}`);
  }
  let structuredData: unknown;
  try {
    structuredData = JSON.parse(serialized);
  } catch (error) {
    throw new Error(`${MESSAGES.InvalidStructuredData} in ${htmlPath}`, { cause: error });
  }
  if (!isRecord(structuredData)) {
    throw new Error(`${MESSAGES.NonObjectStructuredData} in ${htmlPath}`);
  }
  return structuredData;
};

/**
 * Lists the entities of a JSON-LD object: itself, or the members of its graph.
 * @param structuredData The object.
 * @param htmlPath The page's file, for the message.
 * @returns The entities.
 * @throws
 * - Structured data graph is invalid in {htmlPath}
 */
const listStructuredDataEntities = (
  structuredData: Record<string, unknown>,
  htmlPath: string,
): Record<string, unknown>[] => {
  const graph = structuredData['@graph'];
  if (graph === undefined) {
    return [structuredData];
  }
  if (!isRecordArray(graph)) {
    throw new Error(`${MESSAGES.InvalidStructuredDataGraph} in ${htmlPath}`);
  }
  return graph;
};

/**
 * Checks a page's head: the metadata every public page carries and a unique title and description
 * that fit search results.
 * @param html The page.
 * @param htmlPath The page's file.
 * @param seen The titles and descriptions of the pages checked before this one.
 * @throws
 * - Missing required metadata in {htmlPath}: {pattern}
 * - Missing or duplicate page description in {htmlPath}
 * - Missing or duplicate page title in {htmlPath}
 * - Page title is longer than 60 characters in {htmlPath}
 * - Page description is not 70 to 160 characters long in {htmlPath}
 */
const checkPageHead = (
  html: string,
  htmlPath: string,
  seen: { descriptions: Set<string>; titles: Set<string> },
): void => {
  const pagePath = toPagePath(htmlPath);
  const canonicalUrl = new URL(pagePath, SITE_CONFIG.url).toString();
  const markdownUrl = new URL(toMarkdownPath(pagePath), SITE_CONFIG.url).toString();
  const llmsTextUrl = new URL('/llms.txt', SITE_CONFIG.url).toString();
  const imageUrl = new URL(SITE_CONFIG.openGraph.image, SITE_CONFIG.url).toString();
  const literal = (text: string): string => escapeRegularExpression(text);
  const requiredPatterns = [
    new RegExp(`<html lang="${literal(SITE_CONFIG.language)}"`, 'u'),
    /<title>[^<]+<\/title>/u,
    /<meta name="description" content="[^"]+"/u,
    new RegExp(`<meta name="author" content="${literal(SITE_CONFIG.author.name)}"`, 'u'),
    /<meta name="robots" content="index, follow, max-image-preview:large"/u,
    new RegExp(`<link rel="describedby" href="${literal(llmsTextUrl)}"`, 'u'),
    new RegExp(`<link rel="alternate" type="text/markdown" href="${literal(markdownUrl)}"`, 'u'),
    new RegExp(
      `<meta property="og:locale" content="${literal(SITE_CONFIG.openGraph.locale)}"`,
      'u',
    ),
    /<meta property="og:type" content="website"/u,
    /<meta property="og:title" content="[^"]+"/u,
    /<meta property="og:description" content="[^"]+"/u,
    new RegExp(`<meta property="og:url" content="${literal(canonicalUrl)}"`, 'u'),
    new RegExp(`<meta property="og:image" content="${literal(imageUrl)}"`, 'u'),
    new RegExp(
      `<meta property="og:image:type" content="${literal(SITE_CONFIG.openGraph.imageType)}"`,
      'u',
    ),
    /<meta property="og:image:alt" content="[^"]+"/u,
    /<meta name="twitter:card" content="summary_large_image"/u,
    new RegExp(
      `<meta name="twitter:creator" content="${literal(SITE_CONFIG.author.twitterHandle)}"`,
      'u',
    ),
    new RegExp(`<meta name="twitter:image" content="${literal(imageUrl)}"`, 'u'),
  ];
  for (const pattern of requiredPatterns) {
    if (!pattern.test(html)) {
      throw new Error(`${MESSAGES.MissingRequiredMetadata} in ${htmlPath}: ${pattern.source}`);
    }
  }
  const description = /<meta name="description" content="([^"]+)"/u.exec(html)?.[1];
  const title = /<title>([^<]+)<\/title>/u.exec(html)?.[1];
  if (description === undefined || seen.descriptions.has(description)) {
    throw new Error(`${MESSAGES.MissingOrDuplicatePageDescription} in ${htmlPath}`);
  }
  if (title === undefined || seen.titles.has(title)) {
    throw new Error(`${MESSAGES.MissingOrDuplicatePageTitle} in ${htmlPath}`);
  }
  seen.descriptions.add(description);
  seen.titles.add(title);
  if (decodeHtmlEntities(title).length > SEARCH_TEXT_LIMITS.titleMaxLength) {
    throw new Error(`${MESSAGES.PageTitleTooLong} in ${htmlPath}`);
  }
  if (!isDescriptionInRange(description)) {
    throw new Error(`${MESSAGES.PageDescriptionOutOfRange} in ${htmlPath}`);
  }
};

/**
 * Checks a page's JSON-LD against the page: the WebSite listing every package on the home page,
 * and elsewhere a WebPage with its breadcrumb, plus the source code on a package page.
 * @param html The page.
 * @param htmlPath The page's file.
 * @param packageNames The listed packages.
 * @throws
 * - the parse failures of parseStructuredData and listStructuredDataEntities
 * - Structured data does not match the canonical page in {htmlPath}
 * - Home page item list does not list every package
 * - Breadcrumb hierarchy is incomplete in {htmlPath}
 * - Package page is missing its source code entity in {htmlPath}
 */
const checkStructuredData = (
  html: string,
  htmlPath: string,
  packageNames: readonly string[],
): void => {
  const canonicalUrl = new URL(toPagePath(htmlPath), SITE_CONFIG.url).toString();
  const entities = listStructuredDataEntities(parseStructuredData(html, htmlPath), htmlPath);
  const isHome = htmlPath === 'index.html';
  const page = entities.find((entity) => entity['@type'] === (isHome ? 'WebSite' : 'WebPage'));
  if (page?.['url'] !== canonicalUrl || typeof page['description'] !== 'string') {
    throw new Error(`${MESSAGES.StructuredDataDoesNotMatchPage} in ${htmlPath}`);
  }
  if (isHome) {
    const items = entities.find((entity) => entity['@type'] === 'ItemList')?.['itemListElement'];
    const listedUrls = isRecordArray(items)
      ? items
          .filter(
            (item, index) =>
              item['@type'] === 'ListItem' &&
              item['position'] === index + 1 &&
              typeof item['name'] === 'string',
          )
          .map((item) => item['url'])
      : [];
    const packageUrls = packageNames.map((name) =>
      new URL(`/packages/${name}/`, SITE_CONFIG.url).toString(),
    );
    if (
      listedUrls.length !== packageUrls.length ||
      !packageUrls.every((url) => listedUrls.includes(url))
    ) {
      throw new Error(MESSAGES.IncompletePackageItemList);
    }
    return;
  }
  const breadcrumbs = entities.find((entity) => entity['@type'] === 'BreadcrumbList')?.[
    'itemListElement'
  ];
  if (
    !isRecordArray(breadcrumbs) ||
    breadcrumbs.length < 2 ||
    !breadcrumbs.every(
      (item, index) =>
        item['@type'] === 'ListItem' &&
        typeof item['item'] === 'string' &&
        typeof item['name'] === 'string' &&
        item['position'] === index + 1,
    ) ||
    breadcrumbs.at(-1)?.['item'] !== canonicalUrl ||
    !html.includes('<nav aria-label="Breadcrumb"')
  ) {
    throw new Error(`${MESSAGES.BreadcrumbHierarchyIncomplete} in ${htmlPath}`);
  }
  const isPackagePage = /^packages\/[^/]+\/index\.html$/u.test(htmlPath);
  if (
    isPackagePage &&
    !entities.some(
      (entity) => entity['@type'] === 'SoftwareSourceCode' && entity['url'] === canonicalUrl,
    )
  ) {
    throw new Error(`${MESSAGES.MissingSoftwareSourceCode} in ${htmlPath}`);
  }
};

/**
 * Checks that Pagefind indexed every public page, which it does only for pages whose main content
 * carries data-pagefind-body, so the 404 page stays out.
 * @param buildDirectory The build.
 * @param publicPageCount The number of HTML pages besides the 404 page.
 * @returns A promise that resolves once the index holds them all.
 * @throws
 * - The search index does not hold every public page: pagefind-entry.json isn't JSON
 * - The search index does not hold every public page: {count} of {total}
 */
const checkSearchIndex = async (buildDirectory: string, publicPageCount: number): Promise<void> => {
  const serialized = await readFile(
    resolve(buildDirectory, 'pagefind/pagefind-entry.json'),
    'utf8',
  );
  let entry: unknown;
  try {
    entry = JSON.parse(serialized);
  } catch (error) {
    throw new Error(`${MESSAGES.IncompleteSearchIndex}: pagefind-entry.json isn't JSON`, {
      cause: error,
    });
  }
  const languages = isRecord(entry) && isRecord(entry['languages']) ? entry['languages'] : {};
  const indexedPageCount = Object.values(languages).reduce<number>(
    (total, language) =>
      total +
      (isRecord(language) && typeof language['page_count'] === 'number'
        ? language['page_count']
        : 0),
    0,
  );
  if (indexedPageCount !== publicPageCount) {
    throw new Error(
      `${MESSAGES.IncompleteSearchIndex}: ${String(indexedPageCount)} of ${String(publicPageCount)}`,
    );
  }
};

/**
 * Checks the catalogue and agent setup structure in the two llms files.
 * @param buildDirectory The build.
 * @param packageNames The listed packages.
 * @returns A promise that resolves once they pass.
 * @throws
 * - llms.txt does not follow the required structure
 * - llms-full.txt is missing a package or its recipes: {name}
 */
const checkAgentFiles = async (
  buildDirectory: string,
  packageNames: readonly string[],
): Promise<void> => {
  const read = (path: string): Promise<string> => readFile(resolve(buildDirectory, path), 'utf8');
  const llmsText = await read('llms.txt');
  const markdownUrl = (path: string): string =>
    new URL(toMarkdownPath(path), SITE_CONFIG.url).toString();
  const { policyUrl, skillUrl } = SITE_CONFIG.agentSetup;
  if (
    !llmsText.startsWith(`# ${SITE_CONFIG.name}\n\n> `) ||
    !llmsText.includes('\n## Agent setup\n') ||
    !llmsText.includes(`](${policyUrl})`) ||
    !llmsText.includes(`](${skillUrl})`) ||
    !llmsText.includes('\n## Packages\n') ||
    !llmsText.includes('\n## Recipes\n') ||
    !packageNames.every(
      (name) =>
        llmsText.includes(`](${markdownUrl(`/packages/${name}/`)})`) &&
        llmsText.includes(`](${markdownUrl(`/packages/${name}/recipes/`)})`),
    )
  ) {
    throw new Error(MESSAGES.InvalidLlmsTextStructure);
  }
  const llmsFullText = await read('llms-full.txt');
  const missing = packageNames.find(
    (name) =>
      !llmsFullText.includes(`\n# ${name}\n`) || !llmsFullText.includes(`\n# ${name} recipes\n`),
  );
  if (missing !== undefined) {
    throw new Error(`${MESSAGES.IncompleteLlmsFullText}: ${missing}`);
  }
};

/**
 * Checks that no text file of the build names a package the site never mentions: one the jg
 * packages replaced, or one kept off the site, such as the UI package it's built with.
 * @param buildDirectory The build.
 * @param buildFiles Every file in the build.
 * @returns A promise that resolves once none does.
 * @throws
 * - The build names a package the site never mentions in {file}: {name}
 */
const checkForbiddenNames = async (
  buildDirectory: string,
  buildFiles: readonly string[],
): Promise<void> => {
  const names = [...OLD_PACKAGE_NAMES, ...UNLISTED_PACKAGES];
  // a name on its own, not part of a longer one such as my-sw-builder-plugin
  const pattern = new RegExp(
    `(?<![\\w-])(${names.map((name) => escapeRegularExpression(name)).join('|')})(?![\\w-])`,
    'u',
  );
  for (const path of buildFiles.filter((file) => TEXT_FILE_EXTENSIONS.has(extname(file)))) {
    const name = pattern.exec(await readFile(resolve(buildDirectory, path), 'utf8'))?.[1];
    if (name !== undefined) {
      throw new Error(`${MESSAGES.ForbiddenPackageName} in ${path}: ${name}`);
    }
  }
};

/**
 * Verifies a build of the site: the required files and every listed package's pages, safe markup
 * and unique IDs, every public page's head, structured data and links, the 404 page, the search
 * index, the files for agents and crawlers, and no package the site never mentions.
 * @param buildDirectory The build. Defaults to the website's dist directory.
 * @param packageNames The packages that must each have their pages. Defaults to the catalog's.
 * @returns A promise that resolves when the build passes every check.
 * @throws an Error whose message starts with one of VERIFY_BUILD_ERROR_MESSAGES:
 * - Missing build path: {path}
 * - Production build contains a test file: {path}
 * - Missing package page: {path}
 * - Page has no Markdown version: {htmlPath} -> {markdown file}
 * - Page holds an event handler or a URL with a disallowed scheme in {page}: {problem}
 * - Page repeats an element ID in {page}: {id}
 * - the head, structured data, and link failures of the checks above
 * - The 404 page must not name a canonical URL
 * - INVALID_SITE_BUILD_OPTIONS: The site build verification options are invalid.
 * - SITE_BUILD_INVALID: The static site build failed verification.
 * - Page description is not 70 to 160 characters long in 404.html
 * - The search index does not hold every public page: {count} of {total}
 * - the agent-file failures of checkAgentFiles
 * - The build names a package the site never mentions in {file}: {name}
 */
export const verifyBuild = async (
  buildDirectory: string = DEFAULT_BUILD_DIRECTORY,
  packageNames: readonly string[] = Object.keys(PACKAGE_CATALOG),
): Promise<void> => {
  const buildFiles = await listBuildFiles(buildDirectory);
  const requiredPaths = [...REQUIRED_BUILD_PATHS, SITE_CONFIG.openGraph.image.slice(1)];
  for (const path of requiredPaths) {
    try {
      await access(resolve(buildDirectory, path));
    } catch (error) {
      throw new Error(`${MESSAGES.MissingBuildPath}: ${path}`, { cause: error });
    }
  }
  const testFile = buildFiles.find((path) =>
    /\.test-(?:unit|integration|e2e|browser|bench)\./u.test(path),
  );
  if (testFile !== undefined) {
    throw new Error(`${MESSAGES.ProductionBuildContainsTestFile}: ${testFile}`);
  }
  const missingPage = packageNames
    .flatMap((name) =>
      ['index.html', 'index.md', 'recipes/index.html', 'recipes/index.md'].map(
        (file) => `packages/${name}/${file}`,
      ),
    )
    .find((path) => !buildFiles.includes(path));
  if (missingPage !== undefined) {
    throw new Error(`${MESSAGES.MissingPackagePage}: ${missingPage}`);
  }

  const htmlFiles = buildFiles.filter((path) => path.endsWith('.html'));
  const publicHtmlFiles = htmlFiles.filter((path) => path !== '404.html');
  for (const htmlPath of publicHtmlFiles) {
    const markdownFile = toMarkdownPath(toPagePath(htmlPath)).slice(1);
    if (!buildFiles.includes(markdownFile)) {
      throw new Error(`${MESSAGES.MissingMarkdownVersion}: ${htmlPath} -> ${markdownFile}`);
    }
  }
  const origin = new URL(SITE_CONFIG.url).origin;
  await verifyStaticSite({
    artifactRoot: buildDirectory,
    origin,
    pages: htmlFiles.map((file) => {
      if (file === '404.html') return { path: '/404.html', canonicalUrl: null, indexable: false };
      const path = toPagePath(file);
      return { path, canonicalUrl: new URL(path, origin).href, indexable: true };
    }),
    discovery: { sitemap: '/sitemap-index.xml', robots: '/robots.txt', llms: '/llms.txt' },
  });
  const htmlByPage = new Map<string, string>();
  for (const htmlPath of htmlFiles) {
    const html = await readFile(resolve(buildDirectory, htmlPath), 'utf8');
    const unsafe = findUnsafeAttributes(html);
    if (unsafe !== undefined) {
      throw new Error(`${MESSAGES.UnsafePageMarkup} in ${htmlPath}: ${unsafe}`);
    }
    const ids = listElementIds(html);
    const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
    if (duplicate !== undefined) {
      throw new Error(`${MESSAGES.DuplicateElementId} in ${htmlPath}: ${duplicate}`);
    }
    htmlByPage.set(htmlPath, html);
  }

  const seen = { descriptions: new Set<string>(), titles: new Set<string>() };
  for (const htmlPath of publicHtmlFiles) {
    const html = htmlByPage.get(htmlPath) ?? '';
    checkPageHead(html, htmlPath, seen);
    checkStructuredData(html, htmlPath, packageNames);
  }

  const notFound = htmlByPage.get('404.html') ?? '';
  if (/property="og:url"/u.test(notFound)) {
    throw new Error(MESSAGES.CanonicalOnNotFoundPage);
  }
  const notFoundDescription = /<meta name="description" content="([^"]+)"/u.exec(notFound)?.[1];
  if (notFoundDescription === undefined || !isDescriptionInRange(notFoundDescription)) {
    throw new Error(`${MESSAGES.PageDescriptionOutOfRange} in 404.html`);
  }

  await checkSearchIndex(buildDirectory, publicHtmlFiles.length);
  await checkAgentFiles(buildDirectory, packageNames);
  await checkForbiddenNames(buildDirectory, buildFiles);
};
