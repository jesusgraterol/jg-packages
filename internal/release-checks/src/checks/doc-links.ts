// a shipped Markdown file, such as README.md or errors/README.md
const MARKDOWN_FILE = /\.md$/i;

// the changelog, whose entries link the versions they were written about, so it's left out
const CHANGELOG_FILE = 'CHANGELOG.md';

// a URL in Markdown, up to the whitespace, bracket, or quote that ends it
const URL_PATTERN = /https?:\/\/[^\s<>()[\]"'`]+/g;

// punctuation that ends a sentence after a bare URL, which GitHub leaves out of the link too
const TRAILING_PUNCTUATION = /[.,:;!?*_~]+$/;

// an npm package name, with an optional scope
const PACKAGE_NAME = String.raw`(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*`;

// an exact version, with an optional prerelease
const EXACT_VERSION = String.raw`\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?`;

/*
 * a package pinned to an exact version in a URL's path: npm's `/package/<name>/v/<version>`, or
 * `/<name>@<version>`, as unpkg and jsDelivr write it. Ranges and dist-tags, such as `@latest`,
 * pin no version, so they don't match.
 */
const PINNED_PACKAGE = new RegExp(
  String.raw`\/(?:package\/(${PACKAGE_NAME})\/v\/|(${PACKAGE_NAME})@)(${EXACT_VERSION})`,
  'g',
);

/**
 * Check 9: every link in the shipped Markdown that pins a workspace package to a version, such as
 * `https://unpkg.com/jg-react@0.7.0/API.md`, pins the version the workspace has, so a release's
 * docs link the versions it ships with. Links to other packages, and the changelog, are left alone.
 * @param files The tarball's files.
 * @param workspaceVersions Every workspace package's version, by name.
 * @returns One problem per link that pins another version.
 */
export const checkDocLinks = (
  files: Map<string, Buffer>,
  workspaceVersions: ReadonlyMap<string, string>,
): string[] => {
  const problems = new Set<string>();
  for (const [path, contents] of files) {
    if (!MARKDOWN_FILE.test(path) || path === CHANGELOG_FILE) {
      continue;
    }
    for (const [text] of contents.toString('utf8').matchAll(URL_PATTERN)) {
      const url = text.replace(TRAILING_PUNCTUATION, '');
      for (const match of url.matchAll(PINNED_PACKAGE)) {
        // the name is in the first group for npm's form, and in the second for the `@` form
        const name = match[1] ?? match[2] ?? '';
        const version = match[3];
        const current = workspaceVersions.get(name);
        if (current !== undefined && version !== current) {
          problems.add(
            `${path} links ${name}@${version}, but the workspace has ${current}: ${url}`,
          );
        }
      }
    }
  }
  return [...problems];
};
