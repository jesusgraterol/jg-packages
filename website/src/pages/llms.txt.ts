import type { APIRoute } from 'astro';

import { PACKAGE_CATALOG, PACKAGES_DIRECTORY, SITE_CONFIG } from '../site.config.ts';
import { buildLlmsText } from '../utilities/llms-text/index.ts';
import { toMarkdownPath } from '../utilities/markdown-pages/index.ts';
import { loadListedPackages } from '../utilities/package-catalog/index.ts';
import {
  loadRecipesMarkdown,
  readRecipesSummary,
  toTextResponse,
} from '../utilities/site-markdown/index.ts';

// the site's index for agents, in the llmstxt.org format, linking each page's Markdown version
export const GET: APIRoute = async () => {
  const packages = await loadListedPackages(PACKAGE_CATALOG, PACKAGES_DIRECTORY);
  const toSiteUrl = (path: string): string => new URL(path, SITE_CONFIG.url).toString();
  const { installCommand, policyUrl, skillUrl } = SITE_CONFIG.agentSetup;
  const recipes = await Promise.all(
    packages.map(async ({ name }) => ({
      name,
      summary: readRecipesSummary(await loadRecipesMarkdown(name)),
    })),
  );
  return toTextResponse(
    buildLlmsText({
      details: [
        'Every package ships its full API reference as `API.md` and its recipes as `RECIPES.md`, so an agent can read the installed version from `node_modules`. Every page of this site has a Markdown version at `index.md` in its directory, and returns it when requested with `Accept: text/markdown`.',
      ],
      name: SITE_CONFIG.name,
      sections: [
        {
          heading: 'Agent setup',
          links: [
            {
              description:
                "A `## jg-packages` section for a project's AGENTS.md that tells its agent to prefer these packages and to check the installed version's API.md.",
              title: 'The jg-packages policy',
              url: policyUrl,
            },
            {
              description: `Tells an agent which package fits a task. Install it with \`${installCommand}\`.`,
              title: 'The jg-packages skill',
              url: skillUrl,
            },
          ],
        },
        {
          heading: 'Packages',
          links: packages.map(({ description, name }) => ({
            description,
            title: name,
            url: toSiteUrl(toMarkdownPath(`/packages/${name}/`)),
          })),
        },
        {
          heading: 'Recipes',
          links: recipes.map(({ name, summary }) => ({
            description: summary,
            title: `${name} recipes`,
            url: toSiteUrl(toMarkdownPath(`/packages/${name}/recipes/`)),
          })),
        },
      ],
      summary: SITE_CONFIG.defaultDescription,
    }),
    'text/plain',
  );
};
