import { renderNewTabMarker } from '../components/new-tab-marker/new-tab-marker-markup.ts';

// the parts of a hast element the plugin reads
type IHastElement = {
  type: 'element';
  tagName: string;
  properties?: Record<string, unknown> | undefined;
};

// the raw HTML node the plugin appends to a link
type IHastRaw = { type: 'raw'; value: string };

// the parts of Sätteri's visitor context the plugin uses to change a link in place
export type IExternalLinkContext<TNode> = {
  appendChild(node: TNode, child: IHastRaw): void;
  setProperty(node: TNode, key: string, value: unknown): void;
};

// what externalLinkPlugin needs
export type IExternalLinkPluginOptions = {
  // the site's own URL, such as https://example.com; links to its origin stay in the tab
  siteUrl: string | URL;
};

// the link types every new-tab link carries, so the destination never learns where the visitor came
// from and can't reach back into the page
const NEW_TAB_REL = 'noreferrer';

/**
 * Reads a link's rel tokens, which hast holds as a list, or as a string when set by hand.
 * @param rel The link's rel property.
 * @returns The tokens.
 */
const readRelTokens = (rel: unknown): string[] => {
  if (Array.isArray(rel)) {
    return rel.filter((token): token is string => typeof token === 'string');
  }
  return typeof rel === 'string' ? rel.split(/\s+/u).filter(Boolean) : [];
};

/**
 * Tells whether a link leaves the site: an absolute http(s) URL on another origin. Relative links,
 * fragments, and other schemes, such as mailto:, stay put.
 * @param href The link's href.
 * @param siteOrigin The site's origin.
 * @returns Whether the link goes to another site.
 */
export const isExternalHref = (href: unknown, siteOrigin: string): boolean => {
  if (typeof href !== 'string' || !/^https?:\/\//iu.test(href)) {
    return false;
  }
  const url = URL.parse(href);
  return url !== null && url.origin !== siteOrigin;
};

/**
 * Builds a hast plugin for Astro's Markdown processor, Sätteri, that makes every link to another
 * site open in a new tab, as the package's components do: it gets `target="_blank"` and
 * `rel="noreferrer"`, and ends with the new-tab marker, an up-right arrow and a notice for screen
 * readers. A link that already has a target keeps it, and gets nothing else.
 * @param options The site's URL, which tells its own links from other sites'.
 * @returns The plugin.
 * @example
 * // astro.config.ts
 * import { satteri } from '@astrojs/markdown-satteri';
 * import { defineConfig } from 'astro/config';
 * import { externalLinkPlugin } from 'jg-personal-astro-ui/external-link-plugin';
 *
 * const site = 'https://example.com';
 *
 * export default defineConfig({
 *   site,
 *   markdown: { processor: satteri({ hastPlugins: [externalLinkPlugin({ siteUrl: site })] }) },
 * });
 */
export const externalLinkPlugin = ({ siteUrl }: IExternalLinkPluginOptions) => {
  const siteOrigin = new URL(siteUrl).origin;
  return {
    name: 'jg-external-link',
    element: {
      filter: ['a'],
      // generic, so the context takes the processor's own node type, which its types require
      visit: <TNode extends IHastElement>(
        node: TNode,
        ctx: IExternalLinkContext<NoInfer<TNode>>,
      ): void => {
        const properties = node.properties ?? {};
        if (properties['target'] !== undefined || !isExternalHref(properties['href'], siteOrigin)) {
          return;
        }
        const rel = readRelTokens(properties['rel']);
        ctx.setProperty(node, 'target', '_blank');
        ctx.setProperty(node, 'rel', rel.includes(NEW_TAB_REL) ? rel : [...rel, NEW_TAB_REL]);
        ctx.appendChild(node, { type: 'raw', value: renderNewTabMarker() });
      },
    },
  };
};
