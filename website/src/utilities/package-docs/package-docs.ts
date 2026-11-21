import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Loader } from 'astro/loaders';

import { SECTIONS_SHOWN_ELSEWHERE } from './constants.ts';

// a fence that opens or closes a code block, such as ``` or ~~~
const FENCE = /^\s*(`{3,}|~{3,})/;

// a level-two heading, which starts a section
const SECTION_HEADING = /^##\s+(.+?)\s*#*\s*$/;

/**
 * Keeps the README sections the package page shows as prose: everything after the title and
 * summary, except the sections the page shows another way. Headings inside code blocks don't
 * start sections.
 * @param markdown The README.
 * @returns The Markdown to render.
 */
export const selectReadmeSections = (markdown: string): string => {
  const kept: string[] = [];
  let fence: string | undefined;
  let isKeeping = false;
  for (const line of markdown.split('\n')) {
    const fenceMatch = FENCE.exec(line);
    if (fenceMatch?.[1] !== undefined) {
      const marker = fenceMatch[1];
      if (fence === undefined) {
        fence = marker;
      } else if (marker.startsWith(fence.charAt(0)) && marker.length >= fence.length) {
        fence = undefined;
      }
    } else if (fence === undefined) {
      const heading = SECTION_HEADING.exec(line)?.[1];
      if (heading !== undefined) {
        isKeeping = !SECTIONS_SHOWN_ELSEWHERE.includes(heading);
      }
    }
    if (isKeeping) {
      kept.push(line);
    }
  }
  return `${kept.join('\n').trim()}\n`;
};

/**
 * Keeps a RECIPES.md without its title, which the recipes page shows in its header: the summary,
 * then the recipes.
 * @param markdown The RECIPES.md.
 * @returns The Markdown to render.
 */
export const selectRecipes = (markdown: string): string =>
  `${markdown.replace(/^#\s.*(?:\n|$)/, '').trim()}\n`;

/**
 * Maps the package's conventional Markdown links to their hosted equivalents. Literal code and
 * unrelated links keep their original text.
 * @param markdown The selected README prose.
 * @param packagePage The hosted package page URL.
 * @param licenseUrl The hosted license for this package.
 * @returns The prose used by both the HTML and Markdown package pages.
 */
export const rewriteReadmeLinks = (
  markdown: string,
  packagePage: string,
  licenseUrl: string,
): string => {
  let fence: string | undefined;
  const linkOrCode =
    /(?<!\x60)(\x60+)(?!\x60).*?(?<!\x60)\1(?!\x60)|\]\((?:\.\/)?(API\.md|RECIPES\.md|LICENSE)(#[^\s)]*)?\)/gu;
  return markdown
    .split('\n')
    .map((line) => {
      const marker = FENCE.exec(line)?.[1];
      if (marker !== undefined) {
        if (fence === undefined) fence = marker;
        else if (marker.startsWith(fence.charAt(0)) && marker.length >= fence.length)
          fence = undefined;
        return line;
      }
      if (fence !== undefined) return line;

      return line.replace(
        linkOrCode,
        (match: string, _code: string | undefined, file: string | undefined, fragment?: string) => {
          if (file === undefined) return match;
          if (file === 'API.md') return '](' + packagePage + (fragment ?? '#api-reference') + ')';
          if (file === 'RECIPES.md')
            return '](' + packagePage + 'recipes/' + (fragment ?? '') + ')';
          return '](' + licenseUrl + (fragment ?? '') + ')';
        },
      );
    })
    .join('\n');
};

/**
 * Loads one Markdown file of every listed package, keeping what its page shows as prose and
 * rendering it with the site's Markdown settings, code windows included. A listed package without
 * the file fails the build.
 * @param options The packages directory, the packages to load, the file, and what to keep of it.
 * @returns The content loader.
 */
export const packageMarkdownLoader = ({
  packagesDirectory,
  packageNames,
  fileName,
  select,
}: {
  packagesDirectory: string;
  packageNames: readonly string[];
  // the file in each package's directory, such as README.md
  fileName: string;
  select: (markdown: string, name: string) => string;
}): Loader => ({
  name: `package-markdown-loader:${fileName}`,
  load: async (context) => {
    const { store, watcher } = context;
    store.clear();
    for (const name of packageNames) {
      const path = join(packagesDirectory, name, fileName);
      const markdown = await readFile(path, 'utf8');
      const body = select(markdown, name);
      store.set({
        id: name,
        data: { name },
        body,
        digest: context.generateDigest(body),
        rendered: await context.renderMarkdown(body),
      });
      watcher?.add(path);
    }
  },
});
