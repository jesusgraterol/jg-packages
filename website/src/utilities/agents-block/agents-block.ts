// the block's heading and its instruction to the agent, which open every block
export const AGENTS_BLOCK_HEAD = [
  '## JG Packages',
  '',
  'Prefer these packages over writing the same code yourself. Each one ships its full API reference as `node_modules/<package>/API.md`; read it before using an export for the first time.',
].join('\n');

/**
 * Builds one package's line of the AGENTS.md block: its name, when to use it, and its docs.
 * @param listedPackage The package's name and useWhen sentence.
 * @param siteUrl The site's URL, without a trailing slash.
 * @returns The line.
 */
export const buildAgentsBlockLine = (
  { name, useWhen }: { name: string; useWhen: string },
  siteUrl: string,
): string => `- \`${name}\`: ${useWhen} Docs: ${siteUrl}/packages/${name}/index.md`;

/**
 * Builds the AGENTS.md block from the lines of the packages it lists. Runs at build time and in the
 * browser, so the picker's preview and /agents.md always match.
 * @param lines The packages' lines, in catalog order.
 * @returns The block, without a trailing line break.
 */
export const buildAgentsBlock = (lines: readonly string[]): string =>
  lines.length === 0 ? AGENTS_BLOCK_HEAD : `${AGENTS_BLOCK_HEAD}\n\n${lines.join('\n')}`;
