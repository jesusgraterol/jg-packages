import type {
  IBreadcrumbItem,
  IListedPage,
  IStructuredDataOptions,
  IStructuredDataSite,
  IStructuredDataSourceCode,
} from './types.ts';

/**
 * Builds the breadcrumb entity from the same hierarchy the page shows.
 * @param site The site.
 * @param breadcrumbs The steps, from the home page to this page.
 * @param canonicalUrl The page's URL.
 * @returns The BreadcrumbList entity.
 */
const buildBreadcrumbList = (
  site: IStructuredDataSite,
  breadcrumbs: readonly IBreadcrumbItem[],
  canonicalUrl: string,
): Record<string, unknown> => ({
  '@id': `${canonicalUrl}#breadcrumb`,
  '@type': 'BreadcrumbList',
  itemListElement: breadcrumbs.map(({ name, path }, index) => ({
    '@type': 'ListItem',
    item: new URL(path, site.url).toString(),
    name,
    position: index + 1,
  })),
});

/**
 * Builds the list of pages the home page presents, in display order.
 * @param site The site.
 * @param listedPages The pages.
 * @returns The ItemList entity.
 */
const buildItemList = (
  site: IStructuredDataSite,
  listedPages: readonly IListedPage[],
): Record<string, unknown> => ({
  '@id': `${new URL('/', site.url).toString()}#pages`,
  '@type': 'ItemList',
  itemListElement: listedPages.map(({ name, path }, index) => ({
    '@type': 'ListItem',
    name,
    position: index + 1,
    url: new URL(path, site.url).toString(),
  })),
});

/**
 * Describes the source code a page documents.
 * @param sourceCode The code.
 * @param author The code's author.
 * @param canonicalUrl The page's URL.
 * @param description What the code does.
 * @returns The SoftwareSourceCode entity.
 */
const buildSourceCode = (
  { codeRepository, license, name, programmingLanguage, version }: IStructuredDataSourceCode,
  author: Record<string, unknown>,
  canonicalUrl: string,
  description: string,
): Record<string, unknown> => ({
  '@id': `${canonicalUrl}#source`,
  '@type': 'SoftwareSourceCode',
  author,
  codeRepository,
  description,
  license,
  name,
  programmingLanguage,
  url: canonicalUrl,
  version,
});

/**
 * Builds the JSON-LD for one page: the WebSite, with the pages it lists, for the home page, and a
 * WebPage within it, with its breadcrumb and the source code it documents, for every other page.
 * @param options What the page describes.
 * @returns The page's JSON-LD.
 */
export const buildStructuredData = ({
  breadcrumbs,
  canonicalUrl,
  description,
  listedPages,
  site,
  sourceCode,
  title,
  type,
}: IStructuredDataOptions): Record<string, unknown> => {
  const websiteUrl = new URL('/', site.url).toString();
  const websiteId = `${websiteUrl}#website`;
  const author = { '@type': 'Person', name: site.author.name, url: site.author.url };
  if (type === 'website') {
    const website = {
      '@id': websiteId,
      '@type': 'WebSite',
      author,
      description,
      inLanguage: site.language,
      name: site.name,
      url: websiteUrl,
    };
    return listedPages === undefined || listedPages.length === 0
      ? { '@context': 'https://schema.org', ...website }
      : { '@context': 'https://schema.org', '@graph': [website, buildItemList(site, listedPages)] };
  }
  const breadcrumbList =
    breadcrumbs !== undefined && breadcrumbs.length >= 2
      ? buildBreadcrumbList(site, breadcrumbs, canonicalUrl)
      : undefined;
  const page = {
    '@id': `${canonicalUrl}#webpage`,
    '@type': 'WebPage',
    ...(breadcrumbList === undefined
      ? {}
      : { breadcrumb: { '@id': `${canonicalUrl}#breadcrumb` } }),
    description,
    inLanguage: site.language,
    isPartOf: { '@id': websiteId, '@type': 'WebSite', name: site.name, url: websiteUrl },
    name: title,
    url: canonicalUrl,
  };
  const entities = [
    page,
    ...(sourceCode === undefined
      ? []
      : [buildSourceCode(sourceCode, author, canonicalUrl, description)]),
    ...(breadcrumbList === undefined ? [] : [breadcrumbList]),
  ];
  return entities.length === 1
    ? { '@context': 'https://schema.org', ...page }
    : { '@context': 'https://schema.org', '@graph': entities };
};
