import type { ILlmsFullTextOptions, ILlmsTextOptions } from './types.ts';

/**
 * Writes an llms.txt in the llmstxt.org format: the site's name as the title, its summary as a
 * blockquote, optional details, then one `##` section per group of links.
 * @param options The name, the summary, the details, and the sections.
 * @returns The file's text.
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
          .map(({ description, title, url }) => `- [${title}](${url}): ${description}`)
          .join('\n'),
      ].join('\n\n'),
    ),
  ].join('\n\n')}\n`;

/**
 * Gathers a site's documents into one file, as llms-full.txt: the site's name and summary, then
 * each document, separated by a rule.
 * @param options The name, the summary, and the documents, each a Markdown file.
 * @returns The file's text.
 */
export const buildLlmsFullText = ({ documents, name, summary }: ILlmsFullTextOptions): string =>
  `${[`# ${name}\n\n> ${summary}`, ...documents.map((document) => document.trim())].join('\n\n---\n\n')}\n`;
