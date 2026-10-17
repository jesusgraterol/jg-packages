import type { IPackageManifest } from '../shared/types.ts';

// the README's second-level sections, in the order the package guidelines require
const REQUIRED_SECTIONS = ['Install', 'Usage', 'Documentation', 'License'];

// a section about a predecessor package, which no README has: every package starts clean
const PREDECESSOR_SECTION = /^Coming from\b/;

/**
 * Escapes text for use inside a regular expression.
 * @param text The literal text.
 * @returns The escaped pattern.
 */
const escapePattern = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Checks the README's title, summary, and required sections.
 * @param name The package name, which must be the title.
 * @param readme The README's text.
 * @returns One problem per missing or misplaced part.
 */
const checkReadme = (name: string, readme: string): string[] => {
  const lines = readme.split('\n');
  const problems: string[] = [];
  if (lines[0]?.trim() !== `# ${name}`) {
    problems.push(`README.md doesn't start with the title \`# ${name}\``);
  }
  const firstSection = lines.findIndex((line) => line.startsWith('## '));
  const summary = lines
    .slice(1, firstSection === -1 ? lines.length : firstSection)
    .join('\n')
    .trim();
  if (summary === '') {
    problems.push('README.md has no summary between the title and the first section');
  }
  const headings = lines
    .filter((line) => line.startsWith('## '))
    .map((line) => line.slice(3).trim());
  const sections = headings.filter((section) => REQUIRED_SECTIONS.includes(section));
  if (sections.join('\n') !== REQUIRED_SECTIONS.join('\n')) {
    problems.push(
      `README.md needs the sections ${REQUIRED_SECTIONS.map((section) => `\`## ${section}\``).join(', ')} once each, in that order`,
    );
  }
  for (const section of headings.filter((heading) => PREDECESSOR_SECTION.test(heading))) {
    problems.push(`README.md has a \`## ${section}\` section, but no package has a predecessor`);
  }
  return problems;
};

/**
 * Check 5: the docs a release depends on ship with it. The changelog has a section for the
 * version, and the README has the guidelines' title, summary, and sections.
 * @param manifest The packed manifest.
 * @param files The tarball's files.
 * @returns One problem per missing document or section.
 */
export const checkReleaseDocs = (
  manifest: IPackageManifest,
  files: Map<string, Buffer>,
): string[] => {
  const problems: string[] = [];
  const changelog = files.get('CHANGELOG.md')?.toString('utf8');
  if (changelog === undefined) {
    problems.push("doesn't ship a CHANGELOG.md");
  } else if (!new RegExp(`^## ${escapePattern(manifest.version)}\\s*$`, 'm').test(changelog)) {
    problems.push(`CHANGELOG.md has no \`## ${manifest.version}\` section`);
  }
  const readme = files.get('README.md')?.toString('utf8');
  if (readme === undefined) {
    problems.push("doesn't ship a README.md");
  } else {
    problems.push(...checkReadme(manifest.name, readme));
  }
  return problems;
};
