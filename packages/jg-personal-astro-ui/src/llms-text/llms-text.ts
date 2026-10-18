import type { ILlmsFullTextOptions, ILlmsTextOptions } from './types.ts';

/**
 * Escapes text for use as a Markdown link's label, so a bracket in it can't end the label.
 * @param label The label, such as a page's name.
 * @returns The escaped label.
 * @example
 * import { escapeMarkdownLabel } from 'jg-personal-astro-ui/llms-text';
 *
 * escapeMarkdownLabel('[draft] notes'); // '\[draft\] notes'
 */
export const escapeMarkdownLabel = (label: string): string =>
  label.replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]');

/**
 * Collapses prose into one line for a Markdown list item, so a description written across lines
 * stays one item.
 * @param description The description.
 * @returns The description on one line, without surrounding whitespace.
 * @example
 * import { normalizeDescription } from 'jg-personal-astro-ui/llms-text';
 *
 * normalizeDescription('Typed stores,\n  for pages and workers. '); // 'Typed stores, for pages and workers.'
 */
export const normalizeDescription = (description: string): string =>
  description.replaceAll(/\s+/gu, ' ').trim();

/**
 * Writes an llms.txt in the llmstxt.org format: the site's name as the title, its summary as a
 * blockquote, optional details, then one `##` section per group of links. Each link's label is
 * escaped, and its description kept to one line.
 * @param options The name, the summary, the details, and the sections.
 * @returns The file's text.
 * @example
 * import { buildLlmsText } from 'jg-personal-astro-ui/llms-text';
 *
 * buildLlmsText({
 *   name: 'jg-packages',
 *   summary: 'Small, tested TypeScript packages for coding agents.',
 *   sections: [
 *     {
 *       heading: 'Packages',
 *       links: [
 *         {
 *           title: 'jg-fetch',
 *           url: 'https://jg-packages.jesusgraterol.dev/packages/jg-fetch/index.md',
 *           description: 'A fetch wrapper that never throws.',
 *         },
 *       ],
 *     },
 *   ],
 * });
 * // a title, a blockquote, and a `## Packages` section with one link
 */
export const buildLlmsText = ({
  details = [],
  name,
  sections,
  summary,
}: ILlmsTextOptions): string =>
  `${[
    `# ${name}`,
    `> ${summary}`,
    ...details,
    ...sections.map(({ heading, links }) =>
      [
        `## ${heading}`,
        links
          .map(
            ({ description, title, url }) =>
              `- [${escapeMarkdownLabel(title)}](${url}): ${normalizeDescription(description)}`,
          )
          .join('\n'),
      ].join('\n\n'),
    ),
  ].join('\n\n')}\n`;

/**
 * Gathers a site's documents into one file, as llms-full.txt: the site's name and summary, then
 * each document, separated by a rule.
 * @param options The name, the summary, and the documents, each a Markdown file.
 * @returns The file's text.
 * @example
 * import { buildLlmsFullText } from 'jg-personal-astro-ui/llms-text';
 *
 * buildLlmsFullText({ name: 'jg-packages', summary: 'Packages for agents.', documents: ['# jg-fetch\n'] });
 * // the title and the summary, a rule, then the jg-fetch document
 */
export const buildLlmsFullText = ({ documents, name, summary }: ILlmsFullTextOptions): string =>
  `${[`# ${name}\n\n> ${summary}`, ...documents.map((document) => document.trim())].join('\n\n---\n\n')}\n`;
