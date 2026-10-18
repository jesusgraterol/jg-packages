import type { IHomeMarkdownOptions, IMarkdownPackage, IPackageLinks } from './types.ts';

/**
 * Gives the path of a page's Markdown version: `index.md` in the page's directory.
 * @param pagePath The page's path, ending in a slash, such as `/packages/jg-fetch/`.
 * @returns The Markdown version's path, such as `/packages/jg-fetch/index.md`.
 */
export const toMarkdownPath = (pagePath: string): string => `${pagePath}index.md`;

/**
 * Writes a package page's Markdown version: a header with what the package is and where to find
 * it, then its README's sections and its API reference, as the page shows them.
 * @param listedPackage The package.
 * @param links Its npm, source, and recipes links.
 * @param readme The README's sections the page shows, from `## Usage` on.
 * @param apiReference The API reference, rendered with its title as a level-two heading.
 * @returns The Markdown.
 */
export const buildPackageMarkdown = (
  { description, name, runtimes, version }: IMarkdownPackage,
  { npmUrl, recipesUrl, sourceUrl }: IPackageLinks,
  readme: string,
  apiReference: string,
): string =>
  `${[
    `# ${name}`,
    `> ${description}`,
    [
      `- **Version:** \`${version}\``,
      `- **Runtimes:** ${runtimes.join(', ')}`,
      `- **Install:** \`npm install ${name}\``,
      `- **On npm:** [${name}](${npmUrl})`,
      `- **Source:** [packages/${name}](${sourceUrl})`,
      `- **Recipes:** [${name} recipes](${recipesUrl})`,
    ].join('\n'),
    readme.trim(),
    apiReference.trim(),
  ].join('\n\n')}\n`;

/**
 * Writes the home page's Markdown version, section by section, with each package linked to its
 * own Markdown version.
 * @param options The page's words, the packages, and the site.
 * @returns The Markdown.
 */
export const buildHomeMarkdown = ({
  agentResources,
  benefits,
  groups,
  hero,
  sections,
  setup,
  site,
}: IHomeMarkdownOptions): string => {
  const sectionStart = ({ eyebrow, lede, title }: (typeof sections)['packages']): string =>
    `## ${eyebrow}\n\n**${title}** ${lede}`;
  const packageUrl = (name: string): string =>
    new URL(toMarkdownPath(`/packages/${name}/`), site.url).toString();
  return `${[
    `# ${site.name}`,
    `> ${site.description}`,
    hero.lede,
    sectionStart(sections.packages),
    ...groups.map(({ heading, packages, summary }) =>
      [
        `### ${heading}`,
        summary,
        packages
          .map(({ description, name }) => `- [${name}](${packageUrl(name)}): ${description}`)
          .join('\n'),
      ].join('\n\n'),
    ),
    sectionStart(sections.why),
    benefits.map(({ text, title }) => `- **${title}:** ${text}`).join('\n'),
    sectionStart(sections.setup),
    [
      `1. **${setup.steps.policy.title}:** ${setup.steps.policy.text} [Open the policy](${setup.policyUrl}), and read [about the skill](${setup.skillUrl}).`,
      `2. **${setup.steps.skill.title}:** ${setup.steps.skill.text}`,
      ['   ```bash', `   ${setup.installCommand}`, '   ```'].join('\n'),
    ].join('\n\n'),
    sectionStart(sections.agents),
    agentResources
      .map(({ href, path, text }) =>
        href === undefined
          ? `- \`${path}\`: ${text}`
          : `- [\`${path}\`](${new URL(href, site.url).toString()}): ${text}`,
      )
      .join('\n'),
  ].join('\n\n')}\n`;
};
