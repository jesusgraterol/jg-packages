import { readdirSync } from 'node:fs';
import { createServer, request as forwardRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, relative, resolve, sep } from 'node:path';

// the built site the preview serves
export const BUILD_DIRECTORY = resolve(import.meta.dirname, '..', 'dist');

// a path the site has no page for, which the preview answers with the 404 page
export const NOT_FOUND_PATH = '/no-such-page/';

/**
 * Lists the path of every page in a build directory, such as '/packages/jg-fetch/', from its
 * index.html files. The 404 page is 404.html, so it isn't one of them.
 * @param directory The directory to walk. Defaults to the build.
 * @returns The paths, in no particular order.
 */
const listPagePaths = (directory: string = BUILD_DIRECTORY): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return listPagePaths(join(directory, entry.name));
    }
    if (entry.name !== 'index.html') {
      return [];
    }
    const path = relative(BUILD_DIRECTORY, directory).split(sep).join('/');
    return [path === '' ? '/' : `/${path}/`];
  });

// every public page of the site: the home page, and each package's page and recipes page
export const PAGE_PATHS: readonly string[] = listPagePaths().sort();

// every route the suite checks: the public pages, and the 404 page
export const ROUTES: readonly string[] = [...PAGE_PATHS, NOT_FOUND_PATH];

/**
 * Lists the code of a Markdown document's TypeScript blocks, in order.
 * @param markdown The document.
 * @returns Each block's code, without its fences.
 */
export const listTypeScriptBlocks = (markdown: string): string[] =>
  [...markdown.matchAll(/^```ts\n([\s\S]*?)\n```$/gmu)].map(([, code = '']) => code);

/**
 * Starts a proxy in front of the preview that holds every response to one path, so a navigation to
 * it stays pending whichever request fetches it, including a speculation rules prerender, which
 * Playwright's routing can't intercept.
 * @param origin The preview's origin.
 * @param path The path to hold, such as '/packages/jg-fetch/'.
 * @param delayMs How long to hold each response.
 * @returns A promise that resolves to the proxy's origin and a function that stops it.
 */
export const startDelayingProxy = async (
  origin: string,
  path: string,
  delayMs: number,
): Promise<{ origin: string; close: () => Promise<void> }> => {
  const server = createServer((request, response) => {
    const forward = (): void => {
      const upstream = forwardRequest(
        new URL(request.url ?? '/', origin),
        { method: request.method, headers: request.headers },
        (reply) => {
          response.writeHead(reply.statusCode ?? 502, reply.headers);
          reply.pipe(response);
        },
      );
      request.pipe(upstream);
    };
    if (request.url === path) {
      setTimeout(forward, delayMs);
    } else {
      forward();
    }
  });
  await new Promise<void>((resolveListen) => {
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${String(port)}`,
    close: () =>
      new Promise<void>((resolveClose) => {
        server.closeAllConnections();
        server.close(() => {
          resolveClose();
        });
      }),
  };
};

/**
 * Finds stacked dividers on the page: two horizontal hairlines within 48 px of each other that
 * overlap horizontally. A hairline is an element's top or bottom border without side borders, so a
 * card's box doesn't count, nor do rows inside one table, list, or code block. It runs in the page,
 * so it's self-contained.
 * @returns A description of each pair found.
 */
export const findStackedDividers = (): string[] => {
  // one visible horizontal border, at its position on the page
  type IHairline = { element: Element; y: number; left: number; right: number };
  const hairlines: IHairline[] = [];
  for (const element of document.querySelectorAll('body *')) {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const hasSideBorders =
      parseFloat(style.borderLeftWidth) > 0 || parseFloat(style.borderRightWidth) > 0;
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      rect.width < 24 ||
      rect.height === 0 ||
      hasSideBorders
    ) {
      continue;
    }
    const line = { element, left: rect.left, right: rect.right };
    if (parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== 'none') {
      hairlines.push({ ...line, y: rect.top + window.scrollY });
    }
    if (parseFloat(style.borderBottomWidth) > 0 && style.borderBottomStyle !== 'none') {
      hairlines.push({ ...line, y: rect.bottom + window.scrollY });
    }
  }
  const describe = (element: Element): string =>
    `${element.tagName.toLowerCase()}${element.id === '' ? '' : `#${element.id}`}.${[...element.classList].slice(0, 3).join('.')}`;
  // rows of one table, list, or code block are meant to sit close together
  const isOneGroup = (first: Element, second: Element): boolean => {
    const group = first.closest('ul, ol, table, dl, pre');
    return group !== null && group === second.closest('ul, ol, table, dl, pre');
  };
  const problems: string[] = [];
  hairlines.forEach((first, index) => {
    for (const second of hairlines.slice(index + 1)) {
      const gap = Math.abs(first.y - second.y);
      const isSameEdge =
        first.element === second.element ||
        ((first.element.contains(second.element) || second.element.contains(first.element)) &&
          gap < 1);
      const overlap = Math.min(first.right, second.right) - Math.max(first.left, second.left);
      if (!isSameEdge && gap <= 48 && overlap > 0 && !isOneGroup(first.element, second.element)) {
        problems.push(
          `${describe(first.element)} @${String(Math.round(first.y))} / ${describe(second.element)} @${String(Math.round(second.y))}`,
        );
      }
    }
  });
  return problems;
};
