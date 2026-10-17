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
 * Loads every listed package's README for its page, keeping the sections the page shows as prose
 * and rendering them with the site's Markdown settings, code highlighting included.
 * @param options The packages directory and the packages to load.
 * @returns The content loader.
 */
export const packageReadmeLoader = ({
  packagesDirectory,
  packageNames,
}: {
  packagesDirectory: string;
  packageNames: readonly string[];
}): Loader => ({
  name: 'package-readme-loader',
  load: async (context) => {
    const { store, watcher } = context;
    store.clear();
    for (const name of packageNames) {
      const path = join(packagesDirectory, name, 'README.md');
      const markdown = await readFile(path, 'utf8');
      const body = selectReadmeSections(markdown);
      store.set({
        id: name,
        data: { name },
        body,
        digest: context.generateDigest(markdown),
        rendered: await context.renderMarkdown(body),
      });
      watcher?.add(path);
    }
  },
});
