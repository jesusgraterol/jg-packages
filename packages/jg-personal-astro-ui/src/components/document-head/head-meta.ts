// the image social cards show for the page
export type IOpenGraphImage = {
  alt: string;
  height: number;
  // a MIME type, such as image/png
  type: string;
  url: string;
  width: number;
};

// what kind of thing the page is, for Open Graph: a site's page, an article, or a person's profile
export type IOpenGraphType = 'article' | 'profile' | 'website';

// the article a page of type 'article' is, for the article:* tags
export type IHeadArticle = {
  author: string;
  // ISO 8601 date-times, such as 2026-10-18T00:00:00.000Z
  modifiedTime?: string | undefined;
  publishedTime?: string | undefined;
  // the article's topic, such as the name of its collection
  section?: string | undefined;
};

// the person a page of type 'profile' is about, for the profile:* tags
export type IHeadProfile = {
  firstName: string;
  lastName: string;
  username?: string | undefined;
};

// an icon the browser can show for the page, such as a favicon or a home screen icon
export type IHeadIcon = {
  href: string;
  rel: 'apple-touch-icon' | 'icon';
  // the sizes the file holds, such as '16x16 32x32 48x48'
  sizes?: string | undefined;
  // a MIME type, such as image/svg+xml
  type?: string | undefined;
};

// another version of the page, offered to agents, such as its Markdown
export type IHeadAlternate = {
  href: string;
  title?: string | undefined;
  // a MIME type, such as text/markdown
  type: string;
};

// what buildHeadTags needs
export type IHeadTagsOptions = {
  alternate?: IHeadAlternate | undefined;
  article?: IHeadArticle | undefined;
  canonicalUrl?: string | undefined;
  description: string;
  icons?: readonly IHeadIcon[] | undefined;
  llmsTextUrl?: string | undefined;
  locale: string;
  noIndex: boolean;
  openGraphImage?: IOpenGraphImage | undefined;
  openGraphType: IOpenGraphType;
  profile?: IHeadProfile | undefined;
  siteName: string;
  title: string;
  twitterCreator?: string | undefined;
};

// a link or meta element of the page's head, with its attributes in the order they render
export type IHeadTag = {
  attributes: Record<string, string>;
  element: 'link' | 'meta';
};

/**
 * Builds a link element.
 * @param attributes Its attributes, in order; undefined values are left out.
 * @returns The tag.
 */
const link = (attributes: Record<string, string | undefined>): IHeadTag => ({
  element: 'link',
  attributes: Object.fromEntries(
    Object.entries(attributes).filter((entry): entry is [string, string] => entry[1] !== undefined),
  ),
});

/**
 * Builds a meta element.
 * @param key The attribute that names it: property for Open Graph, name for everything else.
 * @param value Its property or name, such as og:title.
 * @param content Its content.
 * @returns The tag.
 */
const meta = (key: 'name' | 'property', value: string, content: string): IHeadTag => ({
  element: 'meta',
  attributes: { [key]: value, content },
});

/**
 * Builds the article:* tags of a page of type 'article'.
 * @param article The article.
 * @returns The tags, in the order Open Graph lists them.
 */
const buildArticleTags = ({
  author,
  modifiedTime,
  publishedTime,
  section,
}: IHeadArticle): IHeadTag[] => [
  ...(publishedTime === undefined
    ? []
    : [meta('property', 'article:published_time', publishedTime)]),
  ...(modifiedTime === undefined ? [] : [meta('property', 'article:modified_time', modifiedTime)]),
  meta('property', 'article:author', author),
  ...(section === undefined ? [] : [meta('property', 'article:section', section)]),
];

/**
 * Builds the profile:* tags of a page of type 'profile'.
 * @param profile The person.
 * @returns The tags.
 */
const buildProfileTags = ({ firstName, lastName, username }: IHeadProfile): IHeadTag[] => [
  meta('property', 'profile:first_name', firstName),
  meta('property', 'profile:last_name', lastName),
  ...(username === undefined ? [] : [meta('property', 'profile:username', username)]),
];

/**
 * Builds the link and meta elements of a page's head that describe it to browsers, agents, and
 * social cards: the canonical, llms.txt, alternate, and icon links, then the Open Graph tags, with
 * the article:* or profile:* tags its type calls for, then the X card. A noindex page gets no
 * canonical URL and no og:url, which would contradict noindex. Article details render only for a
 * page of type 'article', and profile details only for one of type 'profile'.
 * @param options What the page is and how it is described.
 * @returns The tags, in the order they render.
 */
export const buildHeadTags = ({
  alternate,
  article,
  canonicalUrl,
  description,
  icons = [],
  llmsTextUrl,
  locale,
  noIndex,
  openGraphImage,
  openGraphType,
  profile,
  siteName,
  title,
  twitterCreator,
}: IHeadTagsOptions): IHeadTag[] => {
  const pageUrl = noIndex ? undefined : canonicalUrl;
  return [
    ...(pageUrl === undefined ? [] : [link({ rel: 'canonical', href: pageUrl })]),
    ...(llmsTextUrl === undefined ? [] : [link({ rel: 'describedby', href: llmsTextUrl })]),
    ...(alternate === undefined
      ? []
      : [
          link({
            rel: 'alternate',
            type: alternate.type,
            href: alternate.href,
            title: alternate.title,
          }),
        ]),
    ...icons.map(({ href, rel, sizes, type }) => link({ rel, type, sizes, href })),
    meta('property', 'og:site_name', siteName),
    meta('property', 'og:locale', locale),
    meta('property', 'og:type', openGraphType),
    meta('property', 'og:title', title),
    meta('property', 'og:description', description),
    ...(pageUrl === undefined ? [] : [meta('property', 'og:url', pageUrl)]),
    ...(openGraphImage === undefined
      ? []
      : [
          meta('property', 'og:image', openGraphImage.url),
          meta('property', 'og:image:type', openGraphImage.type),
          meta('property', 'og:image:width', String(openGraphImage.width)),
          meta('property', 'og:image:height', String(openGraphImage.height)),
          meta('property', 'og:image:alt', openGraphImage.alt),
        ]),
    ...(openGraphType === 'article' && article !== undefined ? buildArticleTags(article) : []),
    ...(openGraphType === 'profile' && profile !== undefined ? buildProfileTags(profile) : []),
    meta('name', 'twitter:card', openGraphImage === undefined ? 'summary' : 'summary_large_image'),
    ...(twitterCreator === undefined ? [] : [meta('name', 'twitter:creator', twitterCreator)]),
    meta('name', 'twitter:title', title),
    meta('name', 'twitter:description', description),
    ...(openGraphImage === undefined
      ? []
      : [
          meta('name', 'twitter:image', openGraphImage.url),
          meta('name', 'twitter:image:alt', openGraphImage.alt),
        ]),
  ];
};
