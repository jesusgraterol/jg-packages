// file listing a release's tarballs in publish order, written by `pack`
export const RELEASE_MANIFEST_FILE = 'release-manifest.json';

// file listing what `publish` put on npm, read by `tag`
export const PUBLISHED_FILE = 'published.json';

// manifest fields whose ranges point at other packages
export const DEPENDENCY_FIELDS = [
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

// npm's dist-tag for prereleases, so they never become `latest`
export const PRERELEASE_DIST_TAG = 'next';

// how often and how far apart `publish` checks that a new version reached the registry
export const REGISTRY_POLL_ATTEMPTS = 10;
export const REGISTRY_POLL_INTERVAL_SECONDS = 6;

// the identity release tags are created with, which GitHub runners don't configure
export const TAGGER_NAME = 'github-actions[bot]';
export const TAGGER_EMAIL = '41898208+github-actions[bot]@users.noreply.github.com';

// upper bounds for reading a tarball, so a malformed archive can't exhaust memory
export const MAX_TARBALL_BYTES = 256 * 1024 * 1024;
export const MAX_TARBALL_ENTRIES = 16_384;
