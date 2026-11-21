import { html as parse5Html, parse, type DefaultTreeAdapterTypes } from 'parse5';

import type { IHtmlScan } from './types.js';

const NOINDEX = /(?:^|[,\s])(?:noindex|none)(?:$|[,\s])/iu;

/**
 * Parses one HTML file, including decoded attributes, without visiting inert templates.
 * @param html The verified artifact text.
 * @returns Known anchors, links, and document search metadata.
 */
export const scanHtml = (html: string): IHtmlScan => {
  const parsed = parse(html);
  const scan: IHtmlScan = {
    anchors: new Set<string>(),
    canonicalLinks: [],
    noindex: false,
    links: [],
  };
  type INode = DefaultTreeAdapterTypes.Node;
  const todo: { node: INode; inHead: boolean }[] = [{ node: parsed, inHead: false }];
  for (let visit = todo.pop(); visit !== undefined; visit = todo.pop()) {
    const { node, inHead } = visit;
    if ('attrs' in node) {
      const attributes = new Map(node.attrs.map(({ name, value }) => [name, value]));
      const id = attributes.get('id');
      if (id) scan.anchors.add(id);
      if (node.namespaceURI === parse5Html.NS.HTML) {
        const tag = node.tagName;
        const href = attributes.get('href');
        const name = attributes.get('name');
        const relations = (attributes.get('rel') ?? '').toLowerCase().split(/\s+/u);
        if (tag === 'a' && name) scan.anchors.add(name);
        if (tag === 'base' && href !== undefined)
          throw new Error('HTML base URLs are unsupported.');
        if (inHead && tag === 'link' && relations.includes('canonical')) {
          scan.canonicalLinks.push(href ?? '');
        } else if (href !== undefined && (tag === 'a' || tag === 'area' || tag === 'link')) {
          scan.links.push(href);
        }
        if (inHead && tag === 'meta' && name?.toLowerCase() === 'robots')
          scan.noindex ||= NOINDEX.test(attributes.get('content') ?? '');
      }
    }
    if ('childNodes' in node) {
      const childInHead = inHead || ('tagName' in node && node.tagName === 'head');
      for (const child of node.childNodes) todo.push({ node: child, inHead: childInHead });
    }
  }
  return scan;
};
